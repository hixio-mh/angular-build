import * as path from 'path';
import * as fs from 'fs';
import * as chalk from 'chalk';
import * as ajv from 'ajv';

import { AppConfig, BuildOptions, AngularBuildConfig } from '../models';
import { readJsonSync } from '../utils';
import { hasProdArg, isDllBuildFromNpmEvent, isAoTBuildFromNpmEvent, isUniversalBuildFromNpmEvent } from './helpers';
import { getDllConfig } from './dll';
import { getNonDllConfig } from './non-dll';

// ReSharper disable once CommonJsExternalModule
const schema = require('../../configs/schema.json');

export function getWebpackConfigs(projectRoot?: string, angularBuildConfig?: AngularBuildConfig, buildOptions?: BuildOptions) {
    buildOptions = buildOptions || {};
    const appConfigs = getAppConfigs(projectRoot, angularBuildConfig, buildOptions);
    if (appConfigs.length === 0) {
        return null;
    }

    return appConfigs
        .map((appConfig: AppConfig) => {
            return getWebpackConfig(projectRoot, appConfig, buildOptions, true);
        });
}

export function getAppConfigs(projectRoot?: string, angularBuildConfig?: AngularBuildConfig, buildOptions?: BuildOptions) {
    projectRoot = projectRoot ? path.resolve(projectRoot) : process.cwd();

    // Merge buildOptions
    buildOptions = buildOptions || {};
    buildOptions = mergeBuildOptionsWithDefaults(buildOptions);

    if (!angularBuildConfig) {
        let configFilePath = path.resolve(projectRoot, 'angular-build.json');
        if (!fs.existsSync(configFilePath)) {
            configFilePath = path.resolve(projectRoot, 'angular-cli.json');
        }

        if (!configFilePath || !fs.existsSync(configFilePath)) {
            throw new Error(`'angular-build.json' or 'angular-cli.json' file could not be found in ${projectRoot}.`);
        }

        angularBuildConfig = readJsonSync(path.resolve(projectRoot, configFilePath));
        buildOptions.configFilePath = configFilePath;
    }

    if (schema['$schema']) {
        delete schema['$schema'];
    }

    if ((angularBuildConfig as any)['$schema']) {
        delete (angularBuildConfig as any)['$schema'];
    }

    const validate = ajv().compile(schema);
    const valid = validate(angularBuildConfig);
    if (!valid) {
        const errMsg = validate.errors.map(e => `Data path ${e.dataPath} ${e.message}.`).reduce((p, c) => p + '\n' + c);
        throw new Error(`${buildOptions
            .configFilePath
            ? `Invalid configuration at ${buildOptions.configFilePath}.\n`
            : ''} ${errMsg}\n`);
    }

    if (typeof angularBuildConfig.buildOptions === 'object' && Object.keys(angularBuildConfig.buildOptions).length) {
        const buildOptionsSchema = schema.definitions.BuildOptions.properties;
        const buildOptionsDynamic = angularBuildConfig.buildOptions as any;
        const newBuildOptions: any = {};
        Object.keys(buildOptionsDynamic)
            .filter((key: string) => buildOptionsSchema[key] &&
                typeof buildOptionsDynamic[key] !== 'undefined' &&
                buildOptionsDynamic[key] !== null &&
                buildOptionsDynamic[key] !== '')
            .forEach((key: string) => {
                newBuildOptions[key] = buildOptionsDynamic[key];
            });

        buildOptions = Object.assign(buildOptions, newBuildOptions);
    }

    // Extends
    const appConfigs = angularBuildConfig.apps.map((appConfig: AppConfig) => {
        let cloneAppConfig = Object.assign({}, appConfig);
        const extendName = cloneAppConfig.extends;
        if (extendName) {
            let baseApp = angularBuildConfig.apps.find((app: AppConfig) => app.name === extendName);
            if (!baseApp && extendName === 'default') {
                const defaultAngularBuildConfig: AngularBuildConfig = readJsonSync(require.resolve('../../configs/angular-build.json'));
                baseApp = defaultAngularBuildConfig.apps[0];
            }
            if (baseApp) {
                const cloneBaseApp = Object.assign({}, baseApp);
                delete cloneBaseApp.name;
                if (cloneBaseApp.extends) {
                    delete cloneBaseApp.extends;
                }
                cloneAppConfig = Object.assign({}, cloneBaseApp, cloneAppConfig);
            }
        }
        return cloneAppConfig;
    });

    appConfigs.forEach((appConfig: AppConfig) => {
        // Build target overrides
        mergeAppConfigWithBuildTargetOverrides(appConfig, buildOptions);
        // merge wit defaults
        mergeAppConfigWithDefaults(projectRoot, appConfig, buildOptions);
    });

    const filterApps: string[] = [];
    if (buildOptions.app && Array.isArray(buildOptions.app)) {
        filterApps.push(...buildOptions.app);
    } else if (typeof buildOptions.app === 'string') {
        filterApps.push(buildOptions.app);
    }


    return appConfigs
        .filter((appConfig: AppConfig) => !appConfig.skip &&
        (filterApps.length === 0 ||
            (filterApps.length > 0 && appConfig.name && filterApps.indexOf(appConfig.name) > -1)));
}

