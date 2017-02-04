import * as path from 'path';
import * as fs from 'fs';
import * as ajv from 'ajv';

import { AppConfig, BuildOptions, AngularBuildConfig } from '../models';
import { readJsonSync } from '../utils';

import { hasProdArg, isDllBuildFromNpmEvent, isAoTBuildFromNpmEvent } from './helpers';

import { getDllConfig } from './dll';
import { getNonDllConfig } from './non-dll';

const disAllowOverrideKeys = [
    'name', 'extends', 'target', 'environments', 'buildTargetOverrides'
];

// ReSharper disable once InconsistentNaming
const SCHEMA_PATH = '../../configs/schema.json';

export function getWebpackConfigs(projectRoot: string, angularBuildConfig?: AngularBuildConfig, buildOptions?: BuildOptions) {
    projectRoot = projectRoot || process.cwd();

    // Merge buildOptions
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

    const schema = readJsonSync(require.resolve(SCHEMA_PATH));
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

    // Extends
    const appConfigs = angularBuildConfig.apps.map((appConfig: AppConfig) => {
        let cloneAppConfig = Object.assign({}, appConfig);
        const extendName = cloneAppConfig.extends;
        if (extendName) {
            let baseApp = angularBuildConfig.apps.find((app: AppConfig) => app.name === extendName);
            if (!baseApp && extendName === 'default') {
                const defaultAngularBuildConfig: AngularBuildConfig = readJsonSync(path.resolve(__dirname, '../../configs/angular-build.json'));
                baseApp = defaultAngularBuildConfig.apps[0];
            }
            if (baseApp) {
                const cloneBaseApp = Object.assign({}, baseApp);
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

    const filterApps : string[] = [];
    if (buildOptions.app && Array.isArray(buildOptions.app)) {
        filterApps.push(...buildOptions.app);
    } else if (typeof buildOptions.app === 'string') {
        filterApps.push(buildOptions.app);
    }

    const webpackConfigs = appConfigs
        .filter((appConfig: AppConfig) => !appConfig.skip &&
        (filterApps.length === 0 ||
            (filterApps.length > 0 && appConfig.name && filterApps.indexOf(appConfig.name) > -1)))
        .map((appConfig: AppConfig) => {
            return getWebpackConfig(projectRoot, appConfig, buildOptions, true);
        });
    return webpackConfigs;
}

export function getWebpackConfig(projectRoot: string, appConfig: AppConfig, buildOptions?: BuildOptions, skipMerge?: boolean) {
    if (!skipMerge) {
        projectRoot = projectRoot || process.cwd();
        buildOptions = mergeBuildOptionsWithDefaults(buildOptions);
        mergeAppConfigWithBuildTargetOverrides(appConfig, buildOptions);
        mergeAppConfigWithDefaults(projectRoot, appConfig, buildOptions);
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

    return buildOptions.dll ? getDllConfig(projectRoot, appConfig, buildOptions) : getNonDllConfig(projectRoot, appConfig, buildOptions);
}

// Private functions
function mergeBuildOptionsWithDefaults(buildOptions: BuildOptions): BuildOptions {
    const defaultBuildOptions: BuildOptions = {
        production: hasProdArg(),
        dll: isDllBuildFromNpmEvent(),
        aot: isAoTBuildFromNpmEvent() || hasProdArg(),
        verbose: false,
        progress: false,
        performanceHint: hasProdArg()
    };
    return Object.assign(defaultBuildOptions, buildOptions || {});
}

function overrideAppConfig(appConfig: any, newConfig: any) {
    if (!newConfig || !appConfig || typeof newConfig !== 'object') {
        return;
    }

    Object.keys(newConfig).filter((key: string) => disAllowOverrideKeys.indexOf(key) === -1).forEach((key: string) => {
        appConfig[key] = newConfig[key];
    });

}

function mergeAppConfigWithBuildTargetOverrides(appConfig: AppConfig, buildOptions: BuildOptions) {
    if (!appConfig || !appConfig.buildTargetOverrides) {
        return;
    }
    Object.keys(appConfig.buildTargetOverrides).forEach((buildTargetKey: string) => {
        switch (buildTargetKey.toLowerCase()) {
            case 'prod':
            case 'production':
                if (buildOptions.production) {
                    const newConfig = appConfig.buildTargetOverrides.prod;
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
            case 'dll':
                if (!buildOptions.dll) {
                    const newConfig = appConfig.buildTargetOverrides.dll;
                    overrideAppConfig(appConfig, newConfig);
                }
                break;
            case 'aot':
                if (!buildOptions.dll) {
                    const newConfig = appConfig.buildTargetOverrides.aot;
                    overrideAppConfig(appConfig, newConfig);
                }
                break;
            default:
                break;
        }
    });
}

function mergeAppConfigWithDefaults(projectRoot: string, appConfig: AppConfig, buildOptions: BuildOptions) {
    if (!appConfig || !buildOptions) {
        return;
    }

    appConfig.root = appConfig.root || projectRoot;
    appConfig.outDir = appConfig.outDir || appConfig.root;
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
            appConfig.referenceDll = !buildOptions.production && !buildOptions.aot && appConfig.dlls && appConfig.dlls.length > 0;
        }
    }
    if (typeof appConfig.skipCopyAssets === 'undefined' || appConfig.skipCopyAssets === null) {
        if (typeof buildOptions.skipCopyAssets !== 'undefined' && buildOptions.skipCopyAssets !== null) {
            appConfig.skipCopyAssets = buildOptions.skipCopyAssets;
        } else {
            appConfig.skipCopyAssets = !buildOptions.dll && !buildOptions.production && appConfig.referenceDll;
        }
    }
    if (typeof appConfig.skipGenerateIcons === 'undefined' || appConfig.skipGenerateIcons === null) {
        if (typeof buildOptions.skipGenerateIcons !== 'undefined' && buildOptions.skipGenerateIcons !== null) {
            appConfig.skipGenerateIcons = buildOptions.skipGenerateIcons;
        } else {
            appConfig.skipGenerateIcons = !buildOptions.dll && !buildOptions.production && appConfig.referenceDll;
        }
    }
    if (typeof appConfig.extractCss === 'undefined' || appConfig.extractCss === null) {
        if (typeof buildOptions.extractCss !== 'undefined' && buildOptions.extractCss !== null) {
            appConfig.extractCss = buildOptions.extractCss;
        } else {
            appConfig.extractCss = buildOptions.production;
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