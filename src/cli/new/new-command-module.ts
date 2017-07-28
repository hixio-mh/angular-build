import * as yargs from 'yargs';

import { colorize } from '../../utils';

export function getNewCommandModule(cliVersion: string): yargs.CommandModule {
    const initCommandUsage = `\n${colorize(`angular-build ${cliVersion}`, 'green')}\n
Usage:
  ngb new [options...]`;

    const newCommandModule: yargs.CommandModule = {
        command: 'new',
        describe: 'Create a new angular app',
        builder: (yargv: yargs.Argv) => {
            const yargvObj = yargv
                .reset()
                .usage(initCommandUsage)
                .example('ngb new --package-manager=yarn',
                    'Create a new angular app with yarn package manager option')
                .help('h')
                .option('package-manager',
                    {
                        describe: 'Package manager for installing dependencies',
                        type: 'string'
                    });

            return yargvObj;
        },
        handler: (null as any)
    };

    return newCommandModule;
}
