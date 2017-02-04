import * as path from 'path';
import * as fs from 'fs';

import * as webpack from 'webpack';

// ReSharper disable InconsistentNaming
const DllPlugin = require('webpack/lib/DllPlugin');
//const IgnorePlugin = require('webpack/lib/IgnorePlugin');

//const CheckerPlugin = require('awesome-typescript-loader').CheckerPlugin;
import { CheckerPlugin }  from 'awesome-typescript-loader';

const webpackMerge = require('webpack-merge');
// ReSharper restore InconsistentNaming

// Models
import { AppConfig, BuildOptions } from '../models';
import { CustomizeAssetsHtmlWebpackPlugin } from '../plugins/customize-assets-html-webpack-plugin';

// Helpers
import { parseDllEntries } from './helpers';

import { getCommonConfigPartial } from './common';
import { getAngularConfigPartial } from './angular';

import { getFaviconPlugins } from './favicons';

export function getDllConfig(projectRoot: string, appConfig: AppConfig, buildOptions: BuildOptions) {
    const configs = [
        getCommonConfigPartial(projectRoot, appConfig, buildOptions),
        getDllConfigPartial(projectRoot, appConfig, buildOptions),
        getAngularConfigPartial(projectRoot, appConfig, buildOptions)
    ];
    return webpackMerge(configs);
}

export function getDllConfigPartial(projectRoot: string, appConfig: AppConfig, buildOptions: BuildOptions) {
    const appRoot = path.resolve(projectRoot, appConfig.root);
    const hashFormat = appConfig.appendOutputHash ? `[chunkhash:${20}]` : 'lib';
    const entryPoints: { [key: string]: string[] } = {};

    let tsConfigPath = path.resolve(projectRoot, appConfig.root, appConfig.tsconfig || 'tsconfig.json');
    if (!fs.existsSync(tsConfigPath)) {
        tsConfigPath = path.resolve(projectRoot, 'tsconfig.json');
    }
    if (!fs.existsSync(tsConfigPath)) {
        tsConfigPath = null;
    }

    // Rules
    //
    const rules: any[] = [];

    // Entry
    //
    const dllEntries: any[] = [];
    if (appConfig.dlls) {
        if (Array.isArray(appConfig.dlls)) {
            dllEntries.push(...appConfig.dlls);
        } else {
            dllEntries.push(appConfig.dlls);
        }
    }
    if (appConfig.polyfills) {
        if (Array.isArray(appConfig.polyfills)) {
            dllEntries.push(...appConfig.polyfills);
        } else {
            dllEntries.push(appConfig.polyfills);
        }
    }

    const entries: string[] = [];
    let useTsLoader = false;
    parseDllEntries(appRoot, dllEntries, buildOptions.production).forEach(e => {
        if (e.tsPath) {
            useTsLoader = true;
            const tsEntry = `awesome-typescript-loader?${JSON.stringify({instance: `at-${appConfig.name || 'app'}-dll-loader`,configFileName: tsConfigPath})}!${e.tsPath}`;
            if (entries.indexOf(tsEntry) === -1) {
                entries.push(tsEntry);
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
    entryPoints[appConfig.dllChunkName] = entries;

    // Plugins
    //
    const plugins = [
        new DllPlugin({
            path: path.resolve(projectRoot, appConfig.outDir, `[name]-manifest.json`),
            name: `[name]_${hashFormat}`
        }),

        // Workaround for https://github.com/stefanpenner/es6-promise/issues/100
        new webpack.IgnorePlugin(/^vertx$/)

        // Workaround for https://github.com/andris9/encoding/issues/16
        //new NormalModuleReplacementPlugin(/\/iconv-loader$/, require.resolve('node-noop')))
    ];
    if (useTsLoader) {
        plugins.push(new CheckerPlugin());
    }

    // Favicons plugins
    if (typeof appConfig.faviconConfig !== 'undefined' &&
        appConfig.faviconConfig !== null &&
        appConfig.skipGenerateIcons !== false) {
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
        resolve: {
            extensions: ['.js']
            //modules: [appRoot, nodeModulesPath]
        },
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