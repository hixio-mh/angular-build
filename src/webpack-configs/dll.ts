import * as path from 'path';
import * as fs from 'fs';
import * as chalk from 'chalk';
import * as webpack from 'webpack';
const webpackMerge = require('webpack-merge');

// Models
import { AppConfig, BuildOptions } from '../models';

// Helpers
import { parseDllEntries, getIconOptions } from '../helpers';

// Internal plugins
import { CustomizeAssetsHtmlWebpackPlugin } from '../plugins/customize-assets-html-webpack-plugin';
import { IconWebpackPlugin } from '../plugins/icon-webpack-plugin';

// Configs
import { getCommonConfigPartial } from './common';
import {getAngularConfigPartial} from './angular';
import { getStylesConfigPartial } from './styles';

export function getDllConfig(projectRoot: string, appConfig: AppConfig, buildOptions: BuildOptions) {
    console.log(`\n${chalk.bgBlue('INFO:')} Getting dll config, build env: ${JSON
        .stringify(buildOptions.environment)}, app name: ${appConfig.name}, app target: ${appConfig
        .target}\n`);

    const configs = [
        getCommonConfigPartial(projectRoot, appConfig, buildOptions),
        getDllConfigPartial(projectRoot, appConfig, buildOptions),
        getAngularConfigPartial(projectRoot, appConfig, buildOptions),
        getStylesConfigPartial(projectRoot, appConfig, buildOptions)
    ];

    return webpackMerge(configs);
}

