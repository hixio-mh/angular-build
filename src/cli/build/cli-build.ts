import * as path from 'path';
import * as webpack from 'webpack';

import {
    InvalidConfigError,
    ProjectConfigInternal,
    TypescriptCompileError,
    UglifyError,
    UnSupportedStyleExtError
} from '../../models';
import { runWebpack } from '../../helpers/run-webpack';
import { Logger } from '../../utils/logger';
import { getWebpackConfig } from '../../webpack-configs';

import { CliOptions } from '../cli-options';

const { exists } = require('fs-extra');

export async function cliBuild(cliOptions: CliOptions): Promise<number> {
    const startTime = cliOptions.startTime || Date.now();

    const cliIsGlobal = cliOptions.cliIsGlobal;
    const cliRootPath = cliOptions.cliRootPath;
    const cliVersion = cliOptions.cliVersion;

    const commandOptions: { [key: string]: any } =
        cliOptions.commandOptions && typeof cliOptions.commandOptions === 'object' ? cliOptions.commandOptions : {};
    commandOptions.fromAngularBuildCli = true;
    commandOptions.cliIsGlobal = cliIsGlobal;
    commandOptions.cliRootPath = cliRootPath;
    commandOptions.cliVersion = cliVersion;
    commandOptions.startTime = startTime;

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
        logger.error(`angular-build.json config file does not exist - search location: ${configPath}. ` +
            'Please use --config=<your config file> option or make sure angular-build.json is existed in current working directory.\n');
        return -1;
    }

    let webpackConfigs: webpack.Configuration[] = [];
    try {
        webpackConfigs = getWebpackConfig(configPath, environment, commandOptions);
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
            for (const wpConfig of webpackConfigs) {
                delete (wpConfig as any)._projectConfig;
            }

            await runWebpack(webpackConfigs, watch, logger);
        } else {
            let i = 0;
            for (const wpConfig of webpackConfigs) {
                const mappedConfig = (wpConfig as any)._projectConfig as ProjectConfigInternal;

                logger.info(`${i > 0 ? '\n' : ''}Processing ${mappedConfig.name
                    ? mappedConfig.name
                    : mappedConfig._projectType + 's[' + mappedConfig._index + ']'}`);
                delete (wpConfig as any)._projectConfig;
                await runWebpack(wpConfig, false, logger);
                ++i;
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
