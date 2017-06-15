import * as path from 'path';
import * as webpack from 'webpack';

// plugins
import * as webpackMerge from 'webpack-merge';

// internal plugins
import { CustomizeAssetsHtmlWebpackPlugin } from '../plugins/customize-assets-html-webpack-plugin';
import { IconWebpackPlugin } from '../plugins/icon-webpack-plugin';

import { DllParsedEntry, parseIconOptions, parseDllEntry } from '../helpers';
import { AppProjectConfig } from '../models';
import { Logger } from '../utils';

import { getAngularConfigPartial } from './angular';
import { getCommonConfigPartial } from './common';
import { getStylesConfigPartial } from './styles';

import { WebpackConfigOptions } from './webpack-config-options';

export function getAppDllConfig(webpackConfigOptions: WebpackConfigOptions): webpack.Configuration {
    const buildOptions = webpackConfigOptions.buildOptions;
    const projectConfig = webpackConfigOptions.projectConfig;
    const environment = buildOptions.environment || {};
    const logger = webpackConfigOptions.logger || new Logger();

    if (!webpackConfigOptions.silent) {
        logger.log('\n');
        let msg = 'Using webpack dll config:';
        const envStr = Object.keys(environment).map(key => `${key}: ${environment[key]}`).join(', ');
        if (projectConfig.platformTarget) {
            msg += `\nplatform target  - ${projectConfig.platformTarget}`;
        }
        if (projectConfig.libraryTarget) {
            msg += `\nlibrary format   - ${projectConfig.libraryTarget}`;
        }
        if (envStr) {
            msg += `\nenvironment      - ${envStr}`;
        }
        logger.infoLine(msg);
        logger.log('\n');
    }

    const configs = [
        getCommonConfigPartial(webpackConfigOptions),
        getAppDllConfigPartial(webpackConfigOptions),
        getAngularConfigPartial(webpackConfigOptions),
        getStylesConfigPartial(webpackConfigOptions)
    ];

    return webpackMerge(configs);
}

export function getAppDllConfigPartial(webpackConfigOptions: WebpackConfigOptions): webpack.Configuration {
    const projectRoot = webpackConfigOptions.projectRoot;
    const buildOptions = webpackConfigOptions.buildOptions;
    const appConfig = webpackConfigOptions.projectConfig as AppProjectConfig;
    const environment = buildOptions.environment || {};

    if (!environment.dll) {
        return {};
    }

    const hashLibFormat = appConfig.platformTarget === 'web' && appConfig.appendOutputHash ? `[chunkhash]` : '';
    // TODO: to review
    const libraryName = appConfig.libraryName || `[name]_${hashLibFormat || 'lib'}`;

    const entryPoints: { [key: string]: string[] } = {};

    const vendorChunkName = appConfig.vendorChunkName || 'vendor';
    const polyfillsChunkName = appConfig.polyfillsChunkName || 'polyfills';

    const tsEntries: any[] = [];

    // vendor
    if (appConfig.dlls && appConfig.dlls.length) {
        const entries: string[] = [];
        parseDllEntry(projectRoot, appConfig.srcDir || '', appConfig.dlls, environment).forEach((dllParsedEntry: DllParsedEntry) => {
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

        if (entries.length === 0) {
            throw new Error(`No dll entry.`);
        }
        entryPoints[vendorChunkName] = entries;
    }

    // polyfills
    if (appConfig.polyfills && appConfig.polyfills.length) {
        const entries: string[] = [];
        parseDllEntry(projectRoot, appConfig.srcDir || '', appConfig.polyfills, environment).forEach(
            (e: any) => {
                if (e.tsPath) {
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

    // plugins
    const plugins = [
        new webpack.DllPlugin({
            context: projectRoot,
            path: path.resolve(projectRoot, appConfig.outDir, `[name]-manifest.json`),
            name: libraryName
        })
    ];

    // browser specific
    if (!appConfig.platformTarget || appConfig.platformTarget === 'web') {
        // favicons plugins
        const iconOptions = parseIconOptions(projectRoot, appConfig);
        if (iconOptions && iconOptions.masterPicture) {
            plugins.push(new IconWebpackPlugin(iconOptions));

            // remove starting slash
            plugins.push(new CustomizeAssetsHtmlWebpackPlugin({
                removeStartingSlash: true
            }));
        }
    }

    // webpack config
    const webpackDllConfig: webpack.Configuration = {
        entry: entryPoints,
        output: {
            library: libraryName
        },
        plugins: plugins
    };

    return webpackDllConfig;
}
