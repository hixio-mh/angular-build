// tslint:disable:no-unsafe-any
// tslint:disable:no-require-imports
import * as rollup from 'rollup';

import commonjs from '@rollup/plugin-commonjs';
import resolve from '@rollup/plugin-node-resolve';

import { AngularBuildContext } from '../../../build-context';
import { ExternalsEntry } from '../../../models';
import { LibBundleOptionsInternal, LibProjectConfigInternal } from '../../../models/internals';

import { getAngularGlobals } from './angular-globals';
import { getRxJsGlobals } from './rxjs-globals';

// tslint:disable-next-line:max-func-body-length
export function getRollupConfig(angularBuildContext: AngularBuildContext<LibProjectConfigInternal>,
    currentBundle: LibBundleOptionsInternal): {
        inputOptions: rollup.InputOptions;
        outputOptions: rollup.OutputOptions;
    } {
    const logger = AngularBuildContext.logger;
    const libConfig = angularBuildContext.projectConfig;

    // const isTsEntry = /\.tsx?$/i.test(currentBundle._entryFilePath);
    let moduleName = libConfig.libraryName;
    if (!moduleName && libConfig._projectName) {
        if (libConfig._projectName.startsWith('@')) {
            moduleName = libConfig._projectName
                .substring(1)
                .split('/')
                .join('.');
        } else {
            moduleName = libConfig._projectName
                .split('/')
                .join('.');
        }
        moduleName = moduleName
            .replace(/-([a-z])/g, (_, g1) => {
                return g1 ? g1.toUpperCase() : '';
            });
    }

    let amdId: {} | undefined;
    if (libConfig._projectName) {
        amdId = { id: libConfig._projectName };
    }

    // library target
    if (!currentBundle.libraryTarget) {
        currentBundle.libraryTarget = 'esm';
    }

    // externals
    const includeCommonJsModules = currentBundle.includeCommonJsModules;
    const rawExternals: ExternalsEntry[] = [];
    const rollupExternalMap = {
        externals: [] as string[],
        globals: {}
    };

    if (typeof currentBundle.externals !== 'boolean' && !currentBundle.externals) {
        if (currentBundle.includeDefaultAngularAndRxJsGlobals ||
            (currentBundle.includeDefaultAngularAndRxJsGlobals !== false && !includeCommonJsModules)) {
            if (currentBundle.libraryTarget === 'esm') {
                rawExternals.push({
                    tslib: 'tslib'
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
            if (currentBundle.includeDefaultAngularAndRxJsGlobals !== false) {
                if (currentBundle.libraryTarget === 'esm') {
                    rawExternals.push({
                        tslib: 'tslib'
                    });
                }
                rawExternals.push({
                    ...getAngularGlobals(),
                    ...getRxJsGlobals()
                });
            }
        } else {
            if (currentBundle.includeDefaultAngularAndRxJsGlobals !== false) {
                if (currentBundle.libraryTarget === 'esm') {
                    rawExternals.push({
                        tslib: 'tslib'
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
        rawExternals.forEach((external) => {
            mapToRollupGlobalsAndExternals(external, rollupExternalMap);
        });
    }

    const externals = rollupExternalMap.externals || [];
    if (libConfig.platformTarget === 'node') {
        const getBuiltins = require('builtins');
        externals.push(...getBuiltins());
    }

    // plugins
    const plugins: rollup.Plugin[] = [];

    // if (currentBundle.libraryTarget === 'umd' || currentBundle.libraryTarget === 'cjs' || isTsEntry || includeCommonJsModules) {
    if (currentBundle.libraryTarget === 'umd' || currentBundle.libraryTarget === 'cjs' || includeCommonJsModules) {
        plugins.push(resolve());

        // if (isTsEntry) {
        //     const projectRoot = path.resolve(AngularBuildContext.workspaceRoot, libConfig._projectRoot || '');
        //     const typescriptPlugin = require('rollup-plugin-typescript2');

        //     let typescriptModulePath = 'typescript';
        //     try {
        //         typescriptModulePath =
        //             resolve.sync('typescript', { basedir: AngularBuildContext.nodeModulesPath || AngularBuildContext.workspaceRoot });
        //     } catch (err) {
        //         // do nothing
        //     }

        //     // rollup-plugin-typescript@0.8.1 doesn't support custom tsconfig path
        //     // so we use rollup-plugin-typescript2
        //     plugins.push(typescriptPlugin({
        //         tsconfig: currentBundle._tsConfigPath,
        //         // tslint:disable-next-line:non-literal-require
        //         typescript: require(typescriptModulePath),
        //         rollupCommonJSResolveHack: currentBundle.libraryTarget === 'umd' || currentBundle.libraryTarget === 'cjs',
        //         cacheRoot: path.resolve(projectRoot, './.rts2_cache')
        //     }));
        // }

        if (includeCommonJsModules) {
            plugins.push(commonjs({
                // extensions: isTsEntry ? ['.js', '.ts', '.tsx'] : ['.js'],
                extensions: ['.js'],
                // If false then skip sourceMap generation for CommonJS modules
                sourceMap: libConfig.sourceMap, // Default: true
            }));
        }
    }

    // let preserveSymlinks = false;
    // if (isTsEntry &&
    //     currentBundle._tsConfigPath &&
    //     currentBundle._tsCompilerConfig &&
    //     currentBundle._tsCompilerConfig.options.preserveSymlinks) {
    //     preserveSymlinks = true;
    // }

    const inputOptions: rollup.InputOptions = {
        input: currentBundle._entryFilePath,
        // preserveSymlinks: preserveSymlinks,
        external: externals,
        plugins: plugins,
        onwarn(warning: string | rollup.RollupWarning): void {
            if (typeof warning === 'string') {
                logger.warn(warning);

                return;
            }

            // Skip certain warnings
            // should intercept ... but doesn't in some rollup versions
            if (!warning.message || warning.code === 'THIS_IS_UNDEFINED') {
                return;
            }

            logger.warn(warning.message);
        }
    };

    const outputOptions: rollup.OutputOptions = {
        name: moduleName,
        amd: amdId,
        format: currentBundle.libraryTarget,
        globals: rollupExternalMap.globals,
        // suitable if you're exporting more than one thing
        exports: 'named',
        banner: libConfig._bannerText,
        file: currentBundle._outputFilePath,
        sourcemap: libConfig.sourceMap
    };

    return {
        inputOptions: inputOptions,
        outputOptions: outputOptions
    };
}

function mapToRollupGlobalsAndExternals(external: ExternalsEntry,
    mapResult: { externals: string[]; globals: { [key: string]: string } }): void {
    if (!external) {
        return;
    }

    if (typeof external === 'string') {
        if (!mapResult.externals.includes(external)) {
            mapResult.externals.push(external);
        }
    } else if (typeof external === 'object') {
        Object.keys(external)
            .forEach((k: string) => {
                const tempValue = external[k];
                if (typeof tempValue === 'string') {
                    mapResult.globals[k] = tempValue;
                    if (!mapResult.externals.includes(k)) {
                        mapResult.externals.push(k);
                    }
                } else if (typeof tempValue === 'object' && Object.keys(tempValue).length) {
                    const selectedKey = tempValue.root ? tempValue.root : Object.keys(tempValue)[0];
                    mapResult.globals[k] = tempValue[selectedKey];
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
