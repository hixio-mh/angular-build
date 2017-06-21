import * as path from 'path';
import * as webpack from 'webpack';
import * as webpackMerge from 'webpack-merge';

import { LibProjectConfig } from '../models';
import { Logger } from '../utils';

import { getAngularConfigPartial } from './angular';
import { getCommonConfigPartial } from './common';
import { getStylesConfigPartial } from './styles';

import { WebpackConfigOptions } from './webpack-config-options';

export function getLibWebpackConfig(webpackConfigOptions: WebpackConfigOptions): webpack.Configuration {
    const buildOptions = webpackConfigOptions.buildOptions;
    const environment = buildOptions.environment || {};
    const libConfig = webpackConfigOptions.projectConfig as LibProjectConfig;
    const logger = webpackConfigOptions.logger || new Logger();

    if (!webpackConfigOptions.silent) {
        let msg = 'Using webpack lib config:';
        msg += ` main entry - ${webpackConfigOptions.bundleEntryFile || libConfig.entry || 'index.js'}`;
        if (libConfig.platformTarget) {
            msg += `, platform target - ${libConfig.platformTarget}`;
        }
        if (libConfig.libraryTarget) {
            msg += `, library format - ${libConfig.libraryTarget}`;
        }
        if (Object.keys(environment)) {
            msg += `, environment - ${JSON.stringify(environment)}`;
        }
        logger.logLine(msg);
    }

    const configs: any[] = [
        getCommonConfigPartial(webpackConfigOptions),
        getAngularConfigPartial(webpackConfigOptions),
        getStylesConfigPartial(webpackConfigOptions),
        getLibConfigPartial(webpackConfigOptions)
    ];

    return webpackMerge(configs);
}

export function getLibConfigPartial(webpackConfigOptions: WebpackConfigOptions): webpack.Configuration {
    const projectRoot = webpackConfigOptions.projectRoot;
    const libConfig = webpackConfigOptions.projectConfig as LibProjectConfig;

    const bundleRoot = webpackConfigOptions.bundleRoot || path.resolve(projectRoot, libConfig.srcDir || '');
    const bundleEntryFile = webpackConfigOptions.bundleEntryFile || libConfig.entry || 'index.js';

    if (!webpackConfigOptions.bundleOutFileName) {
        throw new Error(`The 'webpackConfigOptions.bundleOutFileName' is required.`);
    }

    const bundleEntryPath = path.resolve(bundleRoot, bundleEntryFile);
    const entryName = webpackConfigOptions.bundleOutFileName.replace(/\.(ts|tsx|js|jsx|css|scss|sass|less|styl)$/i, '');
    const mainChunkName = path.join(webpackConfigOptions.bundleOutDir || '', entryName);

    const entryPoints: { [key: string]: string[] } = {};
    entryPoints[mainChunkName] = [bundleEntryPath];

    const webpackNonDllConfig: webpack.Configuration = {
        entry: entryPoints
    };

    return webpackNonDllConfig;
}
