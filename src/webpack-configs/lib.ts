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
        logger.log('\n');
        let msg = 'Using webpack lib config:';
        const envStr = Object.keys(environment).map(key => `${key}: ${environment[key]}`).join(', ');
        if (libConfig.main) {
            msg += `\nmain entry       - ${libConfig.main}`;
        }
        if (libConfig.platformTarget) {
            msg += `\nplatform target  - ${libConfig.platformTarget}`;
        }
        if (libConfig.libraryTarget) {
            msg += `\nlibrary format   - ${libConfig.libraryTarget}`;
        }
        if (envStr) {
            msg += `\nenvironment      - ${envStr}`;
        }
        logger.infoLine(msg);
        logger.log('\n');
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
    const bundleEntryFile = webpackConfigOptions.bundleEntryFile || libConfig.main;

    if (!bundleEntryFile) {
        throw new Error(`Them 'main' entry is required at lib config.`);
    }

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
