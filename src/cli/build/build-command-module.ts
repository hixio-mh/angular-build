import * as yargs from 'yargs';

import { chageDashCase, colorize, yargsTypeMap } from '../../utils';

// ReSharper disable once CommonJsExternalModule
const schema = require('../../schemas/schema.json');

export function getBuildCommandModule(cliVersion: string): yargs.CommandModule {
    const buildCommandUsage = `\n${colorize(`angular-build ${cliVersion}`, 'green')}\n
Usage:
  ngb build [options...]`;

    const buildCommandModule: yargs.CommandModule = {
        command: 'build',
        describe: 'Build the project(s)',
        builder: (yargv: yargs.Argv) => {
            let yargvObj = yargv
                .reset()
                .usage(buildCommandUsage)
                .example('ngb build', 'Build the project(s) using angular-build.json file.')
                .help('h')
                .option('p',
                    {
                        describe: 'The target project location',
                        type: 'string'
                    })
                .option('progress',
                    {
                        describe: 'Display a compilation progress.',
                        type: 'boolean',
                        default: false
                    })
                .option('profile',
                    {
                        describe:
                            'Capture a "profile" of the application, including statistics and hints, ' +
                                'which can then be dissected using the Analyze tool.',
                        type: 'boolean',
                        default: undefined
                    })
                .option('watch',
                    {
                        describe: 'Build the project(s) with watch mode',
                        type: 'boolean',
                        default: false
                    })
                .option('clean',
                    {
                        describe: 'Clean output directories before build',
                        type: 'boolean',
                        default: false
                    })
                .option('env',
                    {
                        alias: 'environment',
                        describe: 'Additional build target environment'
                });

            const buildOptionsSchema = schema.definitions.BuildOptions.properties;
            Object.keys(buildOptionsSchema).filter((key: string) => key !== 'test' && key !== 'environment').forEach((key: string) => {
                yargvObj = yargvObj.options(chageDashCase(key),
                    {
                        describe: buildOptionsSchema[key].description || key,
                        type: yargsTypeMap(buildOptionsSchema[key].type),
                        default: undefined
                    });
            });

            return yargvObj;
        },
        handler: (null as any)
    };
    return buildCommandModule;
}
