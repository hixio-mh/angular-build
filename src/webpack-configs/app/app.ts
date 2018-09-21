// tslint:disable:no-any
// tslint:disable:no-unsafe-any

import * as path from 'path';

import * as webpack from 'webpack';
import * as webpackMerge from 'webpack-merge';

import { AngularBuildContextWebpackPlugin } from '../../plugins/angular-build-context-webpack-plugin';
import { TelemetryWebpackPlugin } from '../../plugins/telemetry-webpack-plugin';

import { AngularBuildContext } from '../../build-context';
import { InternalError } from '../../error-models';
import { getCustomWebpackConfig, isFromWebpackDevServer } from '../../helpers';
import { AppProjectConfigInternal } from '../../interfaces/internals';

import { getAppAngularTypescriptWebpackConfigPartial } from './angular';
import { getAppBrowserWebpackConfigPartial } from './browser';
import { getAppCommonWebpackConfigPartial } from './common';
import { getAppReferenceDllWebpackConfigPartial } from './reference-dll';
import { getAppStylesWebpackConfigPartial } from './styles';

export function getAppWebpackConfig(angularBuildContext: AngularBuildContext<AppProjectConfigInternal>): webpack.Configuration {
    const appConfig = angularBuildContext.projectConfig;
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

    const mergedConfig = webpackMerge(...configs);

    if (!mergedConfig.entry || (typeof mergedConfig.entry === 'object' && !Object.keys(mergedConfig.entry).length)) {
        mergedConfig.entry = isFromWebpackDevServer()
            ? [] as string[]
            : (() => ({})) as any;
    }

    return mergedConfig;
}

function getAppWebpackConfigPartial(angularBuildContext: AngularBuildContext<AppProjectConfigInternal>): webpack.Configuration {
    const appConfig = angularBuildContext.projectConfig;

    if (!appConfig._projectRoot) {
        throw new InternalError("The 'appConfig._projectRoot' is not set.");
    }

    const projectRoot = appConfig._projectRoot;

    // entry
    const entrypoints: { [key: string]: string[] } = {};

    if (appConfig.entry) {
        const mainChunkName = appConfig.mainChunkName || 'main';
        const mainEntry = path.resolve(projectRoot, appConfig.entry);
        entrypoints[mainChunkName] = [mainEntry];
    }

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
        plugins: plugins
    };

    if (Object.keys(entrypoints).length > 0) {
        webpackAppConfig.entry = entrypoints;
    }

    return webpackAppConfig;
}
