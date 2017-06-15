import * as path from 'path';
import * as webpack from 'webpack';

import * as webpackMerge from 'webpack-merge';

import { DllParsedEntry, parseDllEntry } from '../helpers';
import { AppProjectConfig, DllEntry } from '../models';
import { Logger } from '../utils';

import { getAngularConfigPartial } from './angular';
import {
    getChunksConfigPartial, getHtmlInjectConfigPartial, getGlobalScriptsConfigPartial,
    } from './browser';
import { getCommonConfigPartial } from './common';
import { getAppReferenceDllConfigPartial } from './reference-dll';
import { getStylesConfigPartial } from './styles';

import { WebpackConfigOptions } from './webpack-config-options';


export function getAppWebpackConfig(webpackConfigOptions: WebpackConfigOptions): webpack.Configuration {
    const buildOptions = webpackConfigOptions.buildOptions;
    const appConfig = webpackConfigOptions.projectConfig as AppProjectConfig;
    const environment = buildOptions.environment || {};
    const logger = webpackConfigOptions.logger || new Logger();

    if (!webpackConfigOptions.silent) {
        logger.log('\n');
        let msg = 'Using webpack app config:';
        const envStr = Object.keys(environment).map(key => `${key}: ${environment[key]}`).join(', ');
        if (appConfig.main) {
            msg += `\nmain entry       - ${appConfig.main}`;
        }
        if (appConfig.platformTarget) {
            msg += `\nplatform target  - ${appConfig.platformTarget}`;
        }
        if (appConfig.libraryTarget) {
            msg += `\nlibrary format   - ${appConfig.libraryTarget}`;
        }
        if (envStr) {
            msg += `\nenvironment      - ${envStr}`;
        }
        logger.infoLine(msg);
        logger.log('\n');
    }

    const configs: any[] = [
        getCommonConfigPartial(webpackConfigOptions),

        // browser only
        getChunksConfigPartial(webpackConfigOptions),
        getHtmlInjectConfigPartial(webpackConfigOptions),
        getGlobalScriptsConfigPartial(webpackConfigOptions),

        getStylesConfigPartial(webpackConfigOptions),

        getAppMainChunkConfigPartial(webpackConfigOptions),
        getAppReferenceDllConfigPartial(webpackConfigOptions),
        getAngularConfigPartial(webpackConfigOptions)

    ];

    return webpackMerge(configs);
}

export function getAppMainChunkConfigPartial(webpackConfigOptions: WebpackConfigOptions): webpack.Configuration {
    const projectRoot = webpackConfigOptions.projectRoot;
    const buildOptions = webpackConfigOptions.buildOptions;
    const appConfig = webpackConfigOptions.projectConfig as AppProjectConfig;
    const environment = buildOptions.environment || {};

    if (!appConfig.main) {
        return {};
    }

    const srcDir = path.resolve(projectRoot, appConfig.srcDir);
    const entryPoints: { [key: string]: string[] } = {};
    const mainChunkName = appConfig.mainOutFileName || 'main';

    // main entry
    const appMain = path.resolve(srcDir, appConfig.main);

    const dllEntries: any[] = [];
    if (appConfig.polyfills && appConfig.polyfills.length && appConfig.referenceDll) {
        Array.isArray(appConfig.polyfills)
            ? dllEntries.push(...appConfig.polyfills)
            : dllEntries.push(appConfig.polyfills);

    }

    if (appConfig.dlls && appConfig.dlls.length) {
        appConfig.dlls.filter(e => typeof e === 'object' && (e as DllEntry).importToMain)
            .forEach((dllEntry: DllEntry) => dllEntries.push(dllEntry));
    }

    const mainEntries: string[] = [];
    parseDllEntry(projectRoot, appConfig.srcDir || '', dllEntries, environment).forEach(
        (dllParsedEntry: DllParsedEntry) => {
            if (dllParsedEntry.tsPath && dllParsedEntry.tsPath.length) {
                if (mainEntries.indexOf(dllParsedEntry.tsPath) === -1) {
                    mainEntries.push(dllParsedEntry.tsPath);
                }
            } else {
                if (Array.isArray(dllParsedEntry.entry)) {
                    mainEntries.push(...dllParsedEntry.entry.filter((e: string) => mainEntries.indexOf(e) === -1));
                } else if (mainEntries.indexOf(dllParsedEntry.entry) === -1) {
                    mainEntries.push(dllParsedEntry.entry);
                }
            }
        });
    entryPoints[mainChunkName] = mainEntries.concat([appMain]);

    const webpackNonDllConfig: webpack.Configuration = {
        entry: entryPoints
    };

    return webpackNonDllConfig;
}
