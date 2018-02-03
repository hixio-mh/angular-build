import * as path from 'path';

import * as webpack from 'webpack';

import { NamedLazyChunksWebpackPlugin } from '../../plugins/named-lazy-chunks-webpack-plugin';

import {
    AppBuildContext,
    AppProjectConfigInternal,
    PreDefinedEnvironment
} from '../../models';
import { isWebpackDevServer } from '../../helpers/is-webpack-dev-server';
import { getCustomWebpackConfig } from '../../helpers/get-custom-webpack-config';

import { getAppAngularTypescriptWebpackConfigPartial } from './angular';
import { getAppBrowserWebpackConfigPartial } from './browser';
import { getAppCommonWebpackConfigPartial } from './common';
import { getAppReferenceDllWebpackConfigPartial } from './reference-dll';
import { getAppStylesWebpackConfigPartial } from './styles';

const webpackMerge = require('webpack-merge');

export function getAppWebpackConfig(angularBuildContext: AppBuildContext): webpack.Configuration {
    const projectRoot = angularBuildContext.projectRoot;
    const appConfig = angularBuildContext.projectConfig as AppProjectConfigInternal;

    let customWebpackConfig: webpack.Configuration = {};
    if (appConfig.webpackConfig) {
        customWebpackConfig =
            getCustomWebpackConfig(path.resolve(projectRoot, appConfig.webpackConfig), angularBuildContext) || {};
    }

    const configs: webpack.Configuration[] = [
        // reference dll
        getAppReferenceDllWebpackConfigPartial(angularBuildContext),

        // common
        getAppCommonWebpackConfigPartial(angularBuildContext),
        getAppStylesWebpackConfigPartial(angularBuildContext),
        getAppAngularTypescriptWebpackConfigPartial(angularBuildContext),

        // browser only
        getAppBrowserWebpackConfigPartial(angularBuildContext),

        // Must be the last item(s) to merge
        getAppWebpackConfigPartial(angularBuildContext),
        customWebpackConfig
    ];

    const mergedConfig = webpackMerge(configs) as webpack.Configuration;

    if (!mergedConfig.entry || (typeof mergedConfig.entry === 'object' && !Object.keys(mergedConfig.entry).length)) {
        mergedConfig.entry = isWebpackDevServer() ? [] as string[] : (() => ({})) as any;
    }

    return mergedConfig;
}

export function getAppWebpackConfigPartial(angularBuildContext: AppBuildContext): webpack.Configuration {
    const appConfig = angularBuildContext.projectConfig as AppProjectConfigInternal;

    if (!appConfig.entry) {
        return {};
    }

    const projectRoot = angularBuildContext.projectRoot;
    const environment = angularBuildContext.environment as PreDefinedEnvironment;
    const srcDir = path.resolve(projectRoot, appConfig.srcDir || '');

    // entry
    const mainChunkName = appConfig.mainEntryChunkName || 'main';
    const entryPoints: { [key: string]: string[] } = {};
    const mainEntry = path.resolve(srcDir, appConfig.entry);
    entryPoints[mainChunkName] = [mainEntry];

    // plugins
    const plugins: webpack.Plugin[] = [];

    // NamedLazyChunksWebpackPlugin
    if (appConfig.namedLazyChunks !== false) {
        plugins.push(new NamedLazyChunksWebpackPlugin());
    }

    // DefinePlugin
    let shouldDefineEnvVar = true;
    if (appConfig.environmentVariables === false) {
        shouldDefineEnvVar = false;
    }
    if (shouldDefineEnvVar) {
        const defaultEnvironments: { [key: string]: any } = {
            'process.env.NODE_ENV': environment.prod ? 'production' : JSON.stringify(process.env.NODE_ENV)
        };
        const envVariables = Object.assign({}, defaultEnvironments);

        if (appConfig.environmentVariables && typeof appConfig.environmentVariables === 'object') {
            const userEnvVariables = appConfig.environmentVariables as any;
            Object.keys(userEnvVariables)
                .filter((key: string) => !(`process.env.${key}` in defaultEnvironments))
                .forEach((key: string) => {
                    envVariables[`process.env.${key}`] = JSON.stringify(userEnvVariables[key]);
                });
        }

        plugins.push(
            new webpack.DefinePlugin(envVariables)
        );
    }

    const webpackAppConfig: webpack.Configuration = {
        entry: entryPoints,
        plugins: plugins
    };

    if (appConfig.externals && appConfig.platformTarget === 'node') {
        let externals = appConfig.externals as any;
        if (externals && typeof appConfig.externals === 'string') {
            externals = new RegExp(externals, 'i');
        }
        webpackAppConfig.externals = externals;
    }

    return webpackAppConfig;
}
