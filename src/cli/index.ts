import * as chalk from 'chalk';
import * as yargs from 'yargs';

const cliVersion = require('../../package.json').version;

const cliUsage = `\n${chalk.green(`angular-build ${cliVersion}`)}\n
Usage:
  ngb command [options...]
  ngb [options]`;

import { CliOptions } from './models';
import { init, getInitCommandModule } from './init';
import { build, getBuildCommandModule } from './build';

// ReSharper disable once CommonJsExternalModule
module.exports = (cliOptions: CliOptions) => {
    // init yargs
    const yargsInstance = initYargs();
    const command = yargsInstance.argv._[0] ? yargsInstance.argv._[0].toLowerCase() : undefined;
    const commandOptions = yargsInstance.argv;

    cliOptions.cwd = cliOptions.cwd || process.cwd();

    cliOptions.command = command;
    cliOptions.commandOptions = commandOptions;


    if (command === 'init') {
        return init(cliOptions);
    } else if (command === 'build') {
        return build(cliOptions);
    } else if (commandOptions.version) {
        console.log(cliVersion);
        return Promise.resolve(0);
    } else if (command === 'help' || commandOptions.help) {
        yargsInstance.showHelp();
        return Promise.resolve(0);
    } else {
        yargsInstance.showHelp();
        return Promise.resolve(0);
    }
}

function initYargs(): yargs.Argv {
    const yargsInstance = yargs
        .usage(cliUsage)
        .example('ngb init', 'Create required config files for angular-build')
        .example('ngb build', 'Build/bundle the app(s) using angular-build.json or angular-cli.json file')
        .example('ngb -h', 'Show help')
        .option('h',
        {
            alias: ['help', '?'],
            describe: 'Show help',
            type: 'boolean'
        })
        .option('v',
        {
            alias: 'version',
            describe: 'Show version',
            type: 'boolean'
        })
        .command(getInitCommandModule(cliVersion))
        .command(getBuildCommandModule(cliVersion));
    return yargsInstance;
}