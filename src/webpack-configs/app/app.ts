import * as path from 'path';
import * as webpack from 'webpack';

import { AngularBuildContextWebpackPlugin } from '../../plugins/angular-build-context-webpack-plugin';
import { TelemetryWebpackPlugin } from '../../plugins/telemetry-webpack-plugin';

import { AngularBuildContext, AppProjectConfigInternal } from '../../build-context';
import { isFromWebpackDevServer, getCustomWebpackConfig } from '../../helpers';

import { getAppAngularTypescriptWebpackConfigPartial } from './angular';
import { getAppBrowserWebpackConfigPartial } from './browser';
import { getAppCommonWebpackConfigPartial } from './common';
import { getAppReferenceDllWebpackConfigPartial } from './reference-dll';
import { getAppStylesWebpackConfigPartial } from './styles';

const webpackMerge = require('webpack-merge');

export function
    getAppWebpackConfig<TConfig extends AppProjectConfigInternal>(angularBuildContext: AngularBuildContext<TConfig>):
    webpack.Configuration {
    const appConfig = angularBuildContext.projectConfig as AppProjectConfigInternal;
    let customWebpackConfig: webpack.Configuration = {};

    if (appConfig.webpackConfig) {
        const customWebpackConfigPath =
            path.resolve(AngularBuildContext.workspaceRoot, appConfig.root || '', appConfig.webpackConfig);
        customWebpackConfig =
            getCustomWebpackConfig(customWebpackConfigPath, angularBuildContext) || {};
    }

    const configs: webpack.Configuration[] = [
        // reference dll
        getAppReferenceDllWebpackConfigPartial(angularBuildContext),
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
        mergedConfig.entry = isFromWebpackDevServer()
            ? [] as string[]
            : (() => ({})) as any;
    }

    return mergedConfig;
}

function getAppWebpackConfigPartial<TConfig extends AppProjectConfigInternal>(angularBuildContext:
    AngularBuildContext<TConfig>): webpack.Configuration {
    const appConfig = angularBuildContext.projectConfig as AppProjectConfigInternal;

    if (!appConfig.entry) {
        return {};
    }

    const projectRoot = path.resolve(AngularBuildContext.workspaceRoot, appConfig.root || '');

    // entry
    const mainChunkName = appConfig.mainChunkName || 'main';
    const entryPoints: { [key: string]: string[] } = {};
    const mainEntry = path.resolve(projectRoot, appConfig.entry);
    entryPoints[mainChunkName] = [mainEntry];

    // plugins
    const plugins: webpack.Plugin[] = [
        new AngularBuildContextWebpackPlugin(angularBuildContext)
    ];

    // telemetry plugin
    if (!AngularBuildContext.telemetryPluginAdded) {
        AngularBuildContext.telemetryPluginAdded = true;
        plugins.push(new TelemetryWebpackPlugin());
    }

    const webpackAppConfig: webpack.Configuration = {
        entry: entryPoints,
        plugins: plugins
    };

    return webpackAppConfig;
}
