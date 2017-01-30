import * as yargs from 'yargs';
import * as chalk from 'chalk';
import * as path from 'path';

const webpack = require('webpack');
import { getWebpackConfigs } from '../webpack';

import { CliOptions } from './models';

const cliVersion = require('../../package.json').version;
const buildCommandUsage = `\n${chalk.green(`angular-build ${cliVersion}`)}\n
Usage:
  ngb build [options...]`;

export const buildCommandModule: yargs.CommandModule = {
    command: 'build',
    describe: 'Create dll bundling',
    builder: (yargv: yargs.Argv) => {
        return yargv
            .reset()
            .usage(buildCommandUsage)
            .example('ngb build', 'Build/bundle using angular-build.json or angular-cli.json file')
            .help('h')
            .option('performanceHint',
            {
                describe: 'Show performance hint',
                type: 'boolean'
            })
            .option('aot',
            {
                describe: 'Aot build',
                type: 'boolean',
                default: undefined
            })
            .option('progress',
            {
                describe: 'Show progress',
                type: 'boolean'
            })
            .option('dll',
            {
                describe: 'Dll build',
                type: 'boolean',
                default: undefined
            })
            .option('production',
            {
                describe: 'Production build',
                type: 'boolean',
                default: undefined
            })
            .option('project', {
                describe: 'Desire project root folder path, example path include space: use double quotes "C:\\example build\\project" ',
                type: 'string'
            })
            .option("verbose", {
                describe: 'Output everythings',
                type: 'boolean',
                default: undefined
            })
            .option("watch", {
                describe: 'After a change the watcher waits that time (in milliseconds-Default: 300) for more changes.Default: false',
                type: 'boolean'
            })
    },
    handler: null
};

const webpackOutputOptions = {
    colors: true,
    hash: true,
    timings: true,
    chunks: true,
    chunkModules: false,
    children: false, // listing all children is very noisy in AOT and hides warnings/errors
    modules: false,
    reasons: false,
    warnings: true,
    assets: false, // listing all assets is very noisy when using assets directories
    version: false
};

const verboseWebpackOutputOptions = {
    children: true,
    assets: true,
    version: true,
    reasons: true,
    chunkModules: false // TODO: set to true when console to file output is fixed
};

function getWebpackStatsConfig(verbose = false) {
    return verbose
        ? Object.assign(webpackOutputOptions, verboseWebpackOutputOptions)
        : webpackOutputOptions;
}


export function build(cliOptions: CliOptions) {
    return new Promise((resolve, reject) => {

        if (cliOptions.commandOptions.project) {
            cliOptions.cwd = path.isAbsolute(cliOptions.commandOptions.project) ? cliOptions.commandOptions.project : path.join(cliOptions.cwd, cliOptions.commandOptions.project);
        }

        var statsConfig = getWebpackStatsConfig(cliOptions.commandOptions.verbose);
        const config = getWebpackConfigs(cliOptions.cwd, cliOptions.commandOptions);
        let webpackCompiler = webpack(config);
        const callback = (err: any, stats: any) => {

            if (err) {
                return reject(err);
            }

            console.log(stats.toString(statsConfig));

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
    });
}