import * as path from 'path';
import * as fs from 'fs';
import * as chalk from 'chalk';
import * as ajv from 'ajv';
const webpackMerge = require('webpack-merge');

import { AppConfig, BuildOptions, AngularBuildConfig, AssetEntry, GlobalScopedEntry } from './models';
import { readJsonSync } from './utils';
import { hasProdFlag, hasDevFlag, isDllBuildFromNpmEvent, isAoTBuildFromNpmEvent, isUniversalBuildFromNpmEvent,
    isTestBuildFromNpmEvent, parseCopyAssetEntry, parseGlobalScopedEntry } from './helpers';
import {getDllConfig} from './webpack-configs/dll';
import { getNonDllConfig } from './webpack-configs/non-dll';
import { getTestConfig } from './webpack-configs/test';


// ReSharper disable once CommonJsExternalModule
const schema = require('../configs/schema.json');

export function getKarmaConfigOptions(projectRoot: string) {
    const buildOptions: BuildOptions = { test: true };
    const angularBuildConfig = getAngularBuildConfig(projectRoot);

    const appConfigs = getAppConfigs(projectRoot, buildOptions, angularBuildConfig);
    if (!appConfigs || appConfigs.length === 0) {
        throw new Error('No test app is configured.');
    }

    const appConfig = appConfigs[0];
    let codeCoverage = false;
    if (angularBuildConfig.test && angularBuildConfig.test.codeCoverage) {
        if (typeof angularBuildConfig.test.codeCoverage === 'boolean') {
            codeCoverage = angularBuildConfig.test.codeCoverage;
        } else if (typeof angularBuildConfig.test.codeCoverage === 'object' && !angularBuildConfig.test.codeCoverage.disabled) {
            codeCoverage = true;
        }
    }

    const testWebpackConfigs = getWebpackConfig(projectRoot, appConfig, buildOptions, angularBuildConfig, true);
    const appRoot = path.resolve(projectRoot, appConfig.root);

    const files: any[] = [];
    const preprocessors: any = {};

    let filePattern = path.relative(projectRoot, path.resolve(projectRoot, appConfig.root, appConfig.test));
    filePattern = filePattern.replace(/\\/g, '/');
    if (!filePattern.startsWith('./')) {
        filePattern = `./${filePattern}`;
    }
    preprocessors[filePattern] = ['webpack', 'sourcemap'];
    files.push({ pattern: filePattern, watched: false });

    // Polyfills
    //if (appConfig.polyfills && appConfig.polyfills.length > 0) {
    //    if (typeof appConfig.polyfills === 'string') {
    //        const polyfillsFile = path.resolve(appRoot, appConfig.polyfills);
    //        preprocessors[polyfillsFile] = ['webpack', 'sourcemap'];
    //        files.push({
    //            pattern: polyfillsFile,
    //            included: true,
    //            served: true,
    //            watched: true
    //        });
    //    }
    //}

    // Scripts
    if (appConfig.scripts && appConfig.scripts.length > 0) {
        const globalScripts = parseGlobalScopedEntry(appConfig.scripts, appRoot, 'scripts');
        // add entry points and lazy chunks
        const globalScriptPatterns = globalScripts
            .filter((script: GlobalScopedEntry & { path?: string; entry?: string; }) => !(script.output || script.lazy))
            .map(script => {
                let scriptPattern = path.relative(projectRoot, path.resolve(projectRoot, appConfig.root, script.input));
                scriptPattern = scriptPattern.replace(/\\/g, '/');
                if (!scriptPattern.startsWith('./')) {
                    scriptPattern = `./${scriptPattern}`;
                }

                return {
                    pattern: scriptPattern,
                    included: true,
                    served: true,
                    watched: false
                };
            });
        files.push(...globalScriptPatterns);
    }

    const proxies : any = {};
    if (appConfig.assets && appConfig.assets.length) {
        const appRoot = path.resolve(projectRoot, appConfig.root);
        const assetEntries = parseCopyAssetEntry(appRoot, appConfig.assets);
        assetEntries.forEach((assetEntry: AssetEntry) => {

            const removeGlobFn = (p: string) => {
                if (p.endsWith('/**/*')) {
                    return p.substring(0, p.length - 5);
                } else if (p.endsWith('/**')) {
                    return p.substring(0, p.length - 3);
                } else if (p.endsWith('/*')) {
                    return p.substring(0, p.length - 2);
                }
                return p;
            };

            let from = '';
            let assetsPattern = '';

            if (typeof (assetEntry.from) === 'object') {
                from = assetEntry.from.glob;
                from = removeGlobFn(from);
                assetsPattern = path.relative(projectRoot, path.resolve(projectRoot, appConfig.root, assetEntry.from.glob));
            } else if (typeof (assetEntry.from) === 'string') {
                from = assetEntry.from;
                from = removeGlobFn(from);
                assetsPattern = path.relative(projectRoot, path.resolve(projectRoot, appConfig.root, assetEntry.from));
            }
            assetsPattern = assetsPattern.replace(/\\/g, '/');
            if (!assetsPattern.startsWith('./')) {
                assetsPattern = `./${assetsPattern}`;
            }

            files.push({ pattern: assetsPattern, watched: false, included: false, served: true, nocache: false });

            let relativePath: string, proxyPath: string;

            if (from && fs.existsSync(path.resolve(projectRoot, appConfig.root, from))) {
                relativePath = path.relative(projectRoot, path.resolve(projectRoot, appConfig.root, from));
                if (path.isAbsolute(relativePath)) {
                    throw new Error(`Absolute path is not allowed in assets entry 'from', path: ${relativePath}`);
                }

                if (assetEntry.to) {
                    proxyPath = assetEntry.to;
                } else {
                    proxyPath = from;
                }
            } else {
                // For globs
                relativePath = path.relative(projectRoot, path.resolve(projectRoot, appConfig.root));
                proxyPath = assetEntry.to || '';
            }

            // Proxy paths must have only forward slashes.
            proxyPath = proxyPath.replace(/\\/g, '/');
            relativePath = relativePath.replace(/\\/g, '/');

            if (proxyPath.startsWith('/')) {
                proxyPath = proxyPath.substr(1);
            }
            const proxyKey = `/${proxyPath}`;
            proxies[proxyKey] = `/base/${relativePath}`;
        });
    }

    const karmaOptions : any = {
        webpackConfig: testWebpackConfigs,
        files: files,
        preprocessors: preprocessors,
        proxies: proxies,
        codeCoverage: codeCoverage
    };

    return karmaOptions;
}