export function getWebpackConfig(projectRoot: string, appConfig: AppConfig, buildOptions?: BuildOptions, skipMerge?: boolean) {
    if (!skipMerge) {
        projectRoot = projectRoot ? path.resolve(projectRoot) : process.cwd();
        buildOptions = mergeBuildOptionsWithDefaults(buildOptions);
        mergeAppConfigWithBuildTargetOverrides(appConfig, buildOptions);
        mergeAppConfigWithDefaults(projectRoot, appConfig, buildOptions);
    }

    buildOptions = buildOptions || mergeBuildOptionsWithDefaults({}) || {};

    if (!projectRoot) {
        throw new Error(`'projectRoot' is required.`);
    }

    if (!appConfig) {
        throw new Error(`'appConfig' is required.`);
    }

    if (!appConfig.root) {
        throw new Error(`No 'root' folder is specified. Please set 'root' folder name in appConfig.`);
    }

    if (!appConfig.outDir) {
        throw new Error(`No 'outDir' folder is specified. Please set 'outDir' folder name in appConfig.`);
    }

    if (appConfig.outDir === appConfig.root ||
        path.resolve(projectRoot, appConfig.outDir) === path.resolve(projectRoot, appConfig.root)) {
        throw new Error(`'outDir' must not be the same as 'root'.`);
    }

    if (path.resolve(projectRoot, appConfig.outDir) === path.resolve(projectRoot)) {
        throw new Error(`'outDir' must not be the same as 'projectRoot'.`);
    }

    if (!buildOptions.dll &&
        !appConfig.main &&
        (!appConfig.styles || !appConfig.styles.length) &&
        (!appConfig.scripts || !appConfig.scripts.length) &&
        (!appConfig.polyfills || !appConfig.polyfills.length)) {
        throw new Error(`No entry is specified for this build. Please set main entry in appConfig.`);
    }

    if (buildOptions.dll &&
        (!appConfig.dlls || !appConfig.dlls.length) &&
        (!appConfig.polyfills || !appConfig.polyfills.length)) {
        throw new Error(`No dll entry. Please set dll entry in appConfig.`);
    }

    return buildOptions.dll ? getDllConfig(projectRoot, appConfig, buildOptions) : getNonDllConfig(projectRoot, appConfig, buildOptions);
}

