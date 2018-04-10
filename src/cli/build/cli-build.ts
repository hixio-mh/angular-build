import * as path from 'path';
import * as webpack from 'webpack';

import { runWebpack } from '../../helpers/run-webpack';
import {
    InvalidConfigError,
    TypescriptCompileError,
    UglifyError,
    UnSupportedStyleExtError
    } from '../../error-models';
import { Logger } from '../../utils';
import { getWebpackConfigFromAngularBuildConfig } from '../../webpack-configs';

import { CliOptions } from '../cli-options';

const { exists } = require('fs-extra');

export async function cliBuild(cliOptions: CliOptions): Promise<number> {
    const startTime = cliOptions.startTime || Date.now();

    const commandOptions: { [key: string]: any } =
        cliOptions.args && typeof cliOptions.args === 'object' ? cliOptions.args : {};
    commandOptions._fromAngularBuildCli = true;
    commandOptions._cliIsGlobal = cliOptions.cliIsGlobal;
    commandOptions._cliRootPath = cliOptions.cliRootPath;
    commandOptions._cliVersion = cliOptions.cliVersion;
    commandOptions._startTime = startTime;

    let configPath = '';
    if (commandOptions.config) {
        configPath = path.isAbsolute(commandOptions.config)
            ? path.resolve(commandOptions.config)
            : path.resolve(process.cwd(), commandOptions.config);
    } else {
        configPath = path.resolve(process.cwd(), 'angular-build.json');
    }

    const watch = commandOptions.watch ? true : false;
    const environment =
        commandOptions.env && typeof commandOptions.env === 'object' ? commandOptions.env : {};

    const logger = new Logger({
        logLevel: 'debug',
        debugPrefix: 'DEBUG:',
        warnPrefix: 'WARNING:'
    });

    if (!await exists(configPath)) {
        logger.error(`The angular-build.json config file does not exist at ${configPath}. ` +
            'Please use --config=<your config file> option or make sure angular-build.json is existed in current working directory.\n');
        return -1;
    }

    let webpackConfigs: webpack.Configuration[] = [];
    try {
        webpackConfigs = getWebpackConfigFromAngularBuildConfig(configPath, environment, commandOptions);
    } catch (err1) {
        if (err1 instanceof InvalidConfigError) {
            logger.error(`${err1.message}\n`);
            return -1;
        }

        logger.error(`${err1.stack || err1.message}\n`);
        return -1;
    }

    if (webpackConfigs.length === 0) {
        logger.error('No app or lib project is available.\n');
        return -1;
    }

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

        if (commandOptions.beep && process.stdout.isTTY) {
            process.stdout.write('\x07');
        }

        return 0;
    } catch (err) {
        if (err) {
            if (err instanceof InvalidConfigError ||
                err instanceof TypescriptCompileError ||
                err instanceof UglifyError ||
                err instanceof UnSupportedStyleExtError) {
                logger.error(`\n${err.message.trim()}\n`);
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
                } else if (err.stack && err.stack.length && err.stack !== err.message) {
                    if (errMsg.trim()) {
                        errMsg += '\nCall Stack:\n';
                    }
                    errMsg += err.stack;
                }

                logger.error(errMsg + '\n');
            }
        }

        if (commandOptions.beep && process.stdout.isTTY) {
            process.stdout.write('\x07');
        }

        return -1;
    }
}
