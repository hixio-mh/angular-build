// tslint:disable:no-any
// tslint:disable:no-unsafe-any

import * as path from 'path';

import { Configuration, Plugin } from 'webpack';
import * as webpackMerge from 'webpack-merge';

import { AngularBuildContextWebpackPlugin } from '../../plugins/angular-build-context-webpack-plugin';

import { AngularBuildContext } from '../../build-context';
import { getCustomWebpackConfig, isFromWebpackDevServer } from '../../helpers';
import { InternalError } from '../../models/errors';
import { AppProjectConfigInternal } from '../../models/internals';

import { getAppAngularWebpackConfigPartial } from './angular';
import { getAppBrowserWebpackConfigPartial } from './browser';
import { getAppCommonWebpackConfigPartial } from './common';
import { getAppReferenceDllWebpackConfigPartial } from './reference-dll';
import { getAppStylesWebpackConfigPartial } from './styles';

export function getAppWebpackConfig(angularBuildContext: AngularBuildContext<AppProjectConfigInternal>): Configuration {
    const appConfig = angularBuildContext.projectConfig;
    let customWebpackConfig: Configuration = {};

    if (appConfig.webpackConfig) {
        const customWebpackConfigPath =
            path.resolve(AngularBuildContext.workspaceRoot, appConfig.root || '', appConfig.webpackConfig);
        customWebpackConfig =
            getCustomWebpackConfig(customWebpackConfigPath, angularBuildContext) || {};
    }

    const configs: Configuration[] = [
        // reference dll
        getAppReferenceDllWebpackConfigPartial(angularBuildContext),
        getAppCommonWebpackConfigPartial(angularBuildContext),
        getAppStylesWebpackConfigPartial(angularBuildContext),
        getAppAngularWebpackConfigPartial(angularBuildContext),

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

function getAppWebpackConfigPartial(angularBuildContext: AngularBuildContext<AppProjectConfigInternal>): Configuration {
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
    const plugins: Plugin[] = [
        new AngularBuildContextWebpackPlugin(angularBuildContext)
    ];

    const webpackAppConfig: Configuration = {
        plugins: plugins
    };

    if (Object.keys(entrypoints).length > 0) {
        webpackAppConfig.entry = entrypoints;
    }

    return webpackAppConfig;
}
