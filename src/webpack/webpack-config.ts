import * as path from 'path';
import * as fs from 'fs';

import { AngularAppConfig, AngularBuildOptions, AngularBuildConfig } from './models';
import { hasProdArg, isDllBuildFromNpmEvent, isAoTBuildFromNpmEvent } from './helpers';
import { readJsonSync } from '../utils';

import { getWebpackAngularConfig } from './webpack-angular-config';

const allowOverrideKeys = [
    'root', 'outDir', 'main', 'entry', 'assets', 'styles', 'scripts', 'tsconfig', 'index', 'publicPath',
    'htmlInjectOptions', 'faviconConfig', 'provide', 'referenceDll', 'moduleReplacements', 'enabled', 'appendOutputHash', 'compressAssets', 'copyAssets', 'generateIcons', 'sourceMap'
];

export function getWebpackConfigs(projectRoot: string, angularBuildConfig?: AngularBuildConfig, buildOptions?: AngularBuildOptions) {
    projectRoot = projectRoot || process.cwd();

    if (!angularBuildConfig) {
        let configFileExists = false;
        let configPath = 'angular-build.json';
        if (!fs.existsSync(path.resolve(projectRoot, configPath))) {
            const tmpConfigPath = 'angular-cli.json';
            if (fs.existsSync(path.resolve(projectRoot, tmpConfigPath))) {
                configPath = tmpConfigPath;
                configFileExists = true;
            }
        } else {
            configFileExists = true;
        }

        if (!configFileExists) {
            throw new Error(`'angular-build.json' or 'angular-cli.json' file could not be found in ${projectRoot}.`);
        }
        angularBuildConfig = readJsonSync(path.resolve(projectRoot, configPath));
    }

    // Merge buildOptions
    buildOptions = mergeBuildOptions(buildOptions);

    // Extends
    const appConfigs = angularBuildConfig.apps.map((app: AngularAppConfig) => {
        let cloneApp = Object.assign({}, app);
        if (cloneApp.extends) {
            const baseApps = angularBuildConfig.apps.filter((a: AngularAppConfig) => a.name === cloneApp.extends);
            if (baseApps && baseApps.length > 0) {
                const cloneBaseApp = Object.assign({}, baseApps[0]);
                cloneApp = Object.assign({}, cloneBaseApp, cloneApp);
            }
        }
        return cloneApp;
    });

    appConfigs.forEach((appConfig: AngularAppConfig) => {
        // Build target overrides
        mergeAppConfigWithBuildTargetOverrides(appConfig, buildOptions);
        // merge wit defaults
        mergeAppConfigWithDefaults(appConfig, buildOptions);
    });

    const webpackConfigs = appConfigs.filter((appConfig: AngularAppConfig) => appConfig.skip === false)
        .map((appConfig: AngularAppConfig) => {
            return getWebpackConfig(projectRoot, appConfig, buildOptions, true);
        });
    return webpackConfigs;
}

export function getWebpackConfig(projectRoot: string, appConfig: AngularAppConfig, buildOptions?: AngularBuildOptions, skipMerge?: boolean) {
    if (!skipMerge) {
        projectRoot = projectRoot || process.cwd();
        buildOptions = mergeBuildOptions(buildOptions);
        mergeAppConfigWithBuildTargetOverrides(appConfig, buildOptions);
        mergeAppConfigWithDefaults(appConfig, buildOptions);
    }

    buildOptions = buildOptions || {};

    if (!appConfig) {
        throw new Error(`'appConfig' is required.`);
    }
    if (typeof appConfig !== 'object') {
        throw new Error(`Invalid 'appConfig'. 'appConfig' must be an object, but passed ${typeof appConfig}.`);
    }
    if (!buildOptions.dll &&
        !appConfig.main &&
        (!appConfig.styles || !appConfig.styles.length) &&
        (!appConfig.scripts || !appConfig.scripts.length)) {
        throw new Error(`No entry. Please set entry in appConfig.`);
    }
    if (buildOptions.dll && (!appConfig.dlls || !appConfig.dlls.length)) {
        throw new Error(`No dll entry. Please set dll entries in appConfig.`);
    }

    // Set defaults
    appConfig.root = appConfig.root || projectRoot;
    appConfig.outDir = appConfig.outDir || appConfig.root;

    return getWebpackAngularConfig(projectRoot, appConfig, buildOptions);
}

