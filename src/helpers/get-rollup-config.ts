import * as rollup from 'rollup';

import { defaultAngularAndRxJsExternals } from '../helpers/angular-rxjs-externals';
import { AngularBuildContext, BundleOptionsInternal, InternalError, LibProjectConfigInternal } from '../models';

const getBuiltins = require('builtins');

export function getRollupConfig(angularBuildContext: AngularBuildContext,
    currentBundle: BundleOptionsInternal,
    outputFilePath: string): {
        inputOptions: rollup.InputOptions;
        outputOptions: rollup.OutputOptions;
    } {
    if (!currentBundle._entryFilePath) {
        throw new InternalError(`The 'currentBundle._entryFilePath' is not set.`);
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
    let externalsRaw = currentBundle.externals as any;
    const rollupExternalMap = {
        externals: [] as string[],
        globals: {}
    };
    if (currentBundle.nodeModulesAsExternals !== false) {
        includeCommonJsModules = false;
    }

    if (typeof currentBundle.externals === 'undefined') {
        if (currentBundle.angularAndRxJsAsExternals ||
            (currentBundle.angularAndRxJsAsExternals !== false && !includeCommonJsModules)) {
            if (libraryTarget === 'es') {
                externalsRaw = Object.assign({
                    'tslib': 'tslib'
                },
                    defaultAngularAndRxJsExternals);
            } else {
                externalsRaw = Object.assign({}, defaultAngularAndRxJsExternals);
            }
        }
    } else {
        let noExternals = false;
        if (!currentBundle.externals ||
            (Array.isArray(currentBundle.externals) && !currentBundle.externals.length) ||
            (typeof currentBundle.externals === 'object' && !Object.keys(currentBundle.externals).length)) {
            noExternals = true;
        }

        if (noExternals) {
            if (currentBundle.angularAndRxJsAsExternals !== false) {
                let defaultExternals = Object.assign({}, defaultAngularAndRxJsExternals);
                if (libraryTarget === 'es') {
                    defaultExternals = Object.assign({
                        'tslib': 'tslib'
                    },
                        defaultExternals);
                }
                externalsRaw = defaultExternals;
            }
        } else {
            if (currentBundle.angularAndRxJsAsExternals !== false) {
                let defaultExternals = Object.assign({}, defaultAngularAndRxJsExternals);
                if (libraryTarget === 'es') {
                    defaultExternals = Object.assign({
                        'tslib': 'tslib'
                    },
                        defaultExternals);
                }
                if (Array.isArray(externalsRaw)) {
                    (externalsRaw as any[]).push(defaultExternals);
                } else {
                    externalsRaw = [defaultExternals, externalsRaw];
                }
            }
        }
    }

    mapToRollupGlobalsAndExternals(externalsRaw, rollupExternalMap);
    if (Object.keys(rollupExternalMap.globals).length) {
        rollupExternalMap.externals = rollupExternalMap.externals || [];

        Object.keys(rollupExternalMap.globals).forEach((key: string) => {
            if (rollupExternalMap.externals.indexOf(key) === -1) {
                rollupExternalMap.externals.push(key);
            }
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
            const typescript = require('rollup-plugin-typescript2');

            // rollup-plugin-typescript@0.8.1 doesn't support custom tsconfig path
            // so we use rollup-plugin-typescript2
            plugins.push(typescript({
                tsconfig: currentBundle._tsConfigPath,
                typescript: require('typescript'),
                rollupCommonJSResolveHack: libraryTarget === 'cjs'
                // cacheRoot: './.rts2_cache'
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

function mapToRollupGlobalsAndExternals(externals: any,
    mapResult: { externals: string[], globals: { [key: string]: string } },
    subExternals?: any): void {
    if (externals) {
        if (Array.isArray(externals)) {
            externals.forEach((external: any) => {
                mapToRollupGlobalsAndExternals(externals, mapResult, external);
            });
        } else {
            subExternals = subExternals || externals;
            if (typeof subExternals === 'object') {
                Object.keys(subExternals).forEach((k: string) => {
                    const tempValue = subExternals[k];
                    if (typeof tempValue === 'object') {
                        const firstKey = Object.keys(tempValue)[0];
                        mapResult.globals = mapResult.globals || {};
                        mapResult.globals[k] = tempValue[firstKey];

                    } else if (typeof tempValue === 'string') {
                        mapResult.globals = mapResult.globals || {};
                        mapResult.globals[k] = tempValue;
                    } else {
                        mapResult.externals = mapResult.externals || [];
                        mapResult.externals.push(k);
                    }
                });
            } else if (typeof subExternals === 'string') {
                mapResult.externals = mapResult.externals || [];
                mapResult.externals.push(subExternals);
            }
        }
    }
}
