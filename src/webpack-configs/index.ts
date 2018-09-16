// tslint:disable:no-any
// tslint:disable:no-unsafe-any

import { existsSync } from 'fs';
import * as path from 'path';

import { NodeJsSyncHost } from '@angular-devkit/core/node';
import * as webpack from 'webpack';

import { AngularBuildContext } from '../build-context';
import { InternalError, InvalidConfigError, InvalidOptionError } from '../error-models';
import {
    applyProjectConfigExtends,
    applyProjectConfigWithEnvironment,
    normalizeEnvironment
} from '../helpers';
import { AngularBuildConfig, BuildCommandOptions } from '../interfaces';
import {
    AngularBuildConfigInternal,
    AppProjectConfigInternal,
    BuildContextStaticOptions,
    BuildOptionInternal,
    LibProjectConfigInternal,
} from '../interfaces/internals';
import { formatValidationError, readJsonSync, validateSchema } from '../utils';

import { getAppWebpackConfig } from './app';
import { getLibWebpackConfig } from './lib';

// tslint:disable:max-func-body-length
export function getWebpackConfigFromAngularBuildConfig(configPath: string, env?: any, argv?: BuildCommandOptions): webpack.Configuration[] {
    let startTime = Date.now();
    if (!configPath || !configPath.length) {
        throw new InvalidOptionError("The 'configPath' is required.");
    }

    if (!/\.json$/i.test(configPath)) {
        throw new InvalidOptionError(`Invalid config file, path: ${configPath}.`);
    }

    if (!existsSync(configPath)) {
        throw new InvalidOptionError(`The angular-build.json config file does not exist at ${configPath}.`);
    }

    let buildOptions: BuildOptionInternal = { environment: {} };

    if (env) {
        buildOptions.environment = normalizeEnvironment(env, argv && argv.prod);
    }

    const fromAngularBuildCli = argv && argv._fromAngularBuildCli ? true : false;
    const cliRootPath = fromAngularBuildCli && argv && argv._cliRootPath ? argv._cliRootPath : undefined;
    const cliIsGlobal = fromAngularBuildCli && argv && argv._cliIsGlobal ? true : false;
    const cliVersion = fromAngularBuildCli && argv && argv._cliVersion ? argv._cliVersion : undefined;

    const verbose = argv && argv.verbose ? true : false;
    if (verbose) {
        buildOptions.logLevel = 'debug';
    }

    buildOptions.watch = argv && (argv.watch || (argv as any).w) ? true : false;
    buildOptions.progress = argv && argv.progress ? true : false;

    const filteredConfigNames: string[] = [];

    if (fromAngularBuildCli) {
        buildOptions.beep = argv && argv.beep;

        if (argv && argv._startTime) {
            startTime = argv._startTime;
        }

        // buildOptions = { ...argv, ...buildOptions };
        buildOptions.cleanOutDir =
            argv &&
                (argv.clean || (argv as any).cleanOutDirs || (argv as any).cleanOutputPath || (argv as any).deleteOutputPath)
                ? true
                : false;
        if (argv && argv.filter && argv.filter.length) {
            filteredConfigNames.push(...prepareFilterNames(argv.filter));
        }
    } else {
        if (argv && ((argv as any).configName || (argv as any)['config-name'])) {
            filteredConfigNames.push(((argv as any).configName || (argv as any)['config-name']));
        }

        if (!env && process.env.WEBPACK_ENV) {
            const rawEnvStr = process.env.WEBPACK_ENV as any;
            const rawEnv: any = typeof rawEnvStr === 'string'
                ? JSON.parse(rawEnvStr)
                : rawEnvStr;
            buildOptions.environment = { ...buildOptions.environment, ...normalizeEnvironment(rawEnv, argv && argv.prod) };
        }

        if (argv && (argv as any).mode) {
            if ((argv as any).mode === 'production') {
                buildOptions.environment.prod = true;
                buildOptions.environment.production = true;

                if (buildOptions.environment.dev) {
                    buildOptions.environment.dev = false;
                }
                if (buildOptions.environment.development) {
                    buildOptions.environment.development = false;
                }
            } else if ((argv as any).mode === 'development') {
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
        angularBuildConfig = readJsonSync(configPath) as AngularBuildConfigInternal;
    } catch (jsonErr) {
        throw new InvalidConfigError(`Invalid configuration, error: ${jsonErr.message || jsonErr}.`);
    }

    // Validate schema
    const schemaFileName = 'schema.json';
    let schemaPath = '';
    if (existsSync(path.resolve(__dirname, `../schemas/${schemaFileName}`))) {
        schemaPath = `../schemas/${schemaFileName}`;
    } else if (existsSync(path.resolve(__dirname, `../../schemas/${schemaFileName}`))) {
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
        fromAngularBuildCli: fromAngularBuildCli,
        angularBuildConfig: angularBuildConfigInternal,
        cliRootPath: cliRootPath,
        cliVersion: cliVersion,
        cliIsGlobal: cliIsGlobal
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

function getWebpackConfigsInternal(angularBuildConfigInternal: AngularBuildConfigInternal,
    buildOptions: BuildOptionInternal,
    staticBuildContextOptions: BuildContextStaticOptions): webpack.Configuration[] {

    const webpackConfigs: webpack.Configuration[] = [];

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
                applyProjectConfigExtends(libConfig, angularBuildConfigInternal.libs);

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

                const wpConfig = getLibWebpackConfig(angularBuildContext) as (webpack.Configuration | null);
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
                applyProjectConfigExtends(appConfig, angularBuildConfigInternal.apps);

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

                const wpConfig = getAppWebpackConfig(angularBuildContext) as (webpack.Configuration | null);
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