function mergeBuildOptions(buildOptions: AngularBuildOptions): AngularBuildOptions {
    const defaultBuildOptions: AngularBuildOptions = {
        production: hasProdArg(),
        dll: isDllBuildFromNpmEvent(),
        aot: isAoTBuildFromNpmEvent()
    };
    return Object.assign(defaultBuildOptions, buildOptions || {});
}

function overrideAppConfig(appConfig: any, newConfig: any) {
    if (!newConfig) {
        return;
    }

    for (let k in newConfig) {
        if (newConfig.hasOwnProperty(k) && allowOverrideKeys.indexOf(k) > -1) {
            appConfig[k] = newConfig[k];
        }
    }
}

function mergeAppConfigWithBuildTargetOverrides(appConfig: AngularAppConfig, buildOptions: AngularBuildOptions) {
    if (!appConfig || !appConfig.buildTargetOverrides) {
        return;
    }
    Object.keys(appConfig.buildTargetOverrides).forEach((buildTargetKey: string) => {
        switch (buildTargetKey.toLowerCase()) {
            case 'prod':
            case 'production':
                if (buildOptions.production) {
                    const newConfig = appConfig.buildTargetOverrides[buildTargetKey];
                    overrideAppConfig(appConfig, newConfig);
                }
                break;
            case 'dev':
            case 'development':
                if (!buildOptions.production) {
                    const newConfig = appConfig.buildTargetOverrides[buildTargetKey];
                    overrideAppConfig(appConfig, newConfig);
                }
                break;
            case 'dll':
                if (!buildOptions.dll) {
                    const newConfig = appConfig.buildTargetOverrides[buildTargetKey];
                    overrideAppConfig(appConfig, newConfig);
                }
                break;
            case 'aot':
                if (!buildOptions.dll) {
                    const newConfig = appConfig.buildTargetOverrides[buildTargetKey];
                    overrideAppConfig(appConfig, newConfig);
                }
                break;
            default:
                break;
        }
    });
}

function mergeAppConfigWithDefaults(appConfig: AngularAppConfig, buildOptions: AngularBuildOptions) {
    if (!appConfig) {
        return;
    }

    appConfig.scripts = appConfig.scripts || ([] as string[]);
    appConfig.styles = appConfig.styles || ([] as string[]);
    appConfig.dllOutChunkName = appConfig.dllOutChunkName || 'vendor';
    if (appConfig.publicPath || appConfig.publicPath === '') {
        appConfig.publicPath = /\/$/.test(appConfig.publicPath) ? appConfig.publicPath : appConfig.publicPath + '/';
    }
    appConfig.htmlInjectOptions = appConfig.htmlInjectOptions || {};
    appConfig.target = appConfig.target || 'web';

    if (typeof appConfig.referenceDll === 'undefined' || appConfig.referenceDll === null) {
        appConfig.referenceDll = !buildOptions.production && !buildOptions.aot && appConfig.dlls && appConfig.dlls.length > 0;
    }
    if (typeof appConfig.skipCopyAssets === 'undefined' || appConfig.skipCopyAssets === null) {
      appConfig.skipCopyAssets = !buildOptions.dll && !buildOptions.production && appConfig.referenceDll;
    }
    if (typeof appConfig.skipGenerateIcons === 'undefined' || appConfig.skipGenerateIcons === null) {
      appConfig.skipGenerateIcons = !buildOptions.dll && !buildOptions.production && appConfig.referenceDll;
    }
    if (typeof appConfig.sourceMap === 'undefined' || appConfig.sourceMap === null) {
        appConfig.sourceMap = !buildOptions.production;
    }
    if (typeof appConfig.compressAssets === 'undefined' || appConfig.compressAssets === null) {
        appConfig.compressAssets = buildOptions.production;
    }
    if (typeof appConfig.appendVersionHash === 'undefined' || appConfig.appendVersionHash === null) {
        // is asp.net
        appConfig.appendVersionHash = buildOptions.production;
        if (appConfig.htmlInjectOptions &&
            appConfig.htmlInjectOptions.customTagAttributes &&
            // ReSharper disable once CoercedEqualsUsing
            appConfig.htmlInjectOptions.customTagAttributes
                .find(c => (c.tagName === 'link' || c.tagName === 'script') &&
                    c.attribute &&
                    c.attribute['asp-append-version'] == true)) {
            appConfig.appendVersionHash = false;
        }
    }
}