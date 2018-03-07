import * as path from 'path';
import * as rollup from 'rollup';

import { getAngularGlobals } from '../helpers/angular-globals';
import { getRxJsGlobals } from '../helpers/rxjs-globals';

import {
    AngularBuildContext,
    BundleOptionsInternal,
    ExternalsEntry,
    InternalError,
    LibProjectConfigInternal
} from '../models';

const getBuiltins = require('builtins');

export function getRollupConfig(angularBuildContext: AngularBuildContext,
    currentBundle: BundleOptionsInternal,
    outputFilePath: string): {
        inputOptions: rollup.InputOptions;
        outputOptions: rollup.OutputOptions;
    } {
    if (!currentBundle._entryFilePath) {
        throw new InternalError("The 'currentBundle._entryFilePath' is not set.");
    }

    const logger = AngularBuildContext.logger;
    const libConfig = angularBuildContext.projectConfig as LibProjectConfigInternal;

    const isTsEntry = /\.ts$/i.test(currentBundle._entryFilePath);
    const moduleName = libConfig.libraryName || angularBuildContext.packageNameWithoutScope;

    // library target
    let libraryTarget: rollup.ModuleFormat = 'umd';
    if (currentBundle.libraryTarget === 'commonjs' || currentBundle.libraryTarget === 'commonjs2') {
        libraryTarget = 'cjs';
    } else if (currentBundle.libraryTarget === 'var') {
        libraryTarget = 'iife';
    } else if (!currentBundle.libraryTarget) {
        if (libConfig.platformTarget === 'node') {
            libraryTarget = 'cjs';
        }
    } else {
        libraryTarget = currentBundle.libraryTarget as rollup.ModuleFormat;
    }

    // externals
    let includeCommonJsModules = true;
    const rawExternals: ExternalsEntry[] = [];
    const rollupExternalMap = {
        externals: [] as string[],
        globals: {}
    };
    if (currentBundle.nodeModulesAsExternals !== false) {
        includeCommonJsModules = false;
    }

    if (typeof currentBundle.externals === 'undefined') {
        if (currentBundle.includeAngularAndGlobals ||
            (currentBundle.includeAngularAndGlobals !== false && !includeCommonJsModules)) {
            if (libraryTarget === 'es') {
                rawExternals.push({
                    'tslib': 'tslib'
                });
            }

            rawExternals.push({
                ...getAngularGlobals(),
                ...getRxJsGlobals()
            });
        }
    } else {
        let noExternals = false;
        if (!currentBundle.externals ||
            (Array.isArray(currentBundle.externals) && !currentBundle.externals.length) ||
            (typeof currentBundle.externals === 'object' && !Object.keys(currentBundle.externals).length)) {
            noExternals = true;
        }

        if (noExternals) {
            if (currentBundle.includeAngularAndGlobals !== false) {
                if (libraryTarget === 'es') {
                    rawExternals.push({
                        'tslib': 'tslib'
                    });
                }
                rawExternals.push({
                    ...getAngularGlobals(),
                    ...getRxJsGlobals()
                });
            }
        } else {
            if (currentBundle.includeAngularAndGlobals !== false) {
                if (libraryTarget === 'es') {
                    rawExternals.push({
                        'tslib': 'tslib'
                    });
                }
                rawExternals.push({
                    ...getAngularGlobals(),
                    ...getRxJsGlobals()
                });

                if (Array.isArray(currentBundle.externals)) {
                    rawExternals.push(...currentBundle.externals);
                } else {
                    rawExternals.push(currentBundle.externals);
                }
            }
        }
    }

    if (rawExternals.length) {
        rawExternals.forEach((external: any) => {
            mapToRollupGlobalsAndExternals(external, rollupExternalMap);
        });
    }

    const externals = rollupExternalMap.externals || [];
    if (libConfig.platformTarget === 'node') {
        externals.push(...getBuiltins());
    }

    // plugins
    const plugins: any[] = [];

    if (libraryTarget === 'umd' || libraryTarget === 'cjs' || isTsEntry || includeCommonJsModules) {
        const nodeResolveOptions: any = {
            // Default: false
            jsnext: true
        };

        const rollupNodeResolve = require('rollup-plugin-node-resolve');
        plugins.push(rollupNodeResolve(nodeResolveOptions));

        if (isTsEntry) {
            const projectRoot = AngularBuildContext.projectRoot;
            const srcDir = path.resolve(projectRoot, libConfig.srcDir || '');
            const typescript = require('rollup-plugin-typescript2');

            // rollup-plugin-typescript@0.8.1 doesn't support custom tsconfig path
            // so we use rollup-plugin-typescript2
            plugins.push(typescript({
                tsconfig: currentBundle._tsConfigPath,
                typescript: require('typescript'),
                rollupCommonJSResolveHack: libraryTarget === 'cjs',
                cacheRoot: path.resolve(srcDir, './.rts2_cache')
            }));
        }

        if (includeCommonJsModules) {
            const rollupCommonjs = require('rollup-plugin-commonjs');
            plugins.push(rollupCommonjs({
                extensions: isTsEntry ? ['.js', '.ts'] : ['.js'],
                // If false then skip sourceMap generation for CommonJS modules
                sourceMap: libConfig.sourceMap, // Default: true
            }));
        }
    }

    let preserveSymlinks = false;
    if (isTsEntry &&
        currentBundle._tsConfigPath &&
        currentBundle._tsCompilerConfig &&
        currentBundle._tsCompilerConfig.options.preserveSymlinks) {
        preserveSymlinks = true;
    }

    const inputOptions: rollup.InputOptions = {
        input: currentBundle._entryFilePath,
        preserveSymlinks: preserveSymlinks,
        external: externals,
        plugins: plugins,
        onwarn(warning: string | rollup.RollupWarning): void {
            if (typeof warning === 'string') {
                logger.warn(warning);
                return;
            }

            const rollupWarning = warning as rollup.RollupWarning;

            // Skip certain warnings
            // should intercept ... but doesn't in some rollup versions
            if (!rollupWarning.message || rollupWarning.code === 'THIS_IS_UNDEFINED') {
                return;
            }

            logger.warn(rollupWarning.message);
        }
    };

    const outputOptions: rollup.OutputOptions = {
        name: moduleName,
        format: libraryTarget,
        globals: rollupExternalMap.globals,
        // suitable if you're exporting more than one thing
        exports: currentBundle.namedExports ? 'named' : undefined,
        banner: angularBuildContext.bannerText,
        file: outputFilePath,
        sourcemap: libConfig.sourceMap
    };

    return {
        inputOptions: inputOptions,
        outputOptions: outputOptions
    };
}

function mapToRollupGlobalsAndExternals(external: ExternalsEntry,
    mapResult: { externals: string[], globals: { [key: string]: string } }): void {
    if (!external) {
        return;
    }

    if (typeof external === 'string') {
        if (!mapResult.externals.includes(external)) {
            mapResult.externals.push(external);
        }
    } else if (typeof external === 'object') {
        Object.keys(external).forEach((k: string) => {
            const tempValue = external[k] as any;
            if (typeof tempValue === 'string') {
                mapResult.globals[k] = tempValue;
                if (!mapResult.externals.includes(k)) {
                    mapResult.externals.push(k);
                }
            } else if (typeof tempValue === 'object' && Object.keys(tempValue).length) {
                const selectedKey = (tempValue as any).root ? (tempValue as any).root : Object.keys(tempValue)[0];
                mapResult.globals[k] = (tempValue as any)[selectedKey];
                if (!mapResult.externals.includes(k)) {
                    mapResult.externals.push(k);
                }
            } else {
                if (!mapResult.externals.includes(k)) {
                    mapResult.externals.push(k);
                }
            }
        });
    }
}
