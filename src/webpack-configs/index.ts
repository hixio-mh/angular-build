import * as path from 'path';
import { existsSync } from 'fs';

import * as webpack from 'webpack';

import {
    AngularBuildConfigInternal,
    AngularBuildContextImpl,
    AppBuildContext,
    InternalError,
    InvalidConfigError,
    LibProjectConfigInternal,
    PreDefinedEnvironment,
    ProjectConfigInternal
} from '../models';

import {
    applyAngularBuildConfigDefaults,
    applyProjectConfigDefaults,
    applyProjectConfigWithEnvOverrides
} from '../helpers/prepare-configs';
import { validateProjectConfig } from '../helpers/validate-project-config';

import { readJsonSync } from '../utils/read-json';
import { formatValidationError, validateSchema } from '../utils/validate-schema';

const loadedModules: { [key: string]: any } = {};

export function getWebpackConfig(configPath: string, env?: any, argv?: any): webpack.Configuration[] {
    if (!configPath || !configPath.length) {
        throw new InternalError(`The 'configPath' is required.`);
    }

    const projectRoot = path.dirname(configPath);
    const fromAngularBuildCli = argv && argv.fromAngularBuildCli ? true : false;
    const cliRootPath = fromAngularBuildCli && argv && argv.cliRootPath ? argv.cliRootPath as string : undefined;
    const cliIsGlobal = fromAngularBuildCli && argv && argv.cliIsGlobal ? true : false;
    let cleanOutDirs = fromAngularBuildCli && argv && (argv.clean || argv.cleanOutDirs) ? true : false;
    let filterNames = fromAngularBuildCli && argv && argv.filter ? prepareFilterNames(argv.filter) : [];

    const verbose = argv && argv.verbose ? true : false;
    const watch = argv && (argv.watch || argv.w) ? true : false;
    const progress = argv && argv.progress ? true : false;

    // Prepare environment
    let environment: PreDefinedEnvironment = {};
    if (!fromAngularBuildCli && !env && process.env.WEBPACK_ENV) {
        const rawEnv = process.env.WEBPACK_ENV as any;
        const envObj: any = typeof rawEnv === 'object'
            ? rawEnv
            : JSON.parse(rawEnv);
        if (typeof envObj === 'object') {
            env = envObj;
        }
    }
    if (env && typeof env === 'object') {
        environment = Object.assign(environment, env);
    }

    // Extract options form environment
    if (!fromAngularBuildCli && (environment as any).options) {
        let extraOptions: {
            clean?: boolean;
            filter?: string | string[];
        } = {};

        if (typeof (environment as any).options === 'object') {
            extraOptions = Object.assign(extraOptions, (environment as any).options);
        }
        delete (environment as any).options;

        if (extraOptions.clean) {
            cleanOutDirs = true;
        }
        if (extraOptions.filter) {
            filterNames = prepareFilterNames(extraOptions.filter);
        }
    }

    // Prepare angular-build.json config
    if (!/\.json$/i.test(configPath)) {
        throw new InternalError(`Invalid config file, path: ${configPath}.`);
    }

    if (!existsSync(configPath)) {
        throw new InternalError(`The angular-build.json config file does not exist at ${configPath}.`);
    }

    let angularBuildConfig: AngularBuildConfigInternal | null = null;

    try {
        angularBuildConfig = readJsonSync(configPath) as AngularBuildConfigInternal;
    } catch (jsonErr) {
        throw new InvalidConfigError(`Invalid configuration, error: ${jsonErr.message || jsonErr}.`);
    }

    // Validate schema
    let schemaPath = '../schemas/schema.json';
    let existsSchemaPath = false;

    if (!existsSync(path.resolve(__dirname, schemaPath))) {
        schemaPath = '../../schemas/schema.json';
    } else {
        existsSchemaPath = true;
    }
    if (!existsSync(path.resolve(__dirname, schemaPath))) {
        schemaPath = '../../../schemas/schema.json';
    } else {
        existsSchemaPath = true;
    }

    if (existsSchemaPath) {
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
                `Invalid configuration.\n\n${
                errMsg}\n`);
        }

        angularBuildConfig._schema = schema;
        angularBuildConfig._schemaValidated = true;
    } else {
        throw new InternalError(`The angular-build schema file doesn't exist.`);
    }

    // Set angular build defaults
    applyAngularBuildConfigDefaults(angularBuildConfig);
    angularBuildConfig._configPath = configPath;
    if (verbose) {
        angularBuildConfig.logLevel = 'debug';
    }

    const libConfigs = angularBuildConfig.libs || [];
    const appConfigs = angularBuildConfig.apps || [];

    if (appConfigs.length === 0 && libConfigs.length === 0) {
        throw new InvalidConfigError(`No app or lib project is available.`);
    }

    const webpackConfigs: webpack.Configuration[] = [];

    if (libConfigs.length > 0) {
        let filteredLibConfigs = libConfigs
            .filter(projectConfig =>
                (filterNames.length === 0 ||
                    (filterNames.length > 0 &&
                        (filterNames.includes('libs') ||
                            (projectConfig.name && filterNames.includes(projectConfig.name))))));

        if (filterNames.length &&
            filterNames.filter(configName => configName === 'apps').length === filterNames.length) {
            filteredLibConfigs = [];
        }

        if (filteredLibConfigs.length > 0) {
            for (let i = 0; i < filteredLibConfigs.length; i++) {
                const libConfig = filteredLibConfigs[i];

                const clonedLibConfig = JSON.parse(JSON.stringify(libConfig)) as LibProjectConfigInternal;
                applyProjectConfigWithEnvOverrides(clonedLibConfig, environment);

                if (clonedLibConfig.skip) {
                    continue;
                }
                validateProjectConfig(projectRoot, clonedLibConfig);
                applyProjectConfigDefaults(projectRoot, clonedLibConfig, environment);

                const angularBuildContext = new AngularBuildContextImpl(
                    environment,
                    configPath,
                    angularBuildConfig,
                    libConfig as ProjectConfigInternal,
                    clonedLibConfig);

                angularBuildContext.fromAngularBuildCli = true;
                angularBuildContext.angularBuildCliRootPath = cliRootPath;
                angularBuildContext.cliIsGlobal = cliIsGlobal;
                angularBuildContext.watch = watch;
                angularBuildContext.progress = progress;
                angularBuildContext.cleanOutDirs = cleanOutDirs;

                // Dynamic require
                if (!loadedModules.getLibWebpackConfig) {
                    const getAppWebpackConfigModule = require('./lib/get-lib-webpack-config');
                    loadedModules.getLibWebpackConfig = getAppWebpackConfigModule.getLibWebpackConfig;
                }

                const wpConfig = loadedModules.getLibWebpackConfig(angularBuildContext) as (webpack.Configuration | null);
                if (wpConfig) {
                    if (fromAngularBuildCli) {
                        (wpConfig as any)._projectConfig = clonedLibConfig;
                    }

                    webpackConfigs.push(wpConfig);
                }
            }
        }
    }

    if (appConfigs.length > 0) {
        let filteredAppConfigs = appConfigs
            .filter(projectConfig =>
                (filterNames.length === 0 ||
                    (filterNames.length > 0 &&
                        (filterNames.includes('apps') ||
                            (projectConfig.name && filterNames.includes(projectConfig.name))))));

        if (filterNames.length &&
            filterNames.filter(configName => configName === 'libs').length === filterNames.length) {
            filteredAppConfigs = [];
        }

        if (filteredAppConfigs.length > 0) {
            for (let i = 0; i < filteredAppConfigs.length; i++) {
                const appConfig = filteredAppConfigs[i];

                const clonedAppConfig = JSON.parse(JSON.stringify(appConfig)) as ProjectConfigInternal;
                applyProjectConfigWithEnvOverrides(clonedAppConfig, environment);

                if (clonedAppConfig.skip) {
                    continue;
                }
                validateProjectConfig(projectRoot, clonedAppConfig);
                applyProjectConfigDefaults(projectRoot, clonedAppConfig, environment);

                const angularBuildContext = new AngularBuildContextImpl(
                    environment,
                    configPath,
                    angularBuildConfig,
                    appConfig as ProjectConfigInternal,
                    clonedAppConfig);

                angularBuildContext.fromAngularBuildCli = true;
                angularBuildContext.cliIsGlobal = cliIsGlobal;
                angularBuildContext.angularBuildCliRootPath = cliRootPath;
                angularBuildContext.watch = watch;
                angularBuildContext.progress = progress;
                angularBuildContext.cleanOutDirs = cleanOutDirs;

                if (environment.dll) {
                    // Dynamic require
                    if (!loadedModules.getAppDllWebpackConfig) {
                        const getAppDllWebpackConfigModule = require('./app/dll');
                        loadedModules.getAppDllWebpackConfig = getAppDllWebpackConfigModule.getAppDllWebpackConfig;
                    }

                    (angularBuildContext as AppBuildContext).dllBuildOnly = true;
                    const wpConfig =
                        loadedModules.getAppDllWebpackConfig(angularBuildContext) as (webpack.Configuration | null);
                    if (wpConfig) {
                        if (fromAngularBuildCli) {
                            (wpConfig as any)._projectConfig = clonedAppConfig;
                        }

                        webpackConfigs.push(wpConfig);
                    }
                } else {
                    // Dynamic require
                    if (!loadedModules.getAppWebpackConfig) {
                        const getAppWebpackConfigModule = require('./app/app');
                        loadedModules.getAppWebpackConfig = getAppWebpackConfigModule.getAppWebpackConfig;
                    }

                    const wpConfig = loadedModules.getAppWebpackConfig(angularBuildContext) as (webpack.Configuration | null);
                    if (wpConfig) {
                        if (fromAngularBuildCli) {
                            (wpConfig as any)._projectConfig = clonedAppConfig;
                        }

                        webpackConfigs.push(wpConfig);
                    }
                }
            }
        }
    }

    if (webpackConfigs.length === 0) {
        throw new InvalidConfigError(`No app or lib project is available.`);
    }

    return webpackConfigs;
}

function prepareFilterNames(filter: string | string[]): string[] {
    const filterNames: string[] = [];

    if (filter &&
        (Array.isArray(filter) || typeof filter === 'string')) {
        if (Array.isArray(filter)) {
            (filter as string[]).forEach(filterName => {
                if (filterName && filterName.trim() && !filterNames.includes(filterName.trim())) {
                    filterNames.push(filterName.trim());
                }
            });
        } else if (filter && filter.trim()) {
            filterNames.push(filter);
        }
    }

    return filterNames;
}