// Private functions
function mergeBuildOptionsWithDefaults(buildOptions: BuildOptions): BuildOptions {
    const defaultBuildOptions: BuildOptions = {
        production: hasProdArg() || isAoTBuildFromNpmEvent() || process.argv.indexOf('--aot') > -1,
        aot: isAoTBuildFromNpmEvent() || process.argv.indexOf('--aot') > -1,
        universal: isUniversalBuildFromNpmEvent() || process.argv.indexOf('--universal') > -1,
        dll: isDllBuildFromNpmEvent() || process.argv.indexOf('--dll') > -1,
        verbose: process.argv.indexOf('--verbose') > -1,
        progress: process.argv.indexOf('--progress') > -1,
        performanceHint: hasProdArg() ||
            process.argv.indexOf('--performance-hint') > -1 ||
            process.argv.indexOf('--performanceHint') > -1
    };

    if (typeof buildOptions === 'object' && Object.keys(buildOptions).length) {
        const buildOptionsSchema = schema.definitions.BuildOptions.properties;
        const buildOptionsDynamic = buildOptions as any;
        const newBuildOptions: any = {};
        Object.keys(buildOptionsDynamic)
            .filter((key: string) => (buildOptionsSchema[key] || key === 'webpackIsGlobal') &&
                typeof buildOptionsDynamic[key] !== 'undefined' &&
                buildOptionsDynamic[key] !== null &&
                buildOptionsDynamic[key] !== '')
            .forEach((key: string) => {
                newBuildOptions[key] = buildOptionsDynamic[key];
            });

        buildOptions = Object.assign(buildOptions, defaultBuildOptions, newBuildOptions);
        return buildOptions;
    } else {
        buildOptions = Object.assign(buildOptions || {}, defaultBuildOptions);
        return buildOptions;
    }
}

function overrideAppConfig(appConfig: any, newConfig: any) {
    if (!newConfig || !appConfig || typeof newConfig !== 'object' || Object.keys(newConfig).length === 0) {
        return;
    }

    const appConfigSchema: any = schema.definitions.AppConfigOverridable.properties;
    const allowKeys = Object.keys(appConfigSchema);
    Object.keys(newConfig).filter((key: string) => allowKeys.indexOf(key) > -1).forEach((key: string) => {
        appConfig[key] = newConfig[key];
    });

}

function mergeAppConfigWithBuildTargetOverrides(appConfig: AppConfig, buildOptions: BuildOptions) {
    if (!appConfig || !appConfig.buildTargetOverrides || Object.keys(appConfig.buildTargetOverrides).length === 0) {
        return;
    }

    Object.keys(appConfig.buildTargetOverrides).forEach((buildTargetKey: string) => {
        switch (buildTargetKey.toLowerCase()) {
            case 'dll':
                if (buildOptions.dll) {
                    const newConfig = appConfig.buildTargetOverrides.dll;
                    overrideAppConfig(appConfig, newConfig);
                }
                break;
            case 'dev':
            case 'development':
                if (!buildOptions.production) {
                    const newConfig = appConfig.buildTargetOverrides.dev;
                    overrideAppConfig(appConfig, newConfig);
                }
                break;
            case 'prod':
            case 'production':
                if (buildOptions.production) {
                    const newConfig = appConfig.buildTargetOverrides.prod;
                    overrideAppConfig(appConfig, newConfig);
                }
                break;
            case 'aot':
                if (buildOptions.aot) {
                    const newConfig = appConfig.buildTargetOverrides.aot;
                    overrideAppConfig(appConfig, newConfig);
                }
                break;
            case 'universal':
                if (buildOptions.aot) {
                    const newConfig = appConfig.buildTargetOverrides.universal;
                    overrideAppConfig(appConfig, newConfig);
                }
                break;
            default:
                break;
        }
    });
}

