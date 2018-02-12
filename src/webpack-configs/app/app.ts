import * as path from 'path';

import * as webpack from 'webpack';

import { NamedLazyChunksWebpackPlugin } from '../../plugins/named-lazy-chunks-webpack-plugin';

import {
    AngularBuildContext,
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

export function getAppWebpackConfig(angularBuildContext: AngularBuildContext, env?: PreDefinedEnvironment): webpack.Configuration {
    const projectRoot = AngularBuildContext.projectRoot;
    const appConfig = angularBuildContext.projectConfig as AppProjectConfigInternal;
    let customWebpackConfig: webpack.Configuration = {};

    if (appConfig.webpackConfig) {
        customWebpackConfig =
            getCustomWebpackConfig(path.resolve(projectRoot, appConfig.webpackConfig), angularBuildContext, env) || {};
    }

    const configs: webpack.Configuration[] = [
        // reference dll
        getAppReferenceDllWebpackConfigPartial(angularBuildContext, env),

        // common
        getAppCommonWebpackConfigPartial(angularBuildContext, env),
        getAppStylesWebpackConfigPartial(angularBuildContext, env),
        getAppAngularTypescriptWebpackConfigPartial(angularBuildContext, env),

        // browser only
        getAppBrowserWebpackConfigPartial(angularBuildContext, env),

        // Must be the last item(s) to merge
        getAppWebpackConfigPartial(angularBuildContext, env),
        customWebpackConfig
    ];

    const mergedConfig = webpackMerge(configs) as webpack.Configuration;

    if (!mergedConfig.entry || (typeof mergedConfig.entry === 'object' && !Object.keys(mergedConfig.entry).length)) {
        mergedConfig.entry = isWebpackDevServer() ? [] as string[] : (() => ({})) as any;
    }

    return mergedConfig;
}

function getAppWebpackConfigPartial(angularBuildContext: AngularBuildContext, env?: PreDefinedEnvironment): webpack.Configuration {
    const appConfig = angularBuildContext.projectConfig as AppProjectConfigInternal;

    if (!appConfig.entry) {
        return {};
    }

    const environment = env ? env as PreDefinedEnvironment : AngularBuildContext.environment;
    const projectRoot = AngularBuildContext.projectRoot;

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

    return webpackAppConfig;
}
