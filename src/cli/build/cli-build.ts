// tslint:disable:no-any
// tslint:disable:no-unsafe-any

import * as path from 'path';

import { pathExists } from 'fs-extra';
import * as webpack from 'webpack';

import {
    InvalidConfigError,
    TypescriptCompileError,
    UglifyError,
    UnSupportedStyleExtError
} from '../../error-models';
import { runWebpack } from '../../helpers/run-webpack';
import { BuildCommandOptions } from '../../interfaces';
import { Logger } from '../../utils';
import { getWebpackConfigFromAngularBuildConfig } from '../../webpack-configs';

import { CliOptions } from '../cli-options';

export async function cliBuild(cliOptions: CliOptions): Promise<number> {
    const startTime = cliOptions.startTime || Date.now();
    const commandOptions = initCommandOptions(cliOptions, startTime);
    const logger = new Logger({
        logLevel: 'debug',
        debugPrefix: 'DEBUG:',
        warnPrefix: 'WARNING:'
    });
    const configPath = initConfigPath(commandOptions);
    if (!await pathExists(configPath)) {
        // tslint:disable-next-line:prefer-template
        logger.error(`The angular-build.json config file does not exist at ${configPath}. ` +
            'Please use --config=<your config file> option or make sure angular-build.json is existed in current working directory.\n');

        return -1;
    }

    const watch = commandOptions.watch ? true : false;
    const environment =
        commandOptions.env && typeof commandOptions.env === 'object' ? commandOptions.env : {};

    let webpackConfigs: webpack.Configuration[] = [];
    try {
        webpackConfigs = getWebpackConfigFromAngularBuildConfig(configPath, environment, commandOptions);
    } catch (configErr) {
        if (configErr instanceof InvalidConfigError) {
            logger.error(`${configErr.message}\n`);

            return -1;
        }

        logger.error(`${configErr.stack || configErr.message}\n`);

        return -1;
    }

    if (webpackConfigs.length === 0) {
        logger.error('No app or lib project is available.\n');

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
                err instanceof UglifyError ||
                err instanceof UnSupportedStyleExtError) {
                logger.error(`\n${err.message.trim()}\n`);
            } else {
                logger.error(`${buildErrorMessage(err)}\n`);
            }
        }
    }

    if (commandOptions.beep && process.stdout.isTTY) {
        process.stdout.write('\x07');
    }

    return hasError ? -1 : 0;
}

function initCommandOptions(cliOptions: CliOptions, startTime: number): BuildCommandOptions {
    const commandOptions: BuildCommandOptions =
        cliOptions.args && typeof cliOptions.args === 'object' ? cliOptions.args : {};
    commandOptions._fromAngularBuildCli = true;
    commandOptions._cliIsGlobal = cliOptions.cliIsGlobal;
    commandOptions._cliRootPath = cliOptions.cliRootPath;
    commandOptions._cliVersion = cliOptions.cliVersion;
    commandOptions._startTime = startTime;

    return commandOptions;
}

function initConfigPath(commandOptions: BuildCommandOptions): string {
    let configPath = '';
    if (commandOptions.config) {
        configPath = path.isAbsolute(commandOptions.config)
            ? path.resolve(commandOptions.config)
            : path.resolve(process.cwd(), commandOptions.config);
    } else {
        configPath = path.resolve(process.cwd(), 'angular-build.json');
    }

    return configPath;
}

function buildErrorMessage(err: any): string {
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
