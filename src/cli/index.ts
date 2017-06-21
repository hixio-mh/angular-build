import * as fs from 'fs-extra';
import * as path from 'path';
import * as yargs from 'yargs';

import { CliOptions } from './cli-options';
import { init, getInitCommandModule } from './init';
import { cliBuild, getBuildCommandModule } from './build';

import { Logger, colorize } from '../utils';

function initYargs(cliVersion: string, schema: Object, args: any[]): yargs.Argv {

    const buildOptionsSchema = (schema as any).definitions.BuildOptions.properties;

    const cliUsage = `\n${colorize(`angular-build ${cliVersion}`, 'green')}\n
Usage:
  ngb command [options...]
  ngb [options]`;

    yargs.parse(args);

    const yargsInstance = yargs
        .usage(cliUsage)
        .example('ngb init', 'Create required config files for angular-build.')
        .example('ngb build', 'Build/bundle the projet(s) using angular-build.json file.')
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
        .command(getInitCommandModule(cliVersion))
        .command(getBuildCommandModule(cliVersion, buildOptionsSchema));
    return yargsInstance;
}

// ReSharper disable once CommonJsExternalModule
module.exports = (options: {
    cliArgs?: any;
    inputStream?: NodeJS.Socket;
    outputStream?: NodeJS.Socket;
    errorStream?: NodeJS.Socket;
    cliVersion: string;
    cliIsLocal?: boolean;
}): Promise<number> => {
    // ensure the environemnt variable for dynamic paths
    process.env.PWD = path.normalize(process.env.PWD || process.cwd());
    process.env.NGB = 'ngb';

    const cliVersion = options.cliVersion;
    const logger = new Logger(options.outputStream, options.errorStream);

    // schema
    let schemaPath = './schemas/schema.json';
    if (!fs.existsSync(path.resolve(__dirname, schemaPath))) {
        schemaPath = '../schemas/schema.json';
    }
    if (!fs.existsSync(path.resolve(__dirname, schemaPath))) {
        schemaPath = '../../schemas/schema.json';
    }
    const schema = require(schemaPath);

    // init yargs
    const yargsInstance = initYargs(cliVersion, schema, options.cliArgs);
    const command = yargsInstance.argv._[0] ? yargsInstance.argv._[0].toLowerCase() : undefined;
    const commandOptions = yargsInstance.argv;

    const cliOptions: CliOptions = {
        cliVersion: options.cliVersion,
        cwd: process.cwd(),
        command: command,
        commandOptions: commandOptions,
        cliIsLocal: options.cliIsLocal
    };

    if (command === 'init') {
        return init(cliOptions, logger);
    } else if (command === 'build') {
        return cliBuild(cliOptions, logger);
    } else if (commandOptions.version) {
        return Promise.resolve(cliOptions)
            .then(() => {
                // console.log(cliVersion);
                logger.logLine(cliVersion);
                return 0;
            });
    } else if (command === 'help' || commandOptions.help) {
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
};
