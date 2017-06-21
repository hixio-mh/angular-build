import * as yargs from 'yargs';

import { chageDashCase, colorize, yargsTypeMap } from '../../utils';

export function getInitCommandModule(cliVersion: string, schemaPart?: Object): yargs.CommandModule {
    const initCommandUsage = `\n${colorize(`angular-build ${cliVersion}`, 'green')}\n
Usage:
  ngb init [options...]`;

    const initCommandModule: yargs.CommandModule = {
        command: 'init',
        describe: 'Create angular-build config files',
        builder: (yargv: yargs.Argv) => {
            let yargvObj = yargv
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

            if (schemaPart) {
                const initSchema = schemaPart as any;
                Object.keys(initSchema)
                    .forEach(
                    (key: string) => {
                        yargvObj = yargvObj.options(chageDashCase(key),
                            {
                                describe: initSchema[key].description || key,
                                type: yargsTypeMap(initSchema[key].type),
                                default: undefined
                            });
                    });
            }

            return yargvObj;
        },
        handler: (null as any)
    };

    return initCommandModule;
}