export function getDllConfigPartial(projectRoot: string, appConfig: AppConfig, buildOptions: BuildOptions) {

    const hashLibFormat = appConfig.appendOutputHash ? `[chunkhash]` : 'lib';
    const entryPoints: { [key: string]: string[] } = {};

    let tsConfigPath = path.resolve(projectRoot, appConfig.root, appConfig.tsconfig || 'tsconfig.json');
    if (!fs.existsSync(tsConfigPath)) {
        tsConfigPath = path.resolve(projectRoot, 'tsconfig.json');
    }
    if (!fs.existsSync(tsConfigPath)) {
        tsConfigPath = null;
    }

    let useTsLoader = false;

    const vendorChunkName = appConfig.dllChunkName || 'vendor';
    const polyfillsChunkName = 'polyfills';


    const tsEntries: any[] = [];

    // Entry
    //
    // Vendor
    if (appConfig.dlls && appConfig.dlls.length) {
        const entries: string[] = [];
        parseDllEntries(projectRoot, appConfig.root, appConfig.dlls, buildOptions.environment).forEach(e => {
            if (e.tsPath) {
                useTsLoader = true;
                if (tsEntries.indexOf(e.tsPath) === -1) {
                    tsEntries.push(e.tsPath);
                }
                if (entries.indexOf(e.tsPath) === -1) {
                    entries.push(e.tsPath);
                }
            } else {
                if (Array.isArray(e.entry)) {
                    entries.push(...e.entry.filter((ee: string) => entries.indexOf(ee) === -1));
                } else if (entries.indexOf(e.entry) === -1) {
                    entries.push(e.entry);
                }
            }
        });

        if (entries.length === 0) {
            throw new Error(`No dll entry.`);
        }
        entryPoints[vendorChunkName] = entries;
    }

    // Polyfills
    if (appConfig.polyfills && appConfig.polyfills.length) {
        const entries: string[] = [];
        parseDllEntries(projectRoot, appConfig.root, appConfig.polyfills, buildOptions.environment).forEach(e => {
            if (e.tsPath) {
                useTsLoader = true;
                if (tsEntries.indexOf(e.tsPath) === -1) {
                    tsEntries.push(e.tsPath);
                }
                if (entries.indexOf(e.tsPath) === -1) {
                    entries.push(e.tsPath);
                }
            } else {
                if (Array.isArray(e.entry)) {
                    entries.push(...e.entry.filter((ee: string) => entries.indexOf(ee) === -1));
                } else if (entries.indexOf(e.entry) === -1) {
                    entries.push(e.entry);
                }
            }
        });

        if (entries.length === 0) {
            throw new Error(`No polyfills entry.`);
        }
        entryPoints[polyfillsChunkName] = entries;
    }

    // Rules
    //
    //if (useTsLoader) {
    //    const tsRules = [
    //        {
    //            test: /\.ts$/,
    //            use: [
    //                {
    //                    loader: 'awesome-typescript-loader',
    //                    options: {
    //                        instance: `at-${appConfig.name || 'app'}-dll-loader`,
    //                        configFileName: tsConfigPath
    //                        //transpileOnly: true
    //                    }
    //                }
    //            ],
    //            include: tsEntries
    //        }
    //    ];
    //    rules.push(...tsRules);
    //}

    // Plugins
    //
    const plugins = [
        new (<any>webpack).DllPlugin({
            path: path.resolve(projectRoot, appConfig.outDir, `[name]-manifest.json`),
            name: `[name]_${hashLibFormat}`
        }),

        // es6-promise
        // Workaround for https://github.com/stefanpenner/es6-promise/issues/100
        new webpack.IgnorePlugin(/^vertx$/)

        // Workaround for https://github.com/andris9/encoding/issues/16
        //new NormalModuleReplacementPlugin(/\/iconv-loader$/, require.resolve('node-noop')))
    ];
    //if (useTsLoader) {
    //    plugins.push(new CheckerPlugin());
    //}

    // Browser specific
    //
    if (!appConfig.target || appConfig.target === 'web' || appConfig.target === 'webworker') {
        // Favicons plugins
        //
        let skipGenerateIcons = appConfig.skipGenerateIcons;
        if (typeof skipGenerateIcons === 'undefined' || skipGenerateIcons === null) {
            if (typeof buildOptions.skipGenerateIcons !== 'undefined' && buildOptions.skipGenerateIcons !== null) {
                skipGenerateIcons = buildOptions.skipGenerateIcons;
            } else {
                skipGenerateIcons = !appConfig.faviconConfig;
            }
        }

        const iconOptions = getIconOptions(projectRoot, appConfig);
        if (!skipGenerateIcons && iconOptions) {
            plugins.push(new IconWebpackPlugin(iconOptions));

            // remove starting slash
            plugins.push(new CustomizeAssetsHtmlWebpackPlugin({
                removeStartingSlash: true
            }));
        }

    }

    // Config
    //
    const webpackDllConfig : any = {
        entry: entryPoints,
        output: {
            library: `[name]_${hashLibFormat}`
        },
        plugins: plugins
    };

    //if (useTsLoader) {
    //    webpackDllConfig.resolve = webpackDllConfig.resolve || {};
    //    //webpackDllConfig.resolve.extensions = ['.js', '.ts'];

    //    // TODO:
    //    //const alias: any = {};
    //    //if (fs.existsSync(tsConfigPath)) {
    //    //    const tsConfigContent = readJsonSync(tsConfigPath);
    //    //    const compilerOptions = tsConfigContent.compilerOptions || {};
    //    //    const tsPaths = compilerOptions.paths || {};
    //    //    for (let prop in tsPaths) {
    //    //        if (tsPaths.hasOwnProperty(prop)) {
    //    //            alias[prop] = path.resolve(projectRoot, tsPaths[prop][0]);
    //    //        }
    //    //    }
    //    //}
    //    //webpackDllConfig.resolve.alias = alias;
    //    webpackDllConfig.resolve.plugins =
    //    [
    //        new TsConfigPathsPlugin({
    //            configFileName: tsConfigPath
    //        })
    //    ];
    //}

    // Node specific
    if (appConfig.target && appConfig.target !== 'web' && appConfig.target !== 'webworker') {
        webpackDllConfig.output = webpackDllConfig.output || {};
        webpackDllConfig.output.libraryTarget = 'commonjs2';
    }

    return webpackDllConfig;
}
