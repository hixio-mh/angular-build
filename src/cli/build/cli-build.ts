import * as path from 'path';

import { pathExists } from 'fs-extra';
import * as webpack from 'webpack';

import { runWebpack } from '../../helpers';
import { InvalidConfigError, TypescriptCompileError, UnsupportedStyleExtError } from '../../models/errors';
import { BuildCommandOptions } from '../../models/internals';

import { Logger } from '../../utils';
import { getWebpackConfigFromAngularBuildConfig } from '../../webpack-configs';

import { CliOptions } from '../cli-options';

export async function cliBuild(cliOptions: CliOptions): Promise<number> {
    const startTime = cliOptions.startTime || Date.now();
    let environment: string | { [key: string]: boolean | string } | null = null;
    if (cliOptions.commandOptions && cliOptions.commandOptions.environment) {
        environment = cliOptions.commandOptions.environment as { [key: string]: boolean | string } | string;
        delete cliOptions.commandOptions.environment;
    }
    if (cliOptions.commandOptions && cliOptions.commandOptions.env) {
        if (environment == null) {
            environment = cliOptions.commandOptions.env as { [key: string]: boolean | string } | string;
        }
        delete cliOptions.commandOptions.env;
    }

    const buildCommandOptions = initBuildCommandOptions(cliOptions, startTime);

    const logger = new Logger({
        logLevel: buildCommandOptions.logLevel ? buildCommandOptions.logLevel : 'info',
        debugPrefix: 'DEBUG:',
        warnPrefix: 'WARNING:'
    });

    const configPath = initConfigPath(buildCommandOptions);
    if (!await pathExists(configPath)) {
        logger.error(`The angular-build.json config file does not exist at ${configPath}. `);

        return -1;
    }

    const watch = buildCommandOptions.watch ? true : false;

    let webpackConfigs: webpack.Configuration[] = [];
    try {
        webpackConfigs = await getWebpackConfigFromAngularBuildConfig(configPath, environment, buildCommandOptions, logger);
    } catch (configErr) {
        if (configErr instanceof InvalidConfigError) {
            logger.error(`${configErr.message}\n`);

            return -1;
        } else if (configErr) {
            logger.error(`${(configErr as Error).stack || (configErr as Error).message || configErr}\n`);
        }

        return -1;
    }

    if (webpackConfigs.length === 0) {
        logger.error('No project is available to build.\n');

        return -1;
    }

    let hasError = false;

    try {
        if (watch) {
            await runWebpack(webpackConfigs, watch, logger);
        } else {
            for (const wpConfig of webpackConfigs) {
                await runWebpack(wpConfig, false, logger);
            }
        }

        const duration = Date.now() - startTime;
        logger.info(`\nBuild all completed in [${duration}ms]\n`);
    } catch (err) {
        hasError = true;

        if (err) {
            if (err instanceof InvalidConfigError ||
                err instanceof TypescriptCompileError ||
                err instanceof UnsupportedStyleExtError) {
                logger.error(`\n${err.message.trim()}\n`);
            } else {
                logger.error(`${buildErrorMessage(err as Error)}\n`);
            }
        }
    }

    if (buildCommandOptions.beep && process.stdout.isTTY) {
        process.stdout.write('\x07');
    }

    return hasError ? -1 : 0;
}

function initBuildCommandOptions(cliOptions: CliOptions, startTime: number): BuildCommandOptions {
    const buildCommandOptions: BuildCommandOptions =
        cliOptions.commandOptions &&
            typeof cliOptions.commandOptions === 'object' ?
            cliOptions.commandOptions : {};

    buildCommandOptions._fromBuiltInCli = true;
    buildCommandOptions._cliIsGlobal = cliOptions.cliIsGlobal;
    buildCommandOptions._cliIsLink = cliOptions.cliIsLink;
    buildCommandOptions._cliRootPath = cliOptions.cliRootPath;
    buildCommandOptions._cliVersion = cliOptions.cliVersion;
    buildCommandOptions._startTime = startTime;

    return buildCommandOptions;
}

function initConfigPath(buildCommandOptions: BuildCommandOptions): string {
    let configPath = '';
    if (buildCommandOptions.config) {
        configPath = path.isAbsolute(buildCommandOptions.config)
            ? path.resolve(buildCommandOptions.config)
            : path.resolve(process.cwd(), buildCommandOptions.config);
    } else {
        configPath = path.resolve(process.cwd(), 'angular-build.json');
    }

    return configPath;
}

function buildErrorMessage(err: Error & { details?: string }): string {
    let errMsg = '\n';
    if (err.message && err.message.length && err.message !== err.stack) {
        errMsg += err.message;
    }
    if (err.details &&
        err.details.length &&
        err.details !== err.stack &&
        err.details !== err.message) {
        if (errMsg.trim()) {
            errMsg += '\nError Details:\n';
        }
        errMsg += err.details;
    } else if (err.stack && err.stack.length && err.stack !== err.message) {
        if (errMsg.trim()) {
            errMsg += '\nCall Stack:\n';
        }
        errMsg += err.stack;
    }

    return errMsg;
}
