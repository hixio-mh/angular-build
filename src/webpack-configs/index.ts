import * as path from 'path';
import { existsSync } from 'fs';

import * as webpack from 'webpack';

import {
    AngularBuildConfigInternal,
    AngularBuildContextImpl,
    AppBuildContext,
    InvalidConfigError,
    PreDefinedEnvironment,
    ProjectConfigInternal } from '../models';
import {
    applyAngularBuildConfigDefaults,
    applyProjectConfigDefaults,
    applyProjectConfigWithEnvOverrides,
    prepareEnvironment,
    validateProjectConfig } from '../helpers';
import { formatValidationError, Logger, readJsonSync, validateSchema } from '../utils';

import { getAppWebpackConfig, getAppDllWebpackConfig } from './app';
import { getLibWebpackConfig } from './lib';

// config for webpack cli
export function getWebpackConfigStandalone(configPath: string, env?: any, argv?: any): webpack.Configuration[] | webpack.Configuration {
    const logger = new Logger({
        logLevel: 'info',
        debugPrefix: 'DEBUG:',
        infoPrefix: 'INFO:',
        warnPrefix: 'WARNING:'
    });

    // environment
    if (!env && process.env.WEBPACK_ENV) {
        const rawEnv = process.env.WEBPACK_ENV as any;
        const envObj: any = typeof rawEnv === 'object'
            ? rawEnv
            : JSON.parse(rawEnv);
        if (typeof envObj === 'object') {
            env = envObj;
        }
    }
    const environment = prepareEnvironment(env) as PreDefinedEnvironment;

    // extraOptions
    let extraOptions: {
        filter?: string | string[];
        cleanOutDirs?: boolean;
    } = {};
    if ((environment as any).extraOptions) {
        if (typeof (environment as any).extraOptions === 'object') {
            extraOptions = Object.assign(extraOptions, (environment as any).extraOptions);
        }
        delete (environment as any).extraOptions;
    }

    configPath = path.isAbsolute(configPath) ? configPath : path.resolve(process.cwd(), configPath);
    const angularBuildConfig = readJsonSync(configPath) as AngularBuildConfigInternal;

    // validate schema
    let schemaPath = '../schemas/schema.json';
    if (!existsSync(path.resolve(__dirname, schemaPath))) {
        schemaPath = '../../schemas/schema.json';
    }
    if (!existsSync(path.resolve(__dirname, schemaPath))) {
        schemaPath = '../../../schemas/schema.json';
    }
    if (existsSync(path.resolve(__dirname, schemaPath))) {
        const schema = require(schemaPath);
        if (schema.$schema) {
            delete schema.$schema;
        }
        if ((angularBuildConfig as any).$schema) {
            delete (angularBuildConfig as any).$schema;
        }
        if (angularBuildConfig._schema) {
            delete angularBuildConfig._schema;
        }
        if (angularBuildConfig._schemaValidated) {
            delete angularBuildConfig._schemaValidated;
        }

        const errors = validateSchema(schema, angularBuildConfig);
        if (errors.length) {
            const errMsg = errors.map(err => formatValidationError(schema, err)).join('\n');
            throw new InvalidConfigError(
                `Invalid configuration object.\n\n${
                errMsg}\n`);
        }

        angularBuildConfig._schema = schema;
        angularBuildConfig._schemaValidated = true;
    } else {
        logger.warn(`The angular-build schema file doesn't exist`);
    }

    // set angular build defaults
    applyAngularBuildConfigDefaults(angularBuildConfig);
    if (argv.verbose) {
        angularBuildConfig.logLevel = 'debug';
    }

    const libConfigs = angularBuildConfig.libs || [];
    const appConfigs = angularBuildConfig.apps || [];

    if (appConfigs.length === 0 && libConfigs.length === 0) {
        throw new InvalidConfigError(`No app or lib project is available.`);
    }

    const projectRoot = path.dirname(configPath);
    const webpackConfigs: webpack.Configuration[] = [];
    const watch = argv.watch || argv.w;
    const cleanOutDirs = extraOptions.cleanOutDirs;
    const filter = extraOptions.filter;

    // apply filter
    const configNames: string[] = [];
    if (filter) {
        if (Array.isArray(filter)) {
            (filter as string[])
                .filter(configName => !configNames.includes(configName)).forEach(
                configName => configNames.push(configName));
        } else if (typeof filter === 'string' && !configNames.includes(filter)) {
            configNames.push(filter as string);
        }
    }
    if (argv.configName) {
        if (Array.isArray(argv.configName)) {
            (argv.configName as string[])
                .filter(configName => !configNames.includes(configName)).forEach(
                configName => configNames.push(configName));
        } else if (!configNames.includes(argv.configName)) {
            configNames.push(argv.configName as string);
        }
    }

    if (libConfigs.length > 0) {
        let filteredLibConfigs = libConfigs
            .filter(projectConfig =>
                (configNames.length === 0 ||
                    (configNames.length > 0 &&
                        (configNames.indexOf('libs') > -1 ||
                            (projectConfig.name && configNames.indexOf(projectConfig.name) > -1)))));

        if (configNames.length === 1 && configNames[0] === 'apps') {
            filteredLibConfigs = [];
        }

        if (filteredLibConfigs.length > 0) {
            // logger.debug('Initializing lib configs');
            for (let i = 0; i < filteredLibConfigs.length; i++) {
                const libConfig = filteredLibConfigs[i];

                const clonedLibConfig = JSON.parse(JSON.stringify(libConfig)) as ProjectConfigInternal;
                applyProjectConfigWithEnvOverrides(clonedLibConfig, environment);
                applyProjectConfigDefaults(projectRoot, clonedLibConfig, environment);

                if (clonedLibConfig.skip) {
                    continue;
                }

                validateProjectConfig(projectRoot, clonedLibConfig);

                const angularBuildContext = new AngularBuildContextImpl(
                    environment,
                    configPath,
                    angularBuildConfig,
                    libConfig as ProjectConfigInternal,
                    clonedLibConfig
                );

                angularBuildContext.watch = watch;
                angularBuildContext.progress = argv.progress;
                angularBuildContext.webpackArgv = argv;
                angularBuildContext.cleanOutDirs = cleanOutDirs;

                const wpConfig = getLibWebpackConfig(angularBuildContext);
                if (wpConfig) {
                    webpackConfigs.push(wpConfig);
                }
            }
        }
    }

    if (appConfigs.length > 0) {
        let filteredAppConfigs = appConfigs
            .filter(projectConfig =>
                (configNames.length === 0 ||
                    (configNames.length > 0 &&
                        (configNames.indexOf('apps') > -1 ||
                            (projectConfig.name && configNames.indexOf(projectConfig.name) > -1)))));


        if (configNames.length === 1 && configNames[0] === 'libs') {
            filteredAppConfigs = [];
        }

        if (filteredAppConfigs.length > 0) {
            // logger.debug('Initializing app configs');
            for (let i = 0; i < filteredAppConfigs.length; i++) {
                const appConfig = filteredAppConfigs[i];

                const clonedAppConfig = JSON.parse(JSON.stringify(appConfig)) as ProjectConfigInternal;
                applyProjectConfigWithEnvOverrides(clonedAppConfig, environment);
                applyProjectConfigDefaults(projectRoot, clonedAppConfig, environment);

                if (clonedAppConfig.skip) {
                    continue;
                }

                validateProjectConfig(projectRoot, clonedAppConfig);

                const angularBuildContext = new AngularBuildContextImpl(
                    environment,
                    configPath,
                    angularBuildConfig,
                    appConfig as ProjectConfigInternal,
                    clonedAppConfig
                );

                angularBuildContext.watch = watch;
                angularBuildContext.progress = argv.progress;
                angularBuildContext.webpackArgv = argv;
                angularBuildContext.cleanOutDirs = cleanOutDirs;

                if (environment.dll) {
                    (angularBuildContext as AppBuildContext).dllBuildOnly = true;
                    const wpConfig = getAppDllWebpackConfig(angularBuildContext);
                    if (wpConfig) {
                        webpackConfigs.push(wpConfig);
                    }
                } else {
                    const wpConfig = getAppWebpackConfig(angularBuildContext);
                    if (wpConfig) {
                        webpackConfigs.push(wpConfig);
                    }
                }
            }
        }
    }

    if (webpackConfigs.length === 0) {
        throw new InvalidConfigError(`No app or lib project is available.`);
    }

    return webpackConfigs.length === 1 ? webpackConfigs[0] : webpackConfigs;
}
