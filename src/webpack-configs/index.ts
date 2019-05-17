import * as path from 'path';

import { pathExists } from 'fs-extra';
import { Configuration } from 'webpack';

import { AngularBuildContext } from '../build-context';
import { applyProjectConfigExtends, isFromBuiltInCli, isFromWebpackCli, normalizeEnvironment } from '../helpers';
import { AngularBuildConfig, JsonObject } from '../models';
import { InvalidConfigError } from '../models/errors';
import {
    AngularBuildConfigInternal,
    AppProjectConfigInternal,
    BuildCommandOptions,
    BuildOptionsInternal,
    LibProjectConfigInternal
} from '../models/internals';
import { formatValidationError, Logger, readJson, validateSchema } from '../utils';

import { getAppWebpackConfig } from './app';
import { getLibWebpackConfig } from './lib';

// tslint:disable:max-func-body-length
export async function getWebpackConfigFromAngularBuildConfig(
    configPath: string,
    env?: string | { [key: string]: boolean | string } | null,
    argv?: BuildCommandOptions | JsonObject | null,
    logger?: Logger): Promise<Configuration[]> {
    const startTime = argv && argv._startTime && typeof argv._startTime === 'number' ? argv._startTime : Date.now();
    if (!configPath || !configPath.length) {
        throw new InvalidConfigError("The 'configPath' is required.");
    }

    if (!/\.json$/i.test(configPath)) {
        throw new InvalidConfigError(`Invalid config file, path: ${configPath}.`);
    }

    if (!await pathExists(configPath)) {
        throw new InvalidConfigError(`The config file does not exist at ${configPath}.`);
    }

    const fromBuiltInCli = argv && typeof argv._fromBuiltInCli === 'boolean' ? argv._fromBuiltInCli : isFromBuiltInCli();

    const prod = argv && typeof argv.prod === 'boolean' ? argv.prod : undefined;
    const verbose = argv && typeof argv.verbose === 'boolean' ? argv.verbose : undefined;
    const environment = env ? normalizeEnvironment(env, prod) : {};

    let buildOptions: BuildOptionsInternal = { environment };
    if (verbose) {
        buildOptions.logLevel = 'debug';
    }

    const cliRootPath = fromBuiltInCli && argv && argv._cliRootPath ? argv._cliRootPath as string : undefined;
    const cliIsGlobal = fromBuiltInCli && argv && argv._cliIsGlobal ? argv._cliIsGlobal as boolean : undefined;
    const cliIsLink = fromBuiltInCli && argv && argv._cliIsLink ? argv._cliIsLink as boolean : undefined;
    const cliVersion = fromBuiltInCli && argv && argv._cliVersion ? argv._cliVersion as string : undefined;

    const filteredConfigNames: string[] = [];

    if (isFromWebpackCli() && !fromBuiltInCli) {
        // from webpack cli
        if (argv && ((argv as JsonObject).configName || (argv as JsonObject)['config-name'])) {
            filteredConfigNames.push((((argv as JsonObject).configName || (argv as JsonObject)['config-name']) as string));
        }

        if (!env && process.env.WEBPACK_ENV) {
            const rawEnvStr = process.env.WEBPACK_ENV;
            const rawEnv = typeof rawEnvStr === 'string'
                ? JSON.parse(rawEnvStr) as JsonObject
                : rawEnvStr as JsonObject;

            if (rawEnv.buildOptions) {
                if (typeof rawEnv.buildOptions === 'object') {
                    buildOptions = { ...buildOptions, ...(rawEnv.buildOptions as JsonObject) };
                }

                delete rawEnv.buildOptions;
            }

            buildOptions.environment = {
                ...buildOptions.environment,
                ...normalizeEnvironment(rawEnv as { [key: string]: boolean | string }, prod)
            };
        }

        if (argv && (argv as JsonObject).mode) {
            if ((argv as JsonObject).mode === 'production') {
                buildOptions.environment.prod = true;
                buildOptions.environment.production = true;

                if (buildOptions.environment.dev) {
                    buildOptions.environment.dev = false;
                }
                if (buildOptions.environment.development) {
                    buildOptions.environment.development = false;
                }
            } else if ((argv as JsonObject).mode === 'development') {
                buildOptions.environment.dev = true;
                buildOptions.environment.development = true;

                if (buildOptions.environment.prod) {
                    buildOptions.environment.prod = false;
                }
                if (buildOptions.environment.production) {
                    buildOptions.environment.production = false;
                }
            }
        }
    } else {
        if (argv) {
            buildOptions = { ...(argv as BuildOptionsInternal), ...buildOptions };
        }

        if (buildOptions.filter && Array.isArray(buildOptions.filter) && buildOptions.filter.length) {
            filteredConfigNames.push(...prepareFilterNames(buildOptions.filter));
        }
    }

    let angularBuildConfig: AngularBuildConfig | null = null;

    try {
        angularBuildConfig = await readJson(configPath) as AngularBuildConfigInternal;
    } catch (jsonErr) {
        // tslint:disable-next-line: no-unsafe-any
        throw new InvalidConfigError(`Invalid configuration, error: ${jsonErr.message || jsonErr}.`);
    }

    const angularBuildConfigSchema = await AngularBuildContext.getAngularBuildConfigSchema();

    if (angularBuildConfig.$schema) {
        delete angularBuildConfig.$schema;
    }

    const errors = validateSchema(angularBuildConfigSchema, angularBuildConfig);
    if (errors.length) {
        const errMsg = errors.map(err => formatValidationError(angularBuildConfigSchema, err)).join('\n');
        throw new InvalidConfigError(
            `Invalid configuration.\n\n${
            errMsg}`);
    }

    // Set angular build defaults
    const angularBuildConfigInternal = angularBuildConfig as AngularBuildConfigInternal;
    angularBuildConfigInternal._schema = angularBuildConfigSchema;
    angularBuildConfigInternal._configPath = configPath;
    angularBuildConfigInternal.libs = angularBuildConfigInternal.libs || [];
    angularBuildConfigInternal.apps = angularBuildConfigInternal.apps || [];

    for (let i = 0; i < angularBuildConfigInternal.libs.length; i++) {
        const libConfig = angularBuildConfigInternal.libs[i];
        libConfig._index = i;
        libConfig._projectType = 'lib';
        libConfig._configPath = configPath;
    }

    for (let i = 0; i < angularBuildConfigInternal.apps.length; i++) {
        const appConfig = angularBuildConfigInternal.apps[i];
        appConfig._index = i;
        appConfig._projectType = 'app';
        appConfig._configPath = configPath;
    }

    if (angularBuildConfigInternal.libs.length === 0 && angularBuildConfigInternal.apps.length === 0) {
        throw new InvalidConfigError('No app or lib project is available.');
    }

    AngularBuildContext.init({
        startTime: startTime,
        logger: logger,
        workspaceRoot: path.dirname(configPath),
        angularBuildConfig: angularBuildConfigInternal,
        fromBuiltInCli: fromBuiltInCli,
        cliRootPath: cliRootPath,
        cliIsGlobal: cliIsGlobal,
        cliIsLink: cliIsLink,
        angularBuildVersion: cliVersion
    });

    return getWebpackConfigsInternal(angularBuildConfigInternal, buildOptions, filteredConfigNames);
}

