import * as yargs from 'yargs';

import { colorize } from '../utils/colorize';

import { CliOptions } from './cli-options';
import { getBuildCommandModule } from './build/build-command-module';

function initYargs(cliVersion: string, args: any[]): yargs.Argv {
    const cliUsage = `\n${colorize(`angular-build ${cliVersion}`, 'white')}\n
Usage:
  ngb command [options...]
  ngb [options]`;

    yargs.parse(args);

    const yargsInstance = yargs
        .usage(cliUsage)
        // .example('ngb new', 'Create a new angular application or library.')
        // .example('ngb init', 'Create required config files for angular-build.')
        .example('ngb build', 'Build the project(s) using angular-build.json file')
        // .example('ngb test', 'Run unit tests.')
        // .example('ngb e2e', 'Run e2e tests.')
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
            type: 'boolean',
            global: false
        })
        // .command(getNewCommandModule(cliVersion))
        // .command(getInitCommandModule(cliVersion))
        // .command(getTestCommandModule(cliVersion))
        // .command(getE2ECommandModule(cliVersion))
        .command(getBuildCommandModule(cliVersion));

    return yargsInstance;
}

function displayAngularBuildVersion(cliOptions: CliOptions): void {
    console.log(`${colorize(
        `\nangular-build ${cliOptions.cliVersion} [${cliOptions.cliIsGlobal ? 'Global' : 'Local'}]`,
        'white')}\n`);
}

export default async function (cliOptions: CliOptions): Promise<number> {
    let isHelpCommand = false;
    if (cliOptions.args && (cliOptions.args as string[]).includes('help')) {
        isHelpCommand = true;
        cliOptions.args = cliOptions.args.filter((p: string) => p !== 'help');
        cliOptions.args.push('-h');

    } else if (cliOptions.args && (cliOptions.args as string[]).includes('--help')) {
        isHelpCommand = true;
        cliOptions.args = cliOptions.args.filter((p: string) => p !== '--help');
        cliOptions.args.push('-h');

    }
    const yargsInstance = initYargs(cliOptions.cliVersion, cliOptions.args);

    const command = yargsInstance.argv._[0] ? yargsInstance.argv._[0].toLowerCase() : undefined;
    const commandOptions = yargsInstance.argv;

    cliOptions.command = command as string;
    cliOptions.commandOptions = commandOptions;

    if (command === 'build') {
        displayAngularBuildVersion(cliOptions);

        // Dynamic require
        // const cliBuildModule = await import('./build/cli-build');
        const cliBuild = require('./build/cli-build').cliBuild;
        return cliBuild(cliOptions).then((exitCode: number) => {
            if (commandOptions.verbose) {
                console.log(`\nTotal time: ${Date.now() - cliOptions.startTime}\n`);
            }
            return exitCode;
        });
    } if (commandOptions.version) {
        return Promise.resolve(cliOptions)
            .then(() => {
                console.log(cliOptions.cliVersion);
                return 0;
            });
    } else if (command === 'help' || commandOptions.help || isHelpCommand) {
        return Promise.resolve(cliOptions)
            .then(() => {
                yargsInstance.showHelp();
                return 0;
            });
    } else {
        return Promise.resolve(cliOptions)
            .then(() => {
                yargsInstance.showHelp();
                return 0;
            });
    }
}
