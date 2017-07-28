import * as path from 'path';
import * as webpack from 'webpack';

import * as CopyWebpackPlugin from 'copy-webpack-plugin';
import * as webpackMerge from 'webpack-merge';

import { DllParsedEntry, parseAssetEntry, parseDllEntry } from '../helpers';
import { AppProjectConfig, DllEntry } from '../models';
import { Logger } from '../utils';

import { getAngularTypescriptWebpackConfigPartial, getAngularServiceWorkerWebpackConfigPartial } from './angular';
import { getChunksWebpackConfigPartial, getGlobalScriptsWebpackConfigPartial, getHtmlInjectWebpackConfigPartial } from
    './browser';
import { getCommonWebpackConfigPartial } from './common';
import { getAppReferenceDllWebpackConfigPartial } from './reference-dll';
import { getStylesWebpackConfigPartial } from './styles';

import { WebpackConfigOptions } from './webpack-config-options';

export function getAppWebpackConfig(webpackConfigOptions: WebpackConfigOptions): webpack.Configuration {
    const buildOptions = webpackConfigOptions.buildOptions;
    const environment = buildOptions.environment || {};
    const appConfig = webpackConfigOptions.projectConfig as AppProjectConfig;
    const logger = webpackConfigOptions.logger || new Logger();

    if (appConfig.projectType !== 'app') {
        throw new Error(`The 'appConfig.projectType' must be 'app'.`);
    }

    if (!webpackConfigOptions.silent) {
        let msg = 'Using webpack app config:';
        msg += ` main entry - ${webpackConfigOptions.bundleEntryFile || appConfig.entry}`;
        if (appConfig.platformTarget) {
            msg += `, platform target - ${appConfig.platformTarget}`;
        }
        if (appConfig.libraryTarget) {
            msg += `, library format - ${appConfig.libraryTarget}`;
        }
        if (Object.keys(environment)) {
            msg += `, environment - ${JSON.stringify(environment)}`;
        }
        logger.logLine(msg);
    }

    const configs = [
        getAppReferenceDllWebpackConfigPartial(webpackConfigOptions),

        getCommonWebpackConfigPartial(webpackConfigOptions),

        // browser only
        getHtmlInjectWebpackConfigPartial(webpackConfigOptions),
        getChunksWebpackConfigPartial(webpackConfigOptions),
        getGlobalScriptsWebpackConfigPartial(webpackConfigOptions),

        getStylesWebpackConfigPartial(webpackConfigOptions),
        getAngularTypescriptWebpackConfigPartial(webpackConfigOptions),
        getAngularServiceWorkerWebpackConfigPartial(webpackConfigOptions),
        getAppWithMainChunkWebpackConfigPartial(webpackConfigOptions)
    ];

    return webpackMerge(configs as any);
}

export function getAppWithMainChunkWebpackConfigPartial(webpackConfigOptions: WebpackConfigOptions): webpack.
    Configuration {
    const projectRoot = webpackConfigOptions.projectRoot;
    const buildOptions = webpackConfigOptions.buildOptions;
    const environment = buildOptions.environment || {};
    const appConfig = webpackConfigOptions.projectConfig as AppProjectConfig;

    if (!appConfig.entry) {
        throw new Error(`The 'appConfig.entry' is required.`);
    }

    const srcDir = path.resolve(projectRoot, appConfig.srcDir || '');
    const entryPoints: { [key: string]: string[] } = {};
    const mainChunkName = 'main';

    const appMain = path.resolve(srcDir, appConfig.entry);
    const mainEntries: string[] = [];
    const plugins: any[] = [];

    if ( appConfig.referenceDll) {
        const dllEntries: any[] = [];
        if (appConfig.polyfills && appConfig.polyfills.length) {
            const polyfills = Array.isArray(appConfig.polyfills) ? appConfig.polyfills : [appConfig.polyfills];
            polyfills.forEach((e: string) => dllEntries.push(e));
        }
        if (appConfig.dlls && appConfig.dlls.length) {
            appConfig.dlls.filter(e => typeof e === 'object' && (e as DllEntry).importToMain)
                .forEach((dllEntry: DllEntry) => dllEntries.push(dllEntry));
        }
        if (dllEntries.length) {
            parseDllEntry(projectRoot, srcDir, dllEntries, environment).forEach(
                (dllParsedEntry: DllParsedEntry) => {
                    if (dllParsedEntry.tsPath && dllParsedEntry.tsPath.length) {
                        if (mainEntries.indexOf(dllParsedEntry.tsPath) === -1) {
                            mainEntries.push(dllParsedEntry.tsPath);
                        }
                    } else {
                        if (Array.isArray(dllParsedEntry.entry)) {
                            mainEntries.push(
                                ...dllParsedEntry.entry.filter((e: string) => mainEntries.indexOf(e) === -1));
                        } else if (mainEntries.indexOf(dllParsedEntry.entry) === -1) {
                            mainEntries.push(dllParsedEntry.entry);
                        }
                    }
                });
        }
    }

    entryPoints[mainChunkName] = mainEntries.concat([appMain]);

    // copy assets
    const skipCopyAssets = !environment.dll &&
        !buildOptions.production &&
        appConfig.referenceDll;
    if (appConfig.assets &&
        appConfig.assets.length > 0 &&
        !skipCopyAssets) {
        const copyAssetOptions = parseAssetEntry(srcDir, appConfig.assets);
        if (copyAssetOptions && copyAssetOptions.length > 0) {
            plugins.push(new CopyWebpackPlugin(copyAssetOptions,
                {
                    ignore: ['**/.gitkeep']
                    // copyUnmodified: false
                }));
        }
    }

    const webpackAppConfig: webpack.Configuration = {
        entry: entryPoints,
        plugins: plugins
    };

    return webpackAppConfig;
}
