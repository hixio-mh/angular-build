import * as path from 'path';

import * as webpack from 'webpack';

import { colorize } from '../../utils';
import { CliOptions } from '../cli-options';

import {
    AngularBuildConfigInternal,
    AngularBuildContextImpl,
    AppBuildContext,
    InvalidConfigError,
    LibProjectConfigInternal,
    PreDefinedEnvironment,
    ProjectConfigInternal,
    TypescriptCompileError,
    UglifyError,
    UnSupportedStyleExtError
} from '../../models';
import {
    applyAngularBuildConfigDefaults,
    applyProjectConfigDefaults,
    applyProjectConfigWithEnvOverrides,
    validateProjectConfig
} from '../../helpers';
import { formatValidationError, Logger, readJson, validateSchema } from '../../utils';

import { getLibWebpackConfig } from '../../webpack-configs/lib';
import { getAppDllWebpackConfig } from '../../webpack-configs/app/dll';
import { getAppWebpackConfig } from '../../webpack-configs/app/app';

const { exists } = require('fs-extra');

export async function cliBuild(cliOptions: CliOptions): Promise<number> {
    const startTime = Date.now();
    const logger = new Logger({
        logLevel: 'debug',
        debugPrefix: 'DEBUG:',
        warnPrefix: 'WARNING:'
    });

    logger.info(`${colorize(
        `\nangular-build ${cliOptions.cliVersion} [${cliOptions.cliIsGlobal ? 'Global' : 'Local'}]`,
        'white')}\n`);

    let environment: PreDefinedEnvironment = {};
    let configPath = path.resolve(process.cwd(), 'angular-build.json');
    let cliIsGlobal = cliOptions.cliIsGlobal;
    let watch = false;
    let verbose = false;
    let progress = false;
    let cleanOutDirs = false;
    const filter: string[] = [];

    if (cliOptions.commandOptions && typeof cliOptions.commandOptions === 'object') {
        const commandOptions = cliOptions.commandOptions as any;
        if (commandOptions.env && typeof commandOptions.env === 'object') {
            environment = Object.assign(environment, commandOptions.env);
        }

        if (commandOptions.config) {
            configPath = path.isAbsolute(commandOptions.config)
                ? path.resolve(commandOptions.config)
                : path.resolve(process.cwd(), commandOptions.config);
        }

        if (commandOptions.filter &&
            (Array.isArray(commandOptions.filter) || typeof commandOptions.filter === 'string')) {
            Array.isArray(commandOptions.filter)
                ? filter.push(...commandOptions.filter)
                : filter.push(commandOptions.filter);
        }

        if (commandOptions.cleanOutDirs && typeof commandOptions.cleanOutDirs === 'boolean') {
            cleanOutDirs = true;
        }

        if (commandOptions.watch && typeof commandOptions.watch === 'boolean') {
            watch = true;
        }

        if (commandOptions.verbose && typeof commandOptions.verbose === 'boolean') {
            verbose = true;
        }

        if (commandOptions.progress && typeof commandOptions.progress === 'boolean') {
            progress = true;
        }
    }

    if (!/\.json$/i.test(configPath)) {
        logger.error(`Invalid config file, path: ${configPath}.`);
        return -1;
    }

    if (!await exists(configPath)) {
        logger.error(`Config file does not exist, path: ${configPath}.`);
        return -1;
    }

    let angularBuildConfig: AngularBuildConfigInternal | null = null;

    try {
        angularBuildConfig = await readJson(configPath) as AngularBuildConfigInternal;
    } catch (jsonErr) {
        logger.error(`Invalid configuration, error: ${jsonErr.message || jsonErr}.`);
        return -1;
    }

    // validate schema
    let schemaPath = '../schemas/schema.json';
    if (!await exists(path.resolve(__dirname, schemaPath))) {
        schemaPath = '../../schemas/schema.json';
    }
    if (!await exists(path.resolve(__dirname, schemaPath))) {
        schemaPath = '../../../schemas/schema.json';
    }
    if (await exists(path.resolve(__dirname, schemaPath))) {
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
            logger.error(
                `Invalid configuration.\n\n${
                errMsg}\n`);
            return -1;
        }

        angularBuildConfig._schema = schema;
        angularBuildConfig._schemaValidated = true;
    } else {
        logger.warn(`The angular-build schema file doesn't exist`);
    }

    // set angular build defaults
    applyAngularBuildConfigDefaults(angularBuildConfig);
    if (verbose) {
        angularBuildConfig.logLevel = 'debug';
    }

    const libConfigs = angularBuildConfig.libs || [];
    const appConfigs = angularBuildConfig.apps || [];

    if (appConfigs.length === 0 && libConfigs.length === 0) {
        logger.error(`No app or lib project is available.`);
        return - 1;
    }

    const projectRoot = path.dirname(configPath);

    // apply filter
    const configNames: string[] = [];
    if (filter && filter.length) {
        filter
            .filter(configName => !configNames.includes(configName)).forEach(
            configName => configNames.push(configName));
    }

    const webpackConfigs: webpack.Configuration[] = [];

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
            for (let i = 0; i < filteredLibConfigs.length; i++) {
                const libConfig = filteredLibConfigs[i];

                const clonedLibConfig = JSON.parse(JSON.stringify(libConfig)) as LibProjectConfigInternal;
                applyProjectConfigWithEnvOverrides(clonedLibConfig, environment);

                if (clonedLibConfig.skip) {
                    continue;
                }

                try {
                    validateProjectConfig(projectRoot, clonedLibConfig);
                    applyProjectConfigDefaults(projectRoot, clonedLibConfig, environment);

                    const angularBuildContext = new AngularBuildContextImpl(
                        environment,
                        configPath,
                        angularBuildConfig,
                        libConfig as ProjectConfigInternal,
                        clonedLibConfig);

                    angularBuildContext.ngbCli = true;
                    angularBuildContext.cliIsGlobal = cliIsGlobal;
                    angularBuildContext.watch = watch;
                    angularBuildContext.progress = progress;
                    angularBuildContext.cleanOutDirs = cleanOutDirs;

                    const wpConfig = getLibWebpackConfig(angularBuildContext);
                    if (wpConfig) {
                        (wpConfig as any)._projectConfig = clonedLibConfig;
                        webpackConfigs.push(wpConfig);
                    }
                } catch (configErr) {
                    if (!configErr) {
                        return -1;
                    }

                    if (configErr instanceof InvalidConfigError) {
                        logger.error(`\n${configErr.message}`);
                        return -1;
                    } else {
                        throw configErr;
                    }
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

                if (clonedAppConfig.skip) {
                    continue;
                }

                try {
                    validateProjectConfig(projectRoot, clonedAppConfig);
                    applyProjectConfigDefaults(projectRoot, clonedAppConfig, environment);

                    const angularBuildContext = new AngularBuildContextImpl(
                        environment,
                        configPath,
                        angularBuildConfig,
                        appConfig as ProjectConfigInternal,
                        clonedAppConfig);

                    angularBuildContext.ngbCli = true;
                    angularBuildContext.cliIsGlobal = cliIsGlobal;
                    angularBuildContext.watch = watch;
                    angularBuildContext.progress = progress;
                    angularBuildContext.cleanOutDirs = cleanOutDirs;

                    if (environment.dll) {
                        (angularBuildContext as AppBuildContext).dllBuildOnly = true;
                        const wpConfig = getAppDllWebpackConfig(angularBuildContext);
                        if (wpConfig) {
                            (wpConfig as any)._projectConfig = clonedAppConfig;
                            webpackConfigs.push(wpConfig);
                        }
                    } else {
                        const wpConfig = getAppWebpackConfig(angularBuildContext);
                        if (wpConfig) {
                            (wpConfig as any)._projectConfig = clonedAppConfig;
                            webpackConfigs.push(wpConfig);
                        }
                    }
                } catch (configErr2) {
                    if (!configErr2) {
                        return -1;
                    }

                    if (configErr2 instanceof InvalidConfigError) {
                        logger.error(`\n${configErr2.message}`);
                        return -1;
                    } else {
                        throw configErr2;
                    }
                }
            }
        }
    }

    if (webpackConfigs.length === 0) {
        logger.error(`No app or lib project is available.`);
        return - 1;
    }

    try {
        if (watch) {
            for (let wpConfig of webpackConfigs) {
                delete (wpConfig as any)._projectConfig;
            }

            await runWebpack(webpackConfigs, watch, logger);
        } else {
            for (let wpConfig of webpackConfigs) {
                const mappedConfig = (wpConfig as any)._projectConfig as ProjectConfigInternal;
                logger.debug(`Processing ${mappedConfig.name
                    ? mappedConfig.name
                    : mappedConfig._projectType + '[' + mappedConfig._index + ']'}`);
                delete (wpConfig as any)._projectConfig;
                await runWebpack(wpConfig, false, logger);
            }
        }

        logger.info(`Build completed in [${Date.now() - startTime}ms]`);
        return 0;
    } catch (err) {
        if (!err) {
            return -1;
        }

        if (err instanceof InvalidConfigError ||
            err instanceof TypescriptCompileError ||
            err instanceof UglifyError ||
            err instanceof UnSupportedStyleExtError) {
            logger.error(`\n${err.message}`);
        } else {
            let errMsg = '\n';
            if (err.message && err.message.length && err.message !== err.stack) {
                errMsg += err.message;
            }
            if ((err as any).details &&
                (err as any).details.length &&
                (err as any).details !== err.stack &&
                (err as any).details !== err.message) {
                if (errMsg.trim()) {
                    errMsg += '\nError Details:\n';
                }
                errMsg += (err as any).details;
            }
            if (err.stack && err.stack.length && err.stack !== err.message) {
                if (errMsg.trim()) {
                    errMsg += '\nCall Stack:\n';
                }
                errMsg += err.stack;
            }
            logger.error(errMsg);
        }

        return -1;
    }
}


