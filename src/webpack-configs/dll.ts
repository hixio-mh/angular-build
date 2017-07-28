import * as path from 'path';
import * as webpack from 'webpack';

import * as CopyWebpackPlugin from 'copy-webpack-plugin';
import * as webpackMerge from 'webpack-merge';

import { AssetsJsonWebpackPlugin } from '../plugins/assets-json-webpack-plugin';
import { IconWebpackPlugin } from '../plugins/icon-webpack-plugin';

import { DllParsedEntry, parseDllEntry, parseIconOptions, parseAssetEntry } from '../helpers';
import { AppProjectConfig } from '../models';
import { Logger, normalizeRelativePath } from '../utils';

import { getAngularFixPlugins } from './angular';
import { getCommonWebpackConfigPartial } from './common';
import { getStylesWebpackConfigPartial, getGlobalStyleEntries } from './styles';

import { WebpackConfigOptions } from './webpack-config-options';

/**
 * Enumerate loaders and their dependencies from this file to let the dependency validator
 * know they are used.
 * require('awesome-typescript-loader')
 */

export function getDllWebpackConfig(webpackConfigOptions: WebpackConfigOptions): webpack.Configuration {
    const buildOptions = webpackConfigOptions.buildOptions;
    const environment = buildOptions.environment || {};
    const projectConfig = webpackConfigOptions.projectConfig;
    const logger = webpackConfigOptions.logger || new Logger();

    if (!webpackConfigOptions.silent) {
        let msg = 'Using webpack dll config:';
        if (projectConfig.platformTarget) {
            msg += `, platform target - ${projectConfig.platformTarget}`;
        }
        if (projectConfig.libraryTarget) {
            msg += `, library format - ${projectConfig.libraryTarget}`;
        }
        if (Object.keys(environment)) {
            msg += `, environment - ${JSON.stringify(environment)}`;
        }
        logger.logLine(msg);
    }

    const configs = [
        getCommonWebpackConfigPartial(webpackConfigOptions),
        getStylesWebpackConfigPartial(webpackConfigOptions),
        getDllWebpackConfigPartial(webpackConfigOptions)
    ];

    return webpackMerge(configs as any);
}

export function getDllWebpackConfigPartial(webpackConfigOptions: WebpackConfigOptions): webpack.Configuration {
    const projectRoot = webpackConfigOptions.projectRoot;
    const buildOptions = webpackConfigOptions.buildOptions;
    const environment = buildOptions.environment || {};
    const appConfig = webpackConfigOptions.projectConfig as AppProjectConfig;

    if (!environment.dll) {
        return {};
    }

    const srcDir = path.resolve(projectRoot, appConfig.srcDir || '');
    const nodeModulesPath = path.resolve(projectRoot, 'node_modules');

    const hashLibFormat = appConfig.platformTarget === 'web' && appConfig.appendOutputHash ? `[chunkhash]` : '';
    const libraryName = `[name]_${hashLibFormat || appConfig.libraryName || 'lib'}`;

    const entryPoints: { [key: string]: string[] } = {};
    const tsEntries: any[] = [];

    const vendorChunkName = appConfig.vendorChunkName || 'vendor';
    const cliIsLocal = (buildOptions as any).cliIsLocal !== false;

    // vendor
    if (appConfig.dlls && appConfig.dlls.length) {
        const entries: string[] = [];
        parseDllEntry(projectRoot, srcDir, appConfig.dlls, environment).forEach(
            (dllParsedEntry: DllParsedEntry) => {
                if (dllParsedEntry.tsPath) {
                    if (tsEntries.indexOf(dllParsedEntry.tsPath) === -1) {
                        tsEntries.push(dllParsedEntry.tsPath);
                    }
                    if (entries.indexOf(dllParsedEntry.tsPath) === -1) {
                        entries.push(dllParsedEntry.tsPath);
                    }
                } else {
                    if (Array.isArray(dllParsedEntry.entry)) {
                        entries.push(...dllParsedEntry.entry.filter((ee: string) => entries.indexOf(ee) === -1));
                    } else if (entries.indexOf(dllParsedEntry.entry) === -1) {
                        entries.push(dllParsedEntry.entry);
                    }
                }
            });

        // process global styles
        if (appConfig.styles && appConfig.styles.length > 0 && !appConfig.extractCss) {
            let globalStyleParsedEntries = getGlobalStyleEntries(projectRoot, appConfig, buildOptions);
            globalStyleParsedEntries.forEach(style => {
                const styleEntryRel = normalizeRelativePath(path.relative(nodeModulesPath, style.path));
                if (entries.indexOf(styleEntryRel) === -1) {
                    entries.push(styleEntryRel);
                }
            });
        }

        entryPoints[vendorChunkName] = entries;
    }

    // rules
    const rules: any[] = [];
    if (tsEntries.length) {
        const tsLoader = cliIsLocal ? 'awesome-typescript-loader' : require.resolve('awesome-typescript-loader');
        const tsConfigPath = path.resolve(projectRoot, appConfig.srcDir || '', appConfig.tsconfig || 'tsconfig.json');
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
    const plugins = [
        new webpack.DllPlugin({
            context: projectRoot,
            path: path.resolve(projectRoot, appConfig.outDir, `[name]-manifest.json`),
            name: libraryName
        }),
        new AssetsJsonWebpackPlugin({ fileName: `${vendorChunkName}-assets.json` })
    ];

    // TODO: automatacally add when ngb init?
    // es6-promise
    // Workaround for https://github.com/stefanpenner/es6-promise/issues/100
    plugins.push(new webpack.IgnorePlugin(/^vertx$/));

    // Workaround for https://github.com/andris9/encoding/issues/16
    // commonPlugins.push(new webpack.NormalModuleReplacementPlugin(/\/iconv-loader$/, require.resolve('node-noop'))));

    // angular fix plugins
    plugins.push(...getAngularFixPlugins(projectRoot, appConfig));

    // copy assets
    if (appConfig.assets &&
        appConfig.assets.length > 0) {
        const copyAssetOptions = parseAssetEntry(srcDir, appConfig.assets);
        if (copyAssetOptions && copyAssetOptions.length > 0) {
            plugins.push(new CopyWebpackPlugin(copyAssetOptions,
                {
                    ignore: ['**/.gitkeep']
                    // copyUnmodified: false
                }));
        }
    }

    // favicons plugins
    if (!appConfig.platformTarget || appConfig.platformTarget === 'web') {
        const iconOptions = parseIconOptions(projectRoot, appConfig);
        if (iconOptions && iconOptions.masterPicture) {
            plugins.push(new IconWebpackPlugin(iconOptions));
        }
    }

    // webpack config
    const webpackDllConfig: webpack.Configuration = {
        entry: entryPoints,
        resolve: {
            extensions: tsEntries.length ? ['.ts', '.js'] : ['.js']
        },
        output: {
            library: libraryName
        },
        module: {
            rules: rules
        },
        plugins: plugins
    };

    return webpackDllConfig;
}