export function getWebpackConfigs(projectRoot?: string, buildOptions?: BuildOptions, angularBuildConfig?: AngularBuildConfig) {
    buildOptions = buildOptions || {};
    if (!angularBuildConfig || typeof angularBuildConfig !== 'object' || !Object.keys(angularBuildConfig).length) {
        angularBuildConfig = getAngularBuildConfig(projectRoot);
    }
    const appConfigs = getAppConfigs(projectRoot, buildOptions, angularBuildConfig);
    if (appConfigs.length === 0) {
        throw new Error('No app config is available.');
    }
    return appConfigs
        .map((appConfig: AppConfig) => getWebpackConfig(projectRoot, appConfig, buildOptions, angularBuildConfig, true));
}

export function getAppConfigs(projectRoot?: string, buildOptions?: BuildOptions, angularBuildConfig?: AngularBuildConfig) {
    projectRoot = projectRoot ? path.resolve(projectRoot) : process.cwd();
    buildOptions = buildOptions || {};

    if (!angularBuildConfig || typeof angularBuildConfig !== 'object' || !Object.keys(angularBuildConfig).length) {
        angularBuildConfig = getAngularBuildConfig(projectRoot);
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
        throw new Error(`Invalid configuration.\n${errMsg}\n`);
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

    // Merge
    buildOptions = mergeBuildOptionsWithDefaults(buildOptions);

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

    let defaultTestApp : string = null;
    if (angularBuildConfig.test && angularBuildConfig.test.defaultTestApp) {
        defaultTestApp = angularBuildConfig.test.defaultTestApp;
    }

    return appConfigs
        .filter((appConfig: AppConfig) =>
            !appConfig.skip &&
            (!buildOptions.test ||
            (buildOptions.test &&
                appConfig.test &&
            (!defaultTestApp || (defaultTestApp && appConfig.name === defaultTestApp)))) &&
            (filterApps.length === 0 ||
                (filterApps.length > 0 && appConfig.name && filterApps.indexOf(appConfig.name) > -1)));
}

export function getWebpackConfig(projectRoot: string, appConfig: AppConfig, buildOptions?: BuildOptions, angularBuildConfig?: AngularBuildConfig, skipMerge?: boolean) {
    if (!skipMerge) {
        projectRoot = projectRoot ? path.resolve(projectRoot) : process.cwd();
        buildOptions = mergeBuildOptionsWithDefaults(buildOptions);
        mergeAppConfigWithBuildTargetOverrides(appConfig, buildOptions);
        mergeAppConfigWithDefaults(projectRoot, appConfig, buildOptions);
    }

    if (!angularBuildConfig || typeof angularBuildConfig !== 'object' || !Object.keys(angularBuildConfig).length) {
        angularBuildConfig = getAngularBuildConfig(projectRoot);
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

    if (!buildOptions.test && !appConfig.outDir) {
        throw new Error(`No 'outDir' folder is specified. Please set 'outDir' folder name in appConfig.`);
    }

    if (appConfig.outDir && appConfig.outDir === appConfig.root ||
        path.resolve(projectRoot, appConfig.outDir) === path.resolve(projectRoot, appConfig.root)) {
        throw new Error(`'outDir' must not be the same as 'root'.`);
    }

    if (appConfig.outDir && path.resolve(projectRoot, appConfig.outDir) === path.resolve(projectRoot)) {
        throw new Error(`'outDir' must not be the same as 'projectRoot'.`);
    }

    if (!buildOptions.dll && !appConfig.main) {
        throw new Error(`No main entry. Please set main entry in appConfig.`);
    }

    if (buildOptions.dll &&
        (!appConfig.dlls || !appConfig.dlls.length) &&
        (!appConfig.polyfills || !appConfig.polyfills.length)) {
        throw new Error(`No dll entry. Please set dll entry in appConfig.`);
    }

    if (buildOptions.test && !appConfig.test) {
        throw new Error(`No test entry. Please set test entry in appConfig.`);
    }

    if (appConfig.disableDefaultWebpackConfigs && !appConfig.webpackConfig) {
        throw new Error(`No webpack config is provided.`);
    }


    let customWebpackConfig : any = null;
    if (appConfig.webpackConfig) {
        const customWebpackModule = require(path.resolve(projectRoot, appConfig.webpackConfig));
        if (customWebpackModule && customWebpackModule.default && typeof customWebpackModule.default === 'function') {
            customWebpackConfig = customWebpackModule.default(projectRoot, appConfig, buildOptions, angularBuildConfig);
        }
        if (customWebpackModule && typeof customWebpackModule === 'function') {
            customWebpackConfig = customWebpackModule(projectRoot, appConfig, buildOptions, angularBuildConfig);
        }
    }

    if (appConfig.disableDefaultWebpackConfigs && !customWebpackConfig) {
        throw new Error(`No webpack config is provided.`);
    }

    if (appConfig.disableDefaultWebpackConfigs && customWebpackConfig) {
        return customWebpackConfig;
    }

    // Test config
    if (buildOptions.test) {
        if (customWebpackConfig) {
            return webpackMerge(getTestConfig(projectRoot, appConfig, buildOptions, angularBuildConfig), customWebpackConfig);
        } else {
            return getTestConfig(projectRoot, appConfig, buildOptions, angularBuildConfig);
        }
    }

    if (buildOptions.dll) {
        if (customWebpackConfig) {
            return webpackMerge(getDllConfig(projectRoot, appConfig, buildOptions), customWebpackConfig);
        } else {
            return getDllConfig(projectRoot, appConfig, buildOptions);
        }
    } else {
        if (customWebpackConfig) {
            return webpackMerge(getNonDllConfig(projectRoot, appConfig, buildOptions), customWebpackConfig);
        } else {
            return getNonDllConfig(projectRoot, appConfig, buildOptions);
        }
    }
}

export function getAngularBuildConfig(projectRoot: string): AngularBuildConfig{
    const configFilePath = path.resolve(projectRoot, 'angular-build.json');
    if (!configFilePath || !fs.existsSync(configFilePath)) {
        throw new Error(`'angular-build.json' file could not be found at ${projectRoot}.`);
    }

    return readJsonSync(path.resolve(projectRoot, configFilePath));
}

// Private functions
function mergeBuildOptionsWithDefaults(buildOptions: BuildOptions): BuildOptions {
    buildOptions = buildOptions || {};
    buildOptions.environment = buildOptions.environment || {};
    if (Array.isArray(buildOptions.environment)) {
        const envObj : any = {};
        buildOptions.environment.forEach(n => envObj[n] = true);
        buildOptions.environment = envObj;
    } else if (typeof (<any>buildOptions.environment) === 'string') {
        const envObj: any = {};
        const key = (<any>buildOptions.environment) as string;
        envObj[key] = true;
        buildOptions.environment = envObj;
    }

    const defaultBuildOptions: BuildOptions = {
        verbose: process.argv.indexOf('--verbose') > -1,
        progress: process.argv.indexOf('--progress') > -1,
        environment: {}
    };

    // Production
    if (typeof buildOptions.production === 'boolean') {
        (buildOptions.environment as any)['prod'] = buildOptions.production;

        defaultBuildOptions.production = buildOptions.production;
        (defaultBuildOptions.environment as any)['prod'] = buildOptions.production;
    } else if ((typeof ((buildOptions.environment as any)['prod']) !== 'undefined' &&
            (buildOptions.environment as any)['prod']) ||
        (typeof ((buildOptions.environment as any)['production']) !== 'undefined' &&
            (buildOptions.environment as any)['production'])) {
        buildOptions.production = true;
        (buildOptions.environment as any)['prod'] = true;

        defaultBuildOptions.production = true;
        (defaultBuildOptions.environment as any)['prod'] = true;
    } else if ((typeof ((buildOptions.environment as any)['prod']) !== 'undefined' &&
        !(buildOptions.environment as any)['prod']) ||
        (typeof ((buildOptions.environment as any)['production']) !== 'undefined' &&
            !(buildOptions.environment as any)['production'])) {
        buildOptions.production = false;
        (buildOptions.environment as any)['prod'] = false;

        defaultBuildOptions.production = false;
        (defaultBuildOptions.environment as any)['prod'] = false;
    } else {
        defaultBuildOptions.production = hasProdFlag() ||
        (!hasDevFlag() &&
        (isAoTBuildFromNpmEvent() ||
            process.argv.indexOf('--aot') > -1 ||
            isUniversalBuildFromNpmEvent() ||
            process.argv.indexOf('--universal') > -1));
        if (defaultBuildOptions.production) {
            (defaultBuildOptions.environment as any)['prod'] = true;

            buildOptions.production = true;
            (buildOptions.environment as any)['prod'] = true;
        }
    }


    // Dll
    if (typeof buildOptions.dll === 'boolean') {
        (buildOptions.environment as any)['dll'] = buildOptions.dll;

        defaultBuildOptions.dll = buildOptions.dll;
        (defaultBuildOptions.environment as any)['dll'] = buildOptions.dll;
    } else if (typeof ((buildOptions.environment as any)['dll']) !== 'undefined' && (buildOptions.environment as any)['dll']) {
        buildOptions.dll = true;
        (buildOptions.environment as any)['dll'] = true;

        defaultBuildOptions.dll = true;
        (defaultBuildOptions.environment as any)['dll'] = true;
    } else if (typeof ((buildOptions.environment as any)['dll']) !== 'undefined' && !(buildOptions.environment as any)['dll']) {
        buildOptions.dll = false;
        (buildOptions.environment as any)['dll'] = false;

        defaultBuildOptions.dll = false;
        (defaultBuildOptions.environment as any)['dll'] = false;
    } else {
        defaultBuildOptions.dll = isDllBuildFromNpmEvent() || process.argv.indexOf('--dll') > -1;
        if (defaultBuildOptions.dll) {
            (defaultBuildOptions.environment as any)['dll'] = true;

            buildOptions.dll = true;
            (buildOptions.environment as any)['dll'] = true;
        }
    }

    // AoT
    if (typeof buildOptions.aot === 'boolean') {
        (buildOptions.environment as any)['aot'] = buildOptions.aot;

        defaultBuildOptions.aot = buildOptions.aot;
        (defaultBuildOptions.environment as any)['aot'] = buildOptions.aot;
    } else if (typeof ((buildOptions.environment as any)['aot']) !== 'undefined' && (buildOptions.environment as any)['aot']) {
        buildOptions.aot = true;
        (buildOptions.environment as any)['aot'] = true;

        defaultBuildOptions.aot = true;
        (defaultBuildOptions.environment as any)['aot'] = true;
    } else if (typeof ((buildOptions.environment as any)['aot']) !== 'undefined' && !(buildOptions.environment as any)['aot']) {
        buildOptions.aot = false;
        (buildOptions.environment as any)['aot'] = false;

        defaultBuildOptions.aot = false;
        (defaultBuildOptions.environment as any)['aot'] = false;
    } else {
        defaultBuildOptions.aot = isAoTBuildFromNpmEvent() || process.argv.indexOf('--aot') > -1;
        if (defaultBuildOptions.aot) {
            (defaultBuildOptions.environment as any)['aot'] = true;

            buildOptions.aot = true;
            (buildOptions.environment as any)['aot'] = true;
        }
    }

    // Test
    if (typeof buildOptions.test === 'boolean') {
        (buildOptions.environment as any)['test'] = buildOptions.test;

        defaultBuildOptions.test = buildOptions.test;
        (defaultBuildOptions.environment as any)['test'] = buildOptions.test;
    } else if (typeof ((buildOptions.environment as any)['test']) !== 'undefined' && (buildOptions.environment as any)['test']) {
        buildOptions.test = true;
        (buildOptions.environment as any)['test'] = true;

        defaultBuildOptions.test = true;
        (defaultBuildOptions.environment as any)['test'] = true;
    } else if (typeof ((buildOptions.environment as any)['test']) !== 'undefined' && !(buildOptions.environment as any)['test']) {
        buildOptions.test = false;
        (buildOptions.environment as any)['test'] = false;

        defaultBuildOptions.test = false;
        (defaultBuildOptions.environment as any)['test'] = false;
    } else {
        defaultBuildOptions.test = isTestBuildFromNpmEvent() || process.argv.indexOf('--test') > -1;
        if (defaultBuildOptions.test) {
            (defaultBuildOptions.environment as any)['test'] = true;

            buildOptions.test = true;
            (buildOptions.environment as any)['test'] = true;
        }
    }

    // Development
    if (buildOptions.production &&
        typeof (buildOptions.environment as any)['dev'] !== 'undefined') {
        (buildOptions.environment as any)['dev'] = false;
        (defaultBuildOptions.environment as any)['dev'] = false;
    }
    if (buildOptions.production &&
        typeof (buildOptions.environment as any)['development'] !== 'undefined') {
        (buildOptions.environment as any)['development'] = false;
        (defaultBuildOptions.environment as any)['development'] = false;
    }

    if (!buildOptions.production && !buildOptions.test &&
        typeof (buildOptions.environment as any)['dev'] === 'undefined') {
        (buildOptions.environment as any)['dev'] = true;
        (defaultBuildOptions.environment as any)['dev'] = true;
    }

    // Reset aot = false
    if ((buildOptions.dll || buildOptions.test) && buildOptions.aot) {
        console.warn(`\n${chalk.bgYellow('WARN:')} 'aot' is automatically disabled in dll/test build.\n`);

        buildOptions.aot = false;
        (buildOptions.environment as any)['aot'] = false;

        defaultBuildOptions.aot = false;
        (defaultBuildOptions.environment as any)['aot'] = false;
    }

    // Reset dll = false
    if (buildOptions.test && buildOptions.dll) {
        console.warn(`\n${chalk.bgYellow('WARN:')} 'dll' is automatically disabled in test build.\n`);

        buildOptions.dll = false;
        (buildOptions.environment as any)['dll'] = false;

        defaultBuildOptions.dll = false;
        (defaultBuildOptions.environment as any)['dll'] = false;
    }

    // performanceHint
    if (typeof buildOptions.performanceHint === 'boolean') {
        defaultBuildOptions.performanceHint = buildOptions.performanceHint;
    } else if (process.argv.indexOf('--performance-hint') > -1 ||
        process.argv.indexOf('--performanceHint') > -1) {
        buildOptions.performanceHint = true;
        defaultBuildOptions.performanceHint = true;
    } else if (!buildOptions.dll && !buildOptions.test){
        buildOptions.performanceHint = true;
        defaultBuildOptions.performanceHint = true;
    }

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
        buildOptions = Object.assign(buildOptions, defaultBuildOptions);
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

    const buildTargets: string[] = [];
    if (buildOptions.test || (buildOptions.environment as any)['test']) {
        buildTargets.push('test');
    } else {
        if (buildOptions.production || (buildOptions.environment as any)['prod'] || (buildOptions.environment as any)['production']) {
            buildTargets.push('prod');
            buildTargets.push('production');
        } else {
            buildTargets.push('dev');
            buildTargets.push('development');
        }

        if (buildOptions.dll || (buildOptions.environment as any)['dll']) {
            buildTargets.push('dll');
        } else if (buildOptions.aot || (buildOptions.environment as any)['aot']) {
            buildTargets.push('aot');
        }
    }

    Object.keys(buildOptions.environment).forEach(key => {
        if ((buildOptions.test || (buildOptions.environment as any)['test']) &&
        (key.toLowerCase() === 'test' ||
            key.toLowerCase() === 'prod' ||
            key.toLowerCase() === 'production' ||
            key.toLowerCase() === 'dev' ||
            key.toLowerCase() === 'development' ||
            key.toLowerCase() === 'dll' ||
            key.toLowerCase() === 'aot')) {
            return;
        }

        if (buildTargets.indexOf(key.toLowerCase()) === -1) {
            buildTargets.push(key.toLowerCase());
        }
    });

    Object.keys(appConfig.buildTargetOverrides).forEach((buildTargetKey: string) => {
        const targetName = buildTargetKey.toLowerCase();
        const targets = targetName.split(',');
        targets.forEach(t => {
            t = t.trim();
            if (buildTargets.indexOf(t) > -1) {
                const newConfig = (appConfig.buildTargetOverrides as any)[t];
                if (newConfig && typeof newConfig === 'object') {
                    overrideAppConfig(appConfig, newConfig);
                }
            }
        });

    });
}

function mergeAppConfigWithDefaults(projectRoot: string, appConfig: AppConfig, buildOptions: BuildOptions) {
    if (!projectRoot) {
        throw new Error(`'projectRoot' is undefined.`);
    }

    if (!appConfig) {
        throw new Error(`'appConfig' is undefined.`);
    }

    if (!buildOptions) {
        throw new Error(`'buildOptions' is undefined.`);
    }

    if (!appConfig.root) {
        throw new Error(`The 'root' folder is undefined. Please set 'root' folder name in appConfig.`);
    }

    if (!buildOptions.test && !appConfig.outDir) {
        throw new Error(`'outDir' folder is undefined. Please set 'outDir' folder name in appConfig.`);
    }

    //appConfig.root = path.relative(projectRoot, appConfig.root);
    //if (appConfig.outDir) {
    //    appConfig.outDir = path.relative(projectRoot, appConfig.outDir);
    //}

    if (appConfig.outDir && (appConfig.outDir === appConfig.root ||
        path.resolve(projectRoot, appConfig.outDir) === path.resolve(projectRoot, appConfig.root))) {
        throw new Error(`'outDir' must not be the same as 'root'.`);
    }

    if (appConfig.outDir && path.resolve(projectRoot, appConfig.outDir) === path.resolve(projectRoot)) {
        throw new Error(`'outDir' must not be the same as 'projectRoot'.`);
    }

    appConfig.publicPath = appConfig.publicPath || (<any>appConfig).deployUrl;

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
        if (!buildOptions.test) {
            if (typeof buildOptions.referenceDll !== 'undefined' && buildOptions.referenceDll !== null) {
                appConfig.referenceDll = buildOptions.referenceDll;
            } else {
                appConfig.referenceDll = !buildOptions.production &&
                    !buildOptions.aot &&
                    appConfig.dlls &&
                    appConfig.dlls.length > 0;
            }
        }
    } else {
        if (buildOptions.test && appConfig.referenceDll) {
            appConfig.referenceDll = false;
            console.warn(`\n${chalk.bgYellow('WARN:')} 'referenceDll' is automatically disabled in test build.\n`);
        } else {
            if (buildOptions.aot && appConfig.referenceDll) {
                appConfig.referenceDll = false;
                console.warn(`\n${chalk.bgYellow('WARN:')} 'referenceDll' is automatically disabled in aot build.\n`);
            }
            if (buildOptions.typescriptWebpackTool === '@ngtools/webpack' && appConfig.referenceDll) {
                buildOptions.typescriptWebpackTool = null;
                console.warn(`\n${chalk
                    .bgYellow('WARN:')} '@ngtools/webpack' is automatically disabled in 'referenceDll'.\n`);
            }
        }
    }

    if (buildOptions.typescriptWebpackTool === '@ngtools/webpack' && buildOptions.test) {
        buildOptions.typescriptWebpackTool = null;
        console.warn(`\n${chalk
            .bgYellow('WARN:')} '@ngtools/webpack' is automatically disabled in test build.\n`);
    }

    if (typeof appConfig.extractCss === 'undefined' || appConfig.extractCss === null) {
        if (!buildOptions.test && !buildOptions.dll) {
            if (!appConfig.target || appConfig.target === 'web' || appConfig.target === 'webworker') {
                if (typeof buildOptions.extractCss !== 'undefined' && buildOptions.extractCss !== null) {
                    appConfig.extractCss = buildOptions.extractCss;
                } else {
                    appConfig.extractCss = buildOptions.production;
                }
            } else {
                appConfig.extractCss = false;
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

    //if (typeof appConfig.compressAssets === 'undefined' || appConfig.compressAssets === null) {
    //    if (typeof buildOptions.compressAssets !== 'undefined' && buildOptions.compressAssets !== null) {
    //        appConfig.compressAssets = buildOptions.compressAssets;
    //    } else {
    //        appConfig.compressAssets = buildOptions.production;
    //    }
    //}

    if (typeof appConfig.appendOutputHash === 'undefined' || appConfig.appendOutputHash === null) {
        if (!buildOptions.test) {
            if (!appConfig.target || appConfig.target === 'web' || appConfig.target === 'webworker') {
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
                    if (typeof buildOptions
                        .appendOutputHash !==
                        'undefined' &&
                        buildOptions.appendOutputHash !== null) {
                        appConfig.appendOutputHash = buildOptions.appendOutputHash;
                    } else {
                        appConfig.appendOutputHash = buildOptions.production;
                    }
                }
            } else {
                appConfig.appendOutputHash = false;
            }
        } else {
            appConfig.appendOutputHash = false;
        }
    }
}