function prepareFilterNames(filter: string | string[]): string[] {
    const filterNames: string[] = [];

    if (filter &&
        (Array.isArray(filter) || typeof filter === 'string')) {
        if (Array.isArray(filter)) {
            (filter).forEach(filterName => {
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

async function getWebpackConfigsInternal(
    angularBuildConfigInternal: AngularBuildConfigInternal,
    buildOptions: BuildOptionsInternal,
    filteredConfigNames: string[]): Promise<Configuration[]> {
    const webpackConfigs: Configuration[] = [];
    const workspaceRoot = AngularBuildContext.workspaceRoot;

    if (angularBuildConfigInternal.libs.length > 0) {
        let filteredLibConfigs = angularBuildConfigInternal.libs
            .filter(projectConfig =>
                (filteredConfigNames.length === 0 ||
                    (filteredConfigNames.length > 0 &&
                        (filteredConfigNames.includes('libs') ||
                            (projectConfig.name && filteredConfigNames.includes(projectConfig.name))))));

        if (filteredConfigNames.length &&
            filteredConfigNames.filter(configName => configName === 'apps').length === filteredConfigNames.length) {
            filteredLibConfigs = [];
        }

        if (filteredLibConfigs.length > 0) {
            for (const filteredLibConfig of filteredLibConfigs) {
                // cloned
                const libConfigRaw = JSON.parse(JSON.stringify(filteredLibConfig)) as LibProjectConfigInternal;
                await applyProjectConfigExtends(libConfigRaw, angularBuildConfigInternal.libs, workspaceRoot);

                const angularBuildContext = new AngularBuildContext({
                    projectConfigRaw: libConfigRaw,
                    buildOptions: buildOptions
                });
                await angularBuildContext.init();

                if (angularBuildContext.projectConfig.skip) {
                    continue;
                }

                const wpConfig = await getLibWebpackConfig(angularBuildContext) as (Configuration | null);
                if (wpConfig) {
                    webpackConfigs.push(wpConfig);
                }
            }
        }
    }

    if (angularBuildConfigInternal.apps.length > 0) {
        let filteredAppConfigs = angularBuildConfigInternal.apps
            .filter(projectConfig =>
                (filteredConfigNames.length === 0 ||
                    (filteredConfigNames.length > 0 &&
                        (filteredConfigNames.includes('apps') ||
                            (projectConfig.name && filteredConfigNames.includes(projectConfig.name))))));

        if (filteredConfigNames.length &&
            filteredConfigNames.filter(configName => configName === 'libs').length === filteredConfigNames.length) {
            filteredAppConfigs = [];
        }

        if (filteredAppConfigs.length > 0) {
            for (const filteredAppConfig of filteredAppConfigs) {
                const appConfigRaw = JSON.parse(JSON.stringify(filteredAppConfig)) as AppProjectConfigInternal;
                await applyProjectConfigExtends(appConfigRaw, angularBuildConfigInternal.apps, workspaceRoot);

                const angularBuildContext = new AngularBuildContext({
                    projectConfigRaw: appConfigRaw,
                    buildOptions: buildOptions
                    // host: new NodeJsSyncHost()
                });
                await angularBuildContext.init();

                const wpConfig = await getAppWebpackConfig(angularBuildContext) as (Configuration | null);
                if (wpConfig) {
                    webpackConfigs.push(wpConfig);
                }
            }
        }
    }

    if (webpackConfigs.length === 0) {
        throw new InvalidConfigError('No app or lib project is available.');
    }

    return webpackConfigs;
}
