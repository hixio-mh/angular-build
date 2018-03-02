import * as path from 'path';

import * as webpack from 'webpack';

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

function getAppWebpackConfigPartial(angularBuildContext: AngularBuildContext): webpack.Configuration {
    const appConfig = angularBuildContext.projectConfig as AppProjectConfigInternal;

    if (!appConfig.entry) {
        return {};
    }

    const projectRoot = AngularBuildContext.projectRoot;

    const srcDir = path.resolve(projectRoot, appConfig.srcDir || '');

    // entry
    const mainChunkName = appConfig.mainChunkName || 'main';
    const entryPoints: { [key: string]: string[] } = {};
    const mainEntry = path.resolve(srcDir, appConfig.entry);
    entryPoints[mainChunkName] = [mainEntry];

    const webpackAppConfig: webpack.Configuration = {
        entry: entryPoints
    };

    return webpackAppConfig;
}
