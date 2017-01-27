"use strict";
const path = require("path");
const fs = require("fs");
const helpers_1 = require("./helpers");
const webpack_angular_config_1 = require("./webpack-angular-config");
function getWebpackConfigs(projectRoot, buildOptions) {
    projectRoot = projectRoot || process.cwd();
    let configFileExists = false;
    let configPath = 'angular-build.json';
    if (!fs.existsSync(path.resolve(projectRoot, configPath))) {
        const tmpConfigPath = 'angular-cli.json';
        if (fs.existsSync(path.resolve(projectRoot, tmpConfigPath))) {
            configPath = tmpConfigPath;
            configFileExists = true;
        }
    }
    else {
        configFileExists = true;
    }
    if (!configFileExists) {
        throw new Error(`'angular-build.json' or 'angular-cli.json' file could not be found in ${projectRoot}.`);
    }
    const appsConfig = helpers_1.readJsonSync(path.resolve(projectRoot, configPath));
    buildOptions = buildOptions || {};
    buildOptions.dll = typeof buildOptions.dll === 'undefined' ? helpers_1.isDllBuildFromNpmEvent() : buildOptions.dll;
    // Extends
    const appConfigs = appsConfig.apps.map((app) => {
        let cloneApp = Object.assign({}, app);
        if (cloneApp.extends) {
            const baseApps = appsConfig.apps.filter((a) => a.name === cloneApp.extends);
            if (baseApps && baseApps.length > 0) {
                const cloneBaseApp = Object.assign({}, baseApps[0]);
                cloneApp = Object.assign({}, cloneBaseApp, cloneApp);
            }
        }
        return cloneApp;
    });
    const configs = appConfigs.filter((appConfig) => appConfig.enabled !== false &&
        (!buildOptions.dll || (buildOptions.dll && appConfig.dlls && appConfig.dlls.length && !appConfig.skipOnDllsBundle)))
        .map((appConfig) => {
        return getWebpackConfig(projectRoot, appConfig, buildOptions);
    });
    return configs;
}
exports.getWebpackConfigs = getWebpackConfigs;
function getWebpackConfig(projectRoot, appConfig, buildOptions) {
    projectRoot = projectRoot || process.cwd();
    const defaultBuildOptions = {
        debug: !helpers_1.hasProdArg(),
        dll: helpers_1.isDllBuildFromNpmEvent(),
        aot: helpers_1.isAoTBuildFromNpmEvent()
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
    return webpack_angular_config_1.getWebpackAngularConfig(projectRoot, appConfig, buildOptions);
}
exports.getWebpackConfig = getWebpackConfig;
//# sourceMappingURL=webpack-config.js.map