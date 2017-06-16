import * as path from 'path';
import * as webpack from 'webpack';

import * as webpackMerge from 'webpack-merge';

import { prepareAngularBuildConfig, prepareBuildOptions, readAngularBuildConfigSync } from '../helpers';
import { AngularBuildConfig, BuildOptions, ProjectConfig } from '../models';
import { Logger } from '../utils';

import { getAppWebpackConfig } from './app';
import { getAppDllConfig } from './dll';
import { getLibWebpackConfig } from './lib';

import { WebpackConfigOptions } from './webpack-config-options';

// re-exports
export * from './app';
export * from './lib';
export * from './webpack-config-options';

export function getAppWebpackConfigs(projectRoot: string,
    buildOptions?: BuildOptions,
    angularBuildConfig?: AngularBuildConfig,
    logger: Logger = new Logger()): webpack.Configuration[] {
    if (!angularBuildConfig || typeof angularBuildConfig !== 'object' || !Object.keys(angularBuildConfig).length) {
        angularBuildConfig = readAngularBuildConfigSync(projectRoot);
    }

    buildOptions = buildOptions || {};

    // Merge buildOptions
    if (angularBuildConfig.buildOptions) {
        Object.keys(angularBuildConfig.buildOptions)
            .filter((key: string) => !(key in (buildOptions as BuildOptions)) &&
                typeof ((angularBuildConfig as AngularBuildConfig).buildOptions as any)[key] !== 'undefined')
            .forEach((key: string) => {
                (buildOptions as any)[key] = ((angularBuildConfig as AngularBuildConfig).buildOptions as any)[key];
            });
    }
    prepareBuildOptions(buildOptions);
    prepareAngularBuildConfig(projectRoot, angularBuildConfig, buildOptions);

    const appConfigs = angularBuildConfig.apps || [];

    // apply filter
    const filterProjects: string[] = [];
    if (buildOptions.filter) {
        filterProjects.push(...Array.isArray(buildOptions.filter) ? buildOptions.filter : [buildOptions.filter]);
    }

    if (appConfigs.length === 0) {
        throw new Error('No app project config is available.');
    }

    const webpackIsGlobal = !!(buildOptions as any).webpackIsGlobal || !(buildOptions as any).cliIsLocal;

    const webpackConfigs = appConfigs.filter((projectConfig: ProjectConfig) =>
            !projectConfig.skip &&
            (filterProjects.length === 0 ||
            (filterProjects.length > 0 &&
                projectConfig.name &&
                filterProjects.indexOf(projectConfig.name) > -1)))
        .map((projectConfig: ProjectConfig) => getWebpackConfig({
            projectRoot: projectRoot as string,
            projectConfig: projectConfig as ProjectConfig,
            buildOptions: buildOptions as BuildOptions,
            angularBuildConfig: angularBuildConfig as AngularBuildConfig,
            logger,
            webpackIsGlobal
        }));

    if (webpackConfigs.length === 0) {
        throw new Error('No webpack config is available.');
    }

    return webpackConfigs;
}

export function getWebpackConfig(webpackConfigOptions: WebpackConfigOptions): webpack.Configuration {
    if (!webpackConfigOptions) {
        throw new Error(`The 'webpackConfigOptions' is required.`);
    }

    const projectRoot = webpackConfigOptions.projectRoot || process.cwd();
    const buildOptions = webpackConfigOptions.buildOptions;
    const projectConfig = webpackConfigOptions.projectConfig;
    const environment = buildOptions.environment || {};

    if (!environment.test && !projectConfig.outDir) {
        throw new Error(`The 'outDir' is required.`);
    }
    if (projectConfig.outDir && path.resolve(projectRoot, projectConfig.outDir) === path.resolve(projectRoot)) {
        throw new Error(`The 'outDir' must NOT be the same as project root directory.`);
    }
    if (projectConfig.outDir &&
        path.resolve(projectRoot, projectConfig.outDir) === path.resolve(projectRoot, projectConfig.srcDir || '')) {
        throw new Error(`The 'outDir' must NOT be the same as 'srcDir' directory.`);
    }

    let customWebpackConfig: any = null;
    if (projectConfig.webpackConfig) {
        const customWebpackModule = require(path.resolve(projectRoot, projectConfig.webpackConfig));
        if (customWebpackModule && customWebpackModule.default && typeof customWebpackModule.default === 'function') {
            customWebpackConfig = customWebpackModule.default(webpackConfigOptions);
        }
        if (customWebpackModule && typeof customWebpackModule === 'function') {
            customWebpackConfig = customWebpackModule(webpackConfigOptions);
        }
    }

    if (projectConfig.disableDefaultWebpackConfigs && !customWebpackConfig) {
        throw new Error(`No webpack config is provided.`);
    }

    if (projectConfig.disableDefaultWebpackConfigs && customWebpackConfig) {
        return customWebpackConfig;
    }

    if (projectConfig.projectType === 'app') {
        if (environment.test) {
            // TODO:
            throw new Error('NotImplemented');
        }

        if (environment.dll) {
            return customWebpackConfig
                ? webpackMerge(getAppDllConfig(webpackConfigOptions), customWebpackConfig)
                : getAppDllConfig(webpackConfigOptions);
        } else {
            return customWebpackConfig
                ? webpackMerge(getAppWebpackConfig(webpackConfigOptions), customWebpackConfig)
                : getAppWebpackConfig(webpackConfigOptions);
        }
    } else {
        if (environment.test) {
            // TODO:
            throw new Error('NotImplemented');
        }

        return customWebpackConfig
            ? webpackMerge(getLibWebpackConfig(webpackConfigOptions), customWebpackConfig)
            : getLibWebpackConfig(webpackConfigOptions);
    }
}
