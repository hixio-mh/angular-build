import * as path from 'path';
import * as fs from 'fs';

import { AngularAppConfig, AngularBuildOptions } from './models';
import { readJsonSync, hasProdArg, isDllBuildFromNpmEvent, isAoTBuildFromNpmEvent } from './helpers';
import { getWebpackAngularConfig } from './webpack-angular-config';

export function getWebpackConfigs(projectRoot: string, buildOptions?: AngularBuildOptions) {
    projectRoot = projectRoot || process.cwd();

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
    const appsConfig = readJsonSync(path.resolve(projectRoot, configPath));
    buildOptions = buildOptions || {};
    buildOptions.dll = typeof buildOptions.dll === 'undefined' ? isDllBuildFromNpmEvent() : buildOptions.dll;

    // Extends
    const appConfigs = appsConfig.apps.map((app: AngularAppConfig) => {
        let cloneApp = Object.assign({}, app);
        if (cloneApp.extends) {
            const baseApps = appsConfig.apps.filter((a: AngularAppConfig) => a.name === cloneApp.extends);
            if (baseApps && baseApps.length > 0) {
                const cloneBaseApp = Object.assign({}, baseApps[0]);
                cloneApp = Object.assign({}, cloneBaseApp, cloneApp);
            }
        }
        return cloneApp;
    });

    const configs = appConfigs.filter((appConfig: AngularAppConfig) => appConfig.enabled !== false &&
        (!buildOptions.dll || (buildOptions.dll && appConfig.dlls && appConfig.dlls.length && !appConfig.skipOnDllsBundle)
        ))
        .map((appConfig: AngularAppConfig) => {
            return getWebpackConfig(projectRoot, appConfig, buildOptions);
        });
    return configs;
}

export function getWebpackConfig(projectRoot: string, appConfig: AngularAppConfig, buildOptions?: AngularBuildOptions) {
    projectRoot = projectRoot || process.cwd();
    const defaultBuildOptions: AngularBuildOptions = {
        debug: !hasProdArg(),
        dll: isDllBuildFromNpmEvent(),
        aot: isAoTBuildFromNpmEvent()
    };
    buildOptions = Object.assign(defaultBuildOptions, buildOptions || {});

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
        throw new Error(`No entry. Set entry in 'appConfig.main'.`);
    }
    if (buildOptions.dll && (!appConfig.dlls || !appConfig.dlls.length)) {
        throw new Error(`No dll entry. Set dll entries in 'appConfig.dlls'.`);
    }

    // Set defaults
    appConfig.root = appConfig.root || projectRoot;
    appConfig.outDir = appConfig.outDir || appConfig.root;

    return getWebpackAngularConfig(projectRoot, appConfig, buildOptions);
}