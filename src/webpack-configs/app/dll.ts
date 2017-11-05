import * as path from 'path';
import * as webpack from 'webpack';

import { WriteAssetsToDiskWebpackPlugin } from '../../plugins/write-assets-to-disk-webpack-plugin';
import { WriteStatsJsonWebpackPlugin } from '../../plugins/write-stats-json-webpack-plugin';

import { AppBuildContext, AppProjectConfigInternal, InternalError, InvalidConfigError } from '../../models';

import { getAngularFixPlugins } from './angular';
import { getAppCommonWebpackConfigPartial } from './common';
import { getAppStylesWebpackConfigPartial } from './styles';

const webpackMerge = require('webpack-merge');

/**
 * Enumerate loaders and their dependencies from this file to let the dependency validator
 * know they are used.
 * require('awesome-typescript-loader')
 */

export function getAppDllWebpackConfig(angularBuildContext: AppBuildContext): webpack.Configuration {
    if (!angularBuildContext.environment.dll ||
        angularBuildContext.projectConfig._projectType !== 'app') {
        return {};
    }

    const configs: webpack.Configuration[] = [
        getAppCommonWebpackConfigPartial(angularBuildContext),
        getAppStylesWebpackConfigPartial(angularBuildContext),
        getAppDllWebpackConfigPartial(angularBuildContext)
    ];

    const mergedConfig = webpackMerge(configs) as webpack.Configuration;
    if (!mergedConfig.entry || (typeof mergedConfig.entry === 'object' && !Object.keys(mergedConfig.entry).length)) {
        mergedConfig.entry = (() => ({})) as any;
    }

    return mergedConfig;
}

export function getAppDllWebpackConfigPartial(angularBuildContext: AppBuildContext): webpack.Configuration {
    const projectRoot = angularBuildContext.projectRoot;
    const appConfig = angularBuildContext.projectConfig as AppProjectConfigInternal;
    const cliIsGlobal = angularBuildContext.cliIsGlobal;

    if (!angularBuildContext.environment.dll) {
        return {};
    }

    if (!appConfig.outDir) {
        throw new InvalidConfigError(
            `The 'apps[${angularBuildContext.projectConfig._index
            }].outDir' value is required.`);
    }

    const outDir = path.resolve(projectRoot, appConfig.outDir);

    const hashLibFormat =
        (!appConfig.platformTarget || appConfig.platformTarget === 'web') && appConfig.appendOutputHash
            ? `[chunkhash]`
            : '';
    const libraryName = `[name]_${hashLibFormat || 'lib'}`;
    const vendorChunkName = appConfig.vendorChunkName || 'vendor';

    const entryPoints: { [key: string]: string[] } = {};
    const tsEntries: any[] = [];
    const entries: string[] = [];

    // dll
    if (appConfig.dll) {
        if (!appConfig._dllParsedResult) {
            throw new InternalError(`The 'appConfig._dllParsedResult' is not set`);
        }
        const dllResult = appConfig._dllParsedResult;
        dllResult.tsEntries.forEach(tsEntry => {
            if (!tsEntries.includes(tsEntry)) {
                tsEntries.push(tsEntry);
            }
            if (!entries.includes(tsEntry)) {
                entries.push(tsEntry);
            }
        });
        dllResult.scriptEntries.forEach(scriptEntry => {
            if (!entries.includes(scriptEntry)) {
                entries.push(scriptEntry);
            }
        });
        dllResult.styleEntries.forEach(styleEntry => {
            if (!entries.includes(styleEntry)) {
                entries.push(styleEntry);
            }
        });
    }

    if (!entries.length) {
        throw new InvalidConfigError(
            `No entry available in 'apps[${angularBuildContext.projectConfig._index
            }].dll'.`);
    }

    entryPoints[vendorChunkName] = entries;

    // rules
    const rules: webpack.Rule[] = [];
    if (tsEntries.length > 0) {
        const tsLoader = cliIsGlobal ? require.resolve('awesome-typescript-loader') : 'awesome-typescript-loader';
        const tsConfigPath = appConfig._tsConfigPath;
        rules.push({
            test: /\.ts$/,
            use: [
                {
                    loader: tsLoader,
                    options: {
                        instance: `at-${appConfig.name || 'app'}-dll-loader`,
                        configFileName: tsConfigPath
                        // transpileOnly: true
                    }
                }
            ],
            include: tsEntries
        });
    }

    // plugins
    const plugins: webpack.Plugin[] = [
        new webpack.DllPlugin({
            context: projectRoot,
            path: path.resolve(outDir, `${vendorChunkName}-manifest.json`),
            name: libraryName
        }),
        new WriteStatsJsonWebpackPlugin({
            path: path.resolve(outDir, `${vendorChunkName}-assets.json`),
            forceWriteToDisk: true,
            loggerOptions: {
                logLevel: angularBuildContext.angularBuildConfig.logLevel
            }
        }),
        new WriteAssetsToDiskWebpackPlugin({
            emittedPaths: [path.resolve(outDir, `${vendorChunkName}-manifest.json`)],
            exclude: [`${vendorChunkName}-assets.json`],
            loggerOptions: {
                logLevel: angularBuildContext.angularBuildConfig.logLevel
            }
        })
    ];


    // es6-promise
    // workaround for https://github.com/stefanpenner/es6-promise/issues/100
    plugins.push(new webpack.IgnorePlugin(/^vertx$/));

    // workaround for https://github.com/andris9/encoding/issues/16
    // commonPlugins.push(new webpack.NormalModuleReplacementPlugin(/\/iconv-loader$/, require.resolve('node-noop'))));

    // angular fix plugins
    plugins.push(...getAngularFixPlugins(angularBuildContext));

    // webpack config
    const webpackDllConfig: webpack.Configuration = {
        entry: entryPoints,
        resolve: {
            extensions: tsEntries.length > 0 ? ['.ts', '.js'] : ['.js']
        },
        output: {
            publicPath: appConfig.publicPath || '/',
            library: libraryName
        },
        module: {
            rules: rules
        },
        plugins: plugins
    };

    return webpackDllConfig;
}