function runWebpack(wpConfig: webpack.Configuration | webpack.Configuration[],
    watch: boolean,
    logger: Logger): Promise<any> {

    const firstConfig = Array.isArray(wpConfig) ? wpConfig[0] : wpConfig;
    const webpackCompiler = webpack(wpConfig as any);
    const statsOptions = firstConfig.stats;
    const watchOptions = firstConfig.watchOptions;
    // if (Array.isArray(wpConfig) && wpConfig.length > 1 && statsOptions && !statsOptions.children) {
    //    statsOptions.children = true; // wpConfig.map((o: webpack.Configuration) => o.stats) as any;
    // }

    return new Promise((resolve, reject) => {
        const callback: webpack.compiler.CompilerCallback = (err: any, stats: webpack.compiler.Stats) => {
            if (!watch || err) {
                // Do not keep cache anymore
                (webpackCompiler as any).purgeInputFileSystem();
            }

            if (err) {
                return reject(err);
            }

            if (watch) {
                return;
            }

            if (stats.hasErrors()) {
                logger.error(stats.toString('errors-only'));
                return reject();
            } else {
                if (statsOptions) {
                    logger.info(stats.toString(statsOptions));
                }
                resolve();
            }
        };

        if (watch) {
            webpackCompiler.watch(watchOptions as webpack.WatchOptions, callback);
            logger.info('\nWebpack is watching the files…\n');
        } else {
            webpackCompiler.run(callback);
        }
    });
}
