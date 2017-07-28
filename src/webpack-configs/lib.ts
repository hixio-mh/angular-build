import * as path from 'path';
import * as webpack from 'webpack';
import * as webpackMerge from 'webpack-merge';

import { LibProjectConfig } from '../models';
import { Logger } from '../utils';

import { getAngularTypescriptWebpackConfigPartial } from './angular';
import { getCommonWebpackConfigPartial } from './common';
import { getStylesWebpackConfigPartial } from './styles';

import { WebpackConfigOptions } from './webpack-config-options';

export function getLibWebpackConfig(webpackConfigOptions: WebpackConfigOptions): webpack.Configuration {
    const buildOptions = webpackConfigOptions.buildOptions;
    const environment = buildOptions.environment || {};
    const libConfig = webpackConfigOptions.projectConfig as LibProjectConfig;
    const logger = webpackConfigOptions.logger || new Logger();

    if (libConfig.projectType !== 'lib') {
        throw new Error(`The 'libConfig.projectType' must be 'lib'.`);
    }

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

    const configs = [
        getCommonWebpackConfigPartial(webpackConfigOptions),
        getStylesWebpackConfigPartial(webpackConfigOptions),
        getAngularTypescriptWebpackConfigPartial(webpackConfigOptions),
        getLibConfigPartial(webpackConfigOptions)
    ];

    return webpackMerge(configs as any);
}

export function getLibConfigPartial(webpackConfigOptions: WebpackConfigOptions): webpack.Configuration {
    const projectRoot = webpackConfigOptions.projectRoot;
    const libConfig = webpackConfigOptions.projectConfig as LibProjectConfig;

    const bundleRoot = webpackConfigOptions.bundleRoot || path.resolve(projectRoot, libConfig.srcDir || '');
    const bundleEntryFile = webpackConfigOptions.bundleEntryFile || libConfig.entry || 'index.js';

    if (!webpackConfigOptions.bundleOutFileName) {
        throw new Error(`The 'webpackConfigOptions.bundleOutFileName' is required.`);
    }

    const webpackNonDllConfig: webpack.Configuration = {
        entry: path.resolve(bundleRoot, bundleEntryFile),
        output: {
            path: path.resolve(projectRoot,
                libConfig.outDir,
                webpackConfigOptions.bundleOutDir || ''),
            filename: webpackConfigOptions.bundleOutFileName
        }
    };

    return webpackNonDllConfig;
}
