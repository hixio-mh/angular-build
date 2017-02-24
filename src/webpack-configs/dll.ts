import * as path from 'path';
import * as fs from 'fs';
import * as chalk from 'chalk';
import * as webpack from 'webpack';

// ReSharper disable InconsistentNaming
const DllPlugin = require('webpack/lib/DllPlugin');
const IgnorePlugin = webpack.IgnorePlugin;

// ReSharper disable once CommonJsExternalModule
const { CheckerPlugin } = require('awesome-typescript-loader');
const webpackMerge = require('webpack-merge');
// ReSharper restore InconsistentNaming

// Models
import { AppConfig, BuildOptions } from '../models';
import { CustomizeAssetsHtmlWebpackPlugin } from '../plugins/customize-assets-html-webpack-plugin';

// Helpers
import { parseDllEntries, getEnvName } from './helpers';

import { getCommonConfigPartial } from './common';
import { getAngularConfigPartial } from './angular';

import { getFaviconPlugins } from './favicons';

/**
 * Enumerate loaders and their dependencies from this file to let the dependency validator
 * know they are used.
 *
  * require('awesome-typescript-loader')
 */

export function getDllConfig(projectRoot: string, appConfig: AppConfig, buildOptions: BuildOptions) {
    console.info(`\n${chalk.bgBlue('INFO:')} Using dll config, production: ${buildOptions.production}\n`);
    const nodeModulesPath = path.resolve(projectRoot, 'node_modules');

    const configs = [
        getCommonConfigPartial(projectRoot, appConfig, buildOptions),
        getDllConfigPartial(projectRoot, appConfig, buildOptions),
        getAngularConfigPartial(projectRoot, appConfig, buildOptions),
        {
            resolve: {
                extensions: ['.js'],
                modules: [nodeModulesPath]
            },
            resolveLoader: {
                modules: [nodeModulesPath]
            }
        }
    ];
    return webpackMerge(configs);
}

export function getDllConfigPartial(projectRoot: string, appConfig: AppConfig, buildOptions: BuildOptions) {
    const hashFormat = appConfig.appendOutputHash ? `[chunkhash:${20}]` : 'lib';
    const entryPoints: { [key: string]: string[] } = {};

    let tsConfigPath = path.resolve(projectRoot, appConfig.root, appConfig.tsconfig || 'tsconfig.json');
    if (!fs.existsSync(tsConfigPath)) {
        tsConfigPath = path.resolve(projectRoot, 'tsconfig.json');
    }
    if (!fs.existsSync(tsConfigPath)) {
        tsConfigPath = null;
    }

    const envLong = getEnvName(buildOptions.production, true);
    let useTsLoader = false;

    const vendorChunkName = appConfig.dllChunkName || 'vendor';
    const polyfillsChunkName = 'polyfills';

    const rules: any[] = [
        //{ test: /\.css(\?|$)/, use: ['to-string-loader', 'css-loader'] }
    ];
    const tsEntries: any[] = [];

    // Entry
    //
    // Vendor
    if (appConfig.dlls && appConfig.dlls.length) {
        const entries: string[] = [];
        parseDllEntries(projectRoot, appConfig.root, appConfig.dlls, envLong).forEach(e => {
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
        parseDllEntries(projectRoot, appConfig.root, appConfig.polyfills, envLong).forEach(e => {
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
    if (useTsLoader) {
        const tsRules = [
            {
                test: /\.ts$/,
                use: [
                    {
                        loader: 'awesome-typescript-loader',
                        options: {
                            instance: `at-${appConfig.name || 'app'}-dll-loader`,
                            configFileName: tsConfigPath
                            //transpileOnly: true
                        }
                    }
                ],
                include: tsEntries
            }
        ];
        rules.push(...tsRules);
    }

    // Plugins
    //
    const plugins = [
        new DllPlugin({
            path: path.resolve(projectRoot, appConfig.outDir, `[name]-manifest.json`),
            name: `[name]_${hashFormat}`
        }),

        // es6-promise
        // Workaround for https://github.com/stefanpenner/es6-promise/issues/100
        new IgnorePlugin(/^vertx$/)

        // Workaround for https://github.com/andris9/encoding/issues/16
        //new NormalModuleReplacementPlugin(/\/iconv-loader$/, require.resolve('node-noop')))
    ];
    if (useTsLoader) {
        plugins.push(new CheckerPlugin());
    }

    // Favicons plugins
    let skipGenerateIcons = appConfig.skipGenerateIcons;
    if (typeof skipGenerateIcons === 'undefined' || skipGenerateIcons === null) {
        if (!appConfig.target || appConfig.target === 'web') {
            if (typeof buildOptions.skipGenerateIcons !== 'undefined' && buildOptions.skipGenerateIcons !== null) {
                skipGenerateIcons = buildOptions.skipGenerateIcons;
            } else {
                skipGenerateIcons = !buildOptions.dll && !buildOptions.production && appConfig.referenceDll;
            }
        } else {
            skipGenerateIcons = true;
        }
    }

    if (typeof appConfig.faviconConfig !== 'undefined' &&
        appConfig.faviconConfig !== null &&
        !skipGenerateIcons) {

        const faviconPlugins = getFaviconPlugins(projectRoot, appConfig);
        if (faviconPlugins && faviconPlugins.length > 0) {
            plugins.push(...faviconPlugins);

            // remove starting slash
            plugins.push(new CustomizeAssetsHtmlWebpackPlugin({
                removeStartingSlash: true
            }));
        }
    }

    // Config
    //
    const webpackDllConfig = {
        entry: entryPoints,
        output: {
            libraryTarget: appConfig.target === 'node' ? 'commonjs2' : 'var'
        },
        module: {
            rules: rules
        },
        plugins: plugins
    };

    return webpackDllConfig;
}