function mergeAppConfigWithDefaults(projectRoot: string, appConfig: AppConfig, buildOptions: BuildOptions) {
    if (!projectRoot) {
        throw new Error(`'projectRoot' is required.`);
    }

    if (!appConfig) {
        throw new Error(`'appConfig' is required.`);
    }

    if (!buildOptions) {
        throw new Error(`'buildOptions' is required.`);
    }

    if (!appConfig.root) {
        throw new Error(`No 'root' folder is specified. Please set 'root' folder name in appConfig.`);
    }

    if (!appConfig.outDir) {
        throw new Error(`No 'outDir' folder is specified. Please set 'outDir' folder name in appConfig.`);
    }

    appConfig.root = path.relative(projectRoot, appConfig.root);
    appConfig.outDir = path.relative(projectRoot, appConfig.outDir);

    if (appConfig.outDir === appConfig.root ||
        path.resolve(projectRoot, appConfig.outDir) === path.resolve(projectRoot, appConfig.root)) {
        throw new Error(`'outDir' must not be the same as 'root'.`);
    }

    if (path.resolve(projectRoot, appConfig.outDir) === path.resolve(projectRoot)) {
        throw new Error(`'outDir' must not be the same as 'projectRoot'.`);
    }

    appConfig.publicPath = appConfig.publicPath || appConfig.deployUrl;

    appConfig.polyfills = appConfig.polyfills || ([] as string[]);
    appConfig.scripts = appConfig.scripts || ([] as string[]);
    appConfig.styles = appConfig.styles || ([] as string[]);
    appConfig.dllChunkName = appConfig.dllChunkName || 'vendor';
    if (appConfig.publicPath || appConfig.publicPath === '') {
        appConfig.publicPath = /\/$/.test(appConfig.publicPath) ? appConfig.publicPath : appConfig.publicPath + '/';
    }

    appConfig.htmlInjectOptions = appConfig.htmlInjectOptions || {};
    appConfig.target = appConfig.target || 'web';

    if (typeof appConfig.referenceDll === 'undefined' || appConfig.referenceDll === null) {
        if (typeof buildOptions.referenceDll !== 'undefined' && buildOptions.referenceDll !== null) {
            appConfig.referenceDll = buildOptions.referenceDll;
        } else {
            appConfig.referenceDll = !buildOptions.production &&
                !buildOptions.aot &&
                appConfig.dlls &&
                appConfig.dlls.length > 0;
        }
    } else {
        if (buildOptions.aot && appConfig.referenceDll) {
            appConfig.referenceDll = false;
            console.warn(`\n${chalk.bgYellow('WARN:')} 'referenceDll' is automatically disabled in aot build.\n`);
        }
    }

    if (typeof appConfig.extractCss === 'undefined' || appConfig.extractCss === null) {
        if (!appConfig.target || appConfig.target === 'web') {
            if (typeof buildOptions.extractCss !== 'undefined' && buildOptions.extractCss !== null) {
                appConfig.extractCss = buildOptions.extractCss;
            } else {
                appConfig.extractCss = buildOptions.production;
            }
        } else {
            appConfig.extractCss = false;
        }
    }

    if (typeof appConfig.sourceMap === 'undefined' || appConfig.sourceMap === null) {
        if (typeof buildOptions.sourceMap !== 'undefined' && buildOptions.sourceMap !== null) {
            appConfig.sourceMap = buildOptions.sourceMap;
        } else {
            appConfig.sourceMap = !buildOptions.production;
        }
    }

    if (typeof appConfig.compressAssets === 'undefined' || appConfig.compressAssets === null) {
        if (typeof buildOptions.compressAssets !== 'undefined' && buildOptions.compressAssets !== null) {
            appConfig.compressAssets = buildOptions.compressAssets;
        } else {
            appConfig.compressAssets = buildOptions.production;
        }
    }

    if (typeof appConfig.appendOutputHash === 'undefined' || appConfig.appendOutputHash === null) {
        // is asp.net
        if (appConfig.htmlInjectOptions &&
            appConfig.htmlInjectOptions.customTagAttributes &&
            // ReSharper disable once CoercedEqualsUsing
            appConfig.htmlInjectOptions.customTagAttributes
                .find(c => (c.tagName === 'link' || c.tagName === 'script') &&
                    c.attribute &&
                    c.attribute['asp-append-version'] == true)) {
            appConfig.appendOutputHash = false;
        } else {
            if (typeof buildOptions.appendOutputHash !== 'undefined' && buildOptions.appendOutputHash !== null) {
                appConfig.appendOutputHash = buildOptions.appendOutputHash;
            } else {
                appConfig.appendOutputHash = buildOptions.production;
            }
        }
    }
}