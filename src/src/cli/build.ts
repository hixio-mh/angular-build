import * as path from 'path';
import * as chalk from 'chalk';
import * as yargs from 'yargs';
import * as webpack from 'webpack';

import { getWebpackConfigs } from '../webpack-configs';

import { CliOptions } from './models';

import {chageDashCase, mapToYargsType } from '../utils';

const cliVersion = require('../../package.json').version;


const schema: any = require('../../configs/schema.json');

export const buildCommandUsage = `\n${chalk.green(`angular-build ${cliVersion}`)}\n
Usage:
  ngb build [options...]`;

export function getBuildCommandModule() {
    const buildCommandModule: yargs.CommandModule = {
        command: 'build',
        describe: 'Build/bundle the app(s)',
        builder: (yargv: yargs.Argv) => {
            let yargvObj = yargv
                .reset()
                .usage(buildCommandUsage)
                .example('ngb build', 'Build/bundle the app(s) using angular-build.json or angular-cli.json file')
                .help('h')
                .option('project',
                {
                    describe: 'The target project location',
                    type: 'string'
                })
                .option('watch',
                {
                    describe: 'Build/bundle the app(s) with watch mode',
                    type: 'boolean'
                });

            const buildOptionsSchema = schema.definitions.BuildOptions.properties;
            Object.keys(buildOptionsSchema).forEach((key: string) => {
                yargvObj = yargvObj.options(chageDashCase(key),
                    {
                        describe: buildOptionsSchema[key].description || key,
                        type: mapToYargsType(buildOptionsSchema[key].type),
                        default: undefined
                    });
            });

            return yargvObj;
        },
        handler: null
    };
    return buildCommandModule;
}

export function build(cliOptions: CliOptions): Promise<number> {

    return new Promise((resolve, reject) => {
        if (cliOptions.commandOptions.project) {
            cliOptions.cwd = path.isAbsolute(cliOptions.commandOptions.project)
                ? cliOptions.commandOptions.project
                : path.resolve(cliOptions.cwd, cliOptions.commandOptions.project);
        }
        const buildOptions: any = {};
        if (cliOptions.commandOptions && typeof cliOptions.commandOptions === 'object') {
            const buildOptionsSchema = schema.definitions.BuildOptions.properties;
            Object.keys(cliOptions.commandOptions).filter((key: string) => buildOptionsSchema[key])
                .forEach((key: string) => {
                    buildOptions[key] = cliOptions.commandOptions[key];
                });
        }
        const configs = getWebpackConfigs(cliOptions.cwd, null, buildOptions);
        if (!configs || !configs.length) {
            reject(`Error in getting webpack configs. Received empty config.`);
        }
        const webpackCompiler = webpack(configs);
        const callback: webpack.compiler.CompilerCallback = (err: Error, stats: webpack.compiler.Stats) => {
            if (err) {
                return reject(err);
            }
            console.log(stats.toString(configs[0].stats));
            if (cliOptions.commandOptions.watch) {
                return;
            }

            if (stats.hasErrors()) {
                reject();
            } else {
                resolve();
            }
        };

        if (cliOptions.commandOptions.watch) {
            webpackCompiler.watch({}, callback);
        } else {
            webpackCompiler.run(callback);
        }
    }).then(() => 0);
}