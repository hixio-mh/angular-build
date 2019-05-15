import * as path from 'path';

import { Configuration, DllPlugin, IgnorePlugin, Plugin, RuleSetRule } from 'webpack';
import * as webpackMerge from 'webpack-merge';

import { WriteAssetsToDiskWebpackPlugin } from '../../plugins/write-assets-to-disk-webpack-plugin';
import { WriteStatsJsonWebpackPlugin } from '../../plugins/write-stats-json-webpack-plugin';

import { AngularBuildContext } from '../../build-context';
import { getCustomWebpackConfig, outputHashFormat, resolveLoaderPath } from '../../helpers';
import { InternalError, InvalidConfigError } from '../../models/errors';
import { AppProjectConfigInternal } from '../../models/internals';

import { getAngularFixPlugins } from './angular';
import { getAppCommonWebpackConfigPartial } from './common';
import { getAppStylesWebpackConfigPartial } from './styles';

export async function getAppDllWebpackConfig(angularBuildContext: AngularBuildContext<AppProjectConfigInternal>): Promise<Configuration> {
    const appConfig = angularBuildContext.projectConfig;
    let customWebpackConfig: Configuration = {};

    if (!appConfig._isDll || angularBuildContext.projectConfig._projectType !== 'app') {
        return {};
    }

    if (appConfig.webpackConfig) {
        const customWebpackConfigPath =
            path.resolve(AngularBuildContext.workspaceRoot, appConfig.root || '', appConfig.webpackConfig);
        customWebpackConfig = await getCustomWebpackConfig(customWebpackConfigPath, angularBuildContext) || {};
    }

    const angularWpConfig = await getAppCommonWebpackConfigPartial(angularBuildContext);
    const stylesWpConfig = await getAppStylesWebpackConfigPartial(angularBuildContext);
    const dllWpConfig = await getAppDllWebpackConfigPartial(angularBuildContext);

    const configs: Configuration[] = [
        angularWpConfig,
        stylesWpConfig,
        dllWpConfig,
        customWebpackConfig
    ];

    const mergedConfig = webpackMerge(...configs);
    if (!mergedConfig.entry || (typeof mergedConfig.entry === 'object' && !Object.keys(mergedConfig.entry).length)) {
        mergedConfig.entry = (() => ({}));
    }

    return mergedConfig;
}

// tslint:disable:max-func-body-length
async function getAppDllWebpackConfigPartial(angularBuildContext: AngularBuildContext<AppProjectConfigInternal>): Promise<Configuration> {
    const logLevel = angularBuildContext.buildOptions.logLevel;

    const appConfig = angularBuildContext.projectConfig;

    if (!appConfig._projectRoot) {
        throw new InternalError("The 'appConfig._projectRoot' is not set.");
    }

    if (!appConfig._outputPath) {
        throw new InternalError("The 'appConfig._outputPath' is not set.");
    }

    const projectRoot = appConfig._projectRoot;
    const outputPath = appConfig._outputPath;

    // TODO: to review for hash
    const libHashFormat = (!appConfig.platformTarget || appConfig.platformTarget === 'web') &&
        appConfig._outputHashing &&
        appConfig._outputHashing.bundles
        ? outputHashFormat.bundle
        : '';

    const libraryName = `[name]_${libHashFormat || 'lib'}`;
    const vendorChunkName = appConfig.vendorChunkName || 'vendor';

    const entrypoints: { [key: string]: string[] } = {};
    const tsEntries: string[] = [];
    const entries: string[] = [];

    // dll
    if (appConfig.vendors) {
        if (!appConfig._dllParsedResult) {
            throw new InternalError("The 'appConfig._dllParsedResult' is not set");
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

    entrypoints[vendorChunkName] = entries;

    const rules: RuleSetRule[] = [];

    // plugins
    const plugins: Plugin[] = [
        new DllPlugin({
            context: projectRoot,
            path: path.resolve(outputPath, `${vendorChunkName}-manifest.json`),
            name: libraryName
        }),
        new WriteStatsJsonWebpackPlugin({
            outputPath: outputPath,
            path: path.resolve(outputPath, `${vendorChunkName}-assets.json`),
            forceWriteToDisk: true,
            logLevel: logLevel
        }),
        new WriteAssetsToDiskWebpackPlugin({
            outputPath: outputPath,
            emittedPaths: [path.resolve(outputPath, `${vendorChunkName}-manifest.json`)],
            exclude: [`${vendorChunkName}-assets.json`],
            logLevel: logLevel
        })
    ];

    if (tsEntries.length > 0) {
        const tsConfigPath = appConfig._tsConfigPath;
        const tsLoaderOptions: { [key: string]: string | boolean } = {
            // tslint:disable-next-line:prefer-template
            instance: `at-${appConfig.name || 'apps[' + appConfig._index.toString() + ']'}-loader`,
            transpileOnly: appConfig.tsConfig ? false : true,
            onlyCompileBundledFiles: appConfig.tsConfig ? false : true,
            silent: logLevel !== 'debug'
        };

        if (appConfig.tsConfig && tsConfigPath) {
            tsLoaderOptions.configFile = tsConfigPath;
        }
        if (logLevel) {
            tsLoaderOptions.logLevel = logLevel;
        }

        const tsLoader = await resolveLoaderPath('ts-loader');

        rules.push({
            test: /\.tsx?$/,
            use: [
                {
                    loader: tsLoader,
                    options: tsLoaderOptions
                }
            ],
            include: tsEntries
        });
    }

    // es6-promise
    // workaround for https://github.com/stefanpenner/es6-promise/issues/100
    plugins.push(new IgnorePlugin(/^vertx$/));

    // workaround for https://github.com/andris9/encoding/issues/16
    // commonPlugins.push(new webpack.NormalModuleReplacementPlugin(/\/iconv-loader$/, require.resolve('node-noop'))));

    // angular fix plugins
    plugins.push(...getAngularFixPlugins(angularBuildContext));

    // webpack config
    // tslint:disable-next-line:no-unnecessary-local-variable
    const webpackDllConfig: Configuration = {
        entry: entrypoints,
        resolve: {
            extensions: tsEntries.length > 0 ? ['.ts', '.mjs', '.js'] : ['.mjs', '.js'],
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
