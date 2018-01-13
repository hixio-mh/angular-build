import * as rollup from 'rollup';

import { BundleOptionsInternal, InternalError, LibBuildContext, LibProjectConfigInternal } from '../models';

const rollupNodeResolve = require('rollup-plugin-node-resolve');

export function getRollupConfig(angularbuildContext: LibBuildContext,
    currentBundle: BundleOptionsInternal,
    outputFilePath: string): {
        inputOptions: rollup.InputOptions;
        outputOptions: rollup.OutputOptions;
    } {
    if (!currentBundle._entryFilePath) {
        throw new InternalError(`The 'currentBundle._entryFilePath' is not set.`);
    }

    const logger = angularbuildContext.logger;

    const libConfig = angularbuildContext.projectConfig as LibProjectConfigInternal;
    const libraryTarget = currentBundle.libraryTarget;

    let format: rollup.ModuleFormat;
    if (libraryTarget === 'commonjs' || libraryTarget === 'commonjs2') {
        format = 'cjs';
    } else {
        format = libraryTarget as rollup.ModuleFormat;
    }

    const moduleName = libConfig.libraryName || angularbuildContext.packageNameWithoutScope;
    const rollupExternalMap = {
        externals: [] as string[],
        globals: {}
    };
    mapToRollupGlobalsAndExternals(currentBundle.externals, rollupExternalMap);
    if (rollupExternalMap.globals) {
        rollupExternalMap.externals = rollupExternalMap.externals || [];
        Object.keys(rollupExternalMap.globals).forEach((key: string) => {
            if (rollupExternalMap.externals.indexOf(key) === -1) {
                rollupExternalMap.externals.push(key);
            }
        });
    }
    let externals = rollupExternalMap.externals || [];
    // When creating a UMD, we want to exclude tslib from the `external` bundle option so that it
    // is inlined into the bundle.
    if (format === 'umd') {
        externals = externals.filter(key => key !== 'tslib');
    }

    const plugins: any[] = [];

    if (format === 'umd') {
        const nodeResolveOptions: any = {
            jsnext: true
        };

        plugins.push(rollupNodeResolve(nodeResolveOptions));
    }

    const inputOptions: rollup.InputOptions = {
        input: currentBundle._entryFilePath,
        external: externals,
        plugins: plugins,
        onwarn(warning: rollup.RollupWarning): void {
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
        format: format,
        globals: rollupExternalMap.globals,
        // suitable if you're exporting more than one thing
        exports: 'named',
        banner: angularbuildContext.bannerText,
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
