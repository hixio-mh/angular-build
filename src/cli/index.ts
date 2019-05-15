import * as yargs from 'yargs';

import { JsonObject } from '../models';
import { colorize } from '../utils/colorize';

import { getBuildCommandModule } from './build/build-command-module';
import { CliOptions } from './cli-options';

function initYargs(cliVersion: string, args?: string[]): yargs.Argv {
    const cliUsage = `\n${colorize(`angular-build ${cliVersion}`, 'white')}\n
Usage:
  ngb command [options...]
  ngb [options]`;

    if (args) {
        yargs.parse(args);
    }

    // tslint:disable-next-line:no-unnecessary-local-variable
    const yargsInstance = yargs
        .usage(cliUsage)
        .example('ngb build', 'Build the project(s) using angular-build.json file')
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
        .command(getBuildCommandModule(cliVersion));

    return yargsInstance;
}

function displayAngularBuildVersion(cliOptions: CliOptions): void {
    // tslint:disable-next-line:no-console
    console.log(`${colorize(
        `\nangular-build ${cliOptions.cliVersion} [${cliOptions.cliIsGlobal
            ? 'Global'
            : cliOptions.cliIsLink
                ? 'Local - link'
                : 'Local'}]`,
        'white')}\n`);
}

// tslint:disable-next-line:no-default-export
export default async function (cliOptions: CliOptions): Promise<number> {
    let args = process.argv.slice(2);
    let isHelpCommand = false;
    if (args.includes('help')) {
        isHelpCommand = true;
        args = args.filter((p: string) => p !== 'help');
        args.push('-h');
    } else if (args.includes('--help')) {
        isHelpCommand = true;
        args = args.filter((p: string) => p !== '--help');
        args.push('-h');
    }

    const yargsInstance = initYargs(cliOptions.cliVersion, args);
    const command = yargsInstance.argv._[0] ? yargsInstance.argv._[0].toLowerCase() : undefined;
    const commandOptions = yargsInstance.argv as JsonObject;

    if (command === 'build') {
        displayAngularBuildVersion(cliOptions);

        // Dynamic require
        const cliBuildModule = await import('./build/cli-build');
        const cliBuild = cliBuildModule.cliBuild;

        return cliBuild({ ...cliOptions, commandOptions: commandOptions });
    }
    if (commandOptions.version) {
        return Promise.resolve(cliOptions)
            .then(() => {
                // tslint:disable-next-line:no-console
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
