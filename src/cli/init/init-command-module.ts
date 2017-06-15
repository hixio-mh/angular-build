import * as yargs from 'yargs';

import { colorize } from '../../utils';

export function getInitCommandModule(cliVersion: string): yargs.CommandModule {
    const initCommandUsage = `\n${colorize(`angular-build ${cliVersion}`, 'green')}\n
Usage:
  ngb init [options...]`;

    const initCommandModule: yargs.CommandModule = {
        command: 'init',
        describe: 'Create angular-build config files',
        builder: (yargv: yargs.Argv) => {
            const yargvObj = yargv
                .reset()
                .usage(initCommandUsage)
                .example('ngb init --package-manager=yarn',
                    'Create angular-build config files with yarn package manager option')
                .help('h')
                .option('override-angular-build-config-file',
                    {
                        describe: 'Override existing angular-build.json file',
                        type: 'boolean',
                        default: undefined
                    })
                .option('include-test-configs',
                    {
                        describe: 'Include test configs',
                        type: 'boolean',
                        default: false
                    })
                .option('package-manager',
                    {
                        describe: 'Package manager to use while installing dependencies',
                        type: 'string'
                    })
                .option('l',
                    {
                        alias: 'link',
                        describe: 'Link angular-build cli to current project',
                        type: 'boolean',
                        default: false
                    });
            return yargvObj;
        },
        handler: (null as any)
    };

    return initCommandModule;
}