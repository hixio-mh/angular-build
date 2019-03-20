// tslint:disable:no-any
// tslint:disable:no-unsafe-any

import * as path from 'path';

import { pathExists } from 'fs-extra';

import { NodeJsSyncHost } from '@angular-devkit/core/node';
import { Configuration } from 'webpack';

import { AngularBuildContext } from '../build-context';
import {
    applyProjectConfigExtends,
    applyProjectConfigWithEnvironment,
    normalizeEnvironment
} from '../helpers';
import { AngularBuildConfig } from '../models';
import { InternalError, InvalidConfigError } from '../models/errors';
import {
    AngularBuildConfigInternal,
    AppProjectConfigInternal,
    BuildCommandOptions,
    BuildContextStaticOptions,
    BuildOptionsInternal,
    LibProjectConfigInternal

} from '../models/internals';
import { formatValidationError, readJson, validateSchema } from '../utils';

import { getAppWebpackConfig } from './app';
import { getLibWebpackConfig } from './lib';

// tslint:disable:max-func-body-length
export async function getWebpackConfigFromAngularBuildConfig(configPath: string, env?: any, argv?: any): Promise<Configuration[]> {
    let startTime = Date.now();
    if (!configPath || !configPath.length) {
        throw new InvalidConfigError("The 'configPath' is required.");
    }

    if (!/\.json$/i.test(configPath)) {
        throw new InvalidConfigError(`Invalid config file, path: ${configPath}.`);
    }

    if (!await pathExists(configPath)) {
        throw new InvalidConfigError(`The angular-build.json config file does not exist at ${configPath}.`);
    }

    let buildOptions: BuildOptionsInternal = { environment: {} };
    const buildCommandOptions = argv && typeof argv === 'object' ? argv as BuildCommandOptions : {};

    if (env) {
        buildOptions.environment = normalizeEnvironment(env, buildCommandOptions.prod);
    }

    const fromBuiltInCli = buildCommandOptions._fromBuiltInCli;
    const cliRootPath = fromBuiltInCli && buildCommandOptions._cliRootPath ? buildCommandOptions._cliRootPath : undefined;
    const cliIsGlobal = fromBuiltInCli && buildCommandOptions._cliIsGlobal ? true : false;
    const cliIsLink = fromBuiltInCli && buildCommandOptions._cliIsLink ? true : false;
    const cliVersion = fromBuiltInCli && buildCommandOptions._cliVersion ? buildCommandOptions._cliVersion : undefined;
    const verbose = buildCommandOptions.verbose;

    if (verbose) {
        buildOptions.logLevel = 'debug';
    }

    buildOptions.watch = (buildCommandOptions.watch || (buildCommandOptions as any).w) ? true : false;
    buildOptions.progress = buildCommandOptions.progress ? true : false;

    const filteredConfigNames: string[] = [];

    if (fromBuiltInCli) {
        buildOptions.beep = buildCommandOptions.beep;

        if (buildCommandOptions._startTime) {
            startTime = buildCommandOptions._startTime;
        }

        buildOptions.cleanOutDir = buildCommandOptions.clean || (buildCommandOptions as any).cleanOutDirs ||
            (buildCommandOptions as any).cleanOutputPath || (buildCommandOptions as any).deleteOutputPath
            ? true
            : false;
        if (buildCommandOptions.filter && buildCommandOptions.filter.length) {
            filteredConfigNames.push(...prepareFilterNames(buildCommandOptions.filter));
        }
    } else {
        if (((buildCommandOptions as any).configName || (buildCommandOptions as any)['config-name'])) {
            filteredConfigNames.push(((buildCommandOptions as any).configName || (buildCommandOptions as any)['config-name']));
        }

        if (!env && process.env.WEBPACK_ENV) {
            const rawEnvStr = process.env.WEBPACK_ENV as any;
            const rawEnv: any = typeof rawEnvStr === 'string'
                ? JSON.parse(rawEnvStr)
                : rawEnvStr;
            buildOptions.environment = { ...buildOptions.environment, ...normalizeEnvironment(rawEnv, buildCommandOptions.prod) };
        }

        if ((buildCommandOptions as any).mode) {
            if ((buildCommandOptions as any).mode === 'production') {
                buildOptions.environment.prod = true;
                buildOptions.environment.production = true;

                if (buildOptions.environment.dev) {
                    buildOptions.environment.dev = false;
                }
                if (buildOptions.environment.development) {
                    buildOptions.environment.development = false;
                }
            } else if ((buildCommandOptions as any).mode === 'development') {
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

        if (buildOptions.environment.buildOptions) {
            if (typeof buildOptions.environment.buildOptions === 'object') {
                buildOptions = { ...buildOptions, ...((buildOptions as any).environment.buildOptions) };
            }

            delete buildOptions.environment.buildOptions;
        }
    }

    let angularBuildConfig: AngularBuildConfig | null = null;

    try {
        angularBuildConfig = await readJson(configPath) as AngularBuildConfigInternal;
    } catch (jsonErr) {
        throw new InvalidConfigError(`Invalid configuration, error: ${jsonErr.message || jsonErr}.`);
    }

    // Validate schema
    const schemaFileName = 'schema.json';
    let schemaPath = '';
    if (await pathExists(path.resolve(__dirname, `../schemas/${schemaFileName}`))) {
        schemaPath = `../schemas/${schemaFileName}`;
    } else if (await pathExists(path.resolve(__dirname, `../../schemas/${schemaFileName}`))) {
        schemaPath = `../../schemas/${schemaFileName}`;
    }

    if (!schemaPath) {
        throw new InternalError("The angular-build schema file doesn't exist.");
    }

    // tslint:disable-next-line:non-literal-require
    const schema = require(schemaPath);
    if (schema.$schema) {
        delete schema.$schema;
    }
    if (angularBuildConfig.$schema) {
        delete angularBuildConfig.$schema;
    }

    const errors = validateSchema(schema, angularBuildConfig);
    if (errors.length) {
        const errMsg = errors.map(err => formatValidationError(schema, err)).join('\n');
        throw new InvalidConfigError(
            `Invalid configuration.\n\n${
            errMsg}`);
    }

    // Set angular build defaults
    const angularBuildConfigInternal = angularBuildConfig as AngularBuildConfigInternal;
    angularBuildConfigInternal._schema = schema;
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

    const staticBuildContextOptions: BuildContextStaticOptions = {
        workspaceRoot: path.dirname(configPath),
        filteredConfigNames: filteredConfigNames,
        startTime: startTime,
        fromBuiltInCli: fromBuiltInCli,
        angularBuildConfig: angularBuildConfigInternal,
        cliRootPath: cliRootPath,
        cliVersion: cliVersion,
        cliIsGlobal: cliIsGlobal,
        cliIsLink: cliIsLink
    };

    return getWebpackConfigsInternal(angularBuildConfigInternal, buildOptions, staticBuildContextOptions);
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

async function getWebpackConfigsInternal(angularBuildConfigInternal: AngularBuildConfigInternal,
    buildOptions: BuildOptionsInternal,
    staticBuildContextOptions: BuildContextStaticOptions): Promise<Configuration[]> {

    const webpackConfigs: Configuration[] = [];

    const workspaceRoot = staticBuildContextOptions.workspaceRoot;
    const filterNames = staticBuildContextOptions.filteredConfigNames || [];

    if (angularBuildConfigInternal.libs.length > 0) {
        let filteredLibConfigs = angularBuildConfigInternal.libs
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
            for (const filteredLibConfig of filteredLibConfigs) {
                const libConfig = JSON.parse(JSON.stringify(filteredLibConfig)) as LibProjectConfigInternal;

                // extends
                await applyProjectConfigExtends(libConfig, angularBuildConfigInternal.libs);

                const clonedLibConfig = JSON.parse(JSON.stringify(libConfig)) as LibProjectConfigInternal;

                // apply env
                applyProjectConfigWithEnvironment(clonedLibConfig, buildOptions.environment);

                if (clonedLibConfig.skip) {
                    continue;
                }

                const angularBuildContext = new AngularBuildContext({
                    projectConfigWithoutEnvApplied: libConfig,
                    projectConfig: clonedLibConfig,
                    buildOptions: buildOptions,
                    workspaceRoot: workspaceRoot,
                    host: new NodeJsSyncHost(),
                    ...staticBuildContextOptions
                });
                await angularBuildContext.init();

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
                (filterNames.length === 0 ||
                    (filterNames.length > 0 &&
                        (filterNames.includes('apps') ||
                            (projectConfig.name && filterNames.includes(projectConfig.name))))));

        if (filterNames.length &&
            filterNames.filter(configName => configName === 'libs').length === filterNames.length) {
            filteredAppConfigs = [];
        }

        if (filteredAppConfigs.length > 0) {
            for (const filteredAppConfig of filteredAppConfigs) {
                const appConfig = JSON.parse(JSON.stringify(filteredAppConfig)) as AppProjectConfigInternal;

                // extends
                await applyProjectConfigExtends(appConfig, angularBuildConfigInternal.apps);

                const clonedAppConfig = JSON.parse(JSON.stringify(appConfig)) as AppProjectConfigInternal;

                // apply env
                applyProjectConfigWithEnvironment(clonedAppConfig, buildOptions.environment);

                if (clonedAppConfig.skip) {
                    continue;
                }

                const angularBuildContext = new AngularBuildContext({
                    projectConfigWithoutEnvApplied: appConfig,
                    projectConfig: clonedAppConfig,
                    buildOptions: buildOptions,
                    workspaceRoot: workspaceRoot,
                    host: new NodeJsSyncHost(),
                    ...staticBuildContextOptions
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
