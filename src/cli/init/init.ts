import * as fs from 'fs-extra';
import * as path from 'path';

import { CliOptions } from '../cli-options';

import { AngularBuildConfig } from '../../models';
import { colorize, Logger, spawnPromise } from '../../utils';

const pkgConfig = require('../../../package.json');


export interface CommandOptions {
    /**
     * Overrides angular-build.json file.
     */
    overrideAngularBuildConfigFile?: boolean;
    /**
     * Package manager to use while installing dependencies.
     * @default npm
     */
    packageManager?: 'npm' | 'yarn';
    /**
     * Link angular-build cli to current project.
     * @default false
     */
    link?: boolean;
}


export interface InitConfig {
    logger: Logger;
    cwd: string;
    cliIsLocal?: boolean;

    commandOptions?: CommandOptions;

    tsConfigMaster?: any;
    tsConfigBrowserMaster?: any;
    tsConfigServerMaster?: any;
    tsConfigTestMaster?: any;

    angularBuildConfigMaster?: AngularBuildConfig;
    userAngularBuildConfig?: AngularBuildConfig;

    userAngularCliConfig?: any;


    faviconConfigMaster?: any;
    userFaviconConfig?: any;

    userPackageConfig?: any;
}

export async function init(cliOptions: CliOptions, logger: Logger = new Logger()): Promise<number> {
    const projectRoot = cliOptions.cwd || process.cwd();
    logger.logLine(`\n${colorize(`angular-build ${cliOptions.cliVersion}`, 'green')}`);

    const cfg: InitConfig = {
        logger: logger,
        cwd: projectRoot,
        cliIsLocal: cliOptions.cliIsLocal,
        commandOptions: Object.assign({}, cliOptions.commandOptions || {})
    };

    // let progress = 0;
    await installWebpackLoaders(cfg);

    cfg.logger.logLine('Done.');
    return 0;
}

async function installWebpackLoaders(cfg: InitConfig): Promise<void> {
    const commandOptions = cfg.commandOptions || {} as CommandOptions;

    const loaderPeerDeps = [
        // '@angular/compiler-cli',
        // '@angular/compiler',
        // '@angular/core',
        // '@ngtools/webpack',
        'less',
        'node-sass',
        'typescript',
        'webpack'
    ];

    const loaderDeps = Object.keys(pkgConfig.dependencies)
        .filter((key: string) => loaderPeerDeps.indexOf(key) > -1 || key.match(/\-loader$/));
    if (loaderDeps.indexOf('node-sass') === -1) {
        loaderDeps.push('node-sass');
    }
    if (loaderDeps.indexOf('@types/node') === -1) {
        loaderDeps.push('@types/node');
    }

    if (typeof commandOptions.packageManager === 'undefined') {
        const yarnLockFileExists = await fs.exists(path.resolve(cfg.cwd, 'yarn.lock'));
        commandOptions.packageManager = yarnLockFileExists ? 'yarn' : 'npm';
    }

    cfg.logger.logLine(`\nInstalling tooling dependencies via ${commandOptions.packageManager}...`);

    const errorFilter = /^warning\sfsevents/g;
    if (commandOptions.packageManager === 'yarn') {
        await spawnPromise('yarn',
            ['add', '--silent', '--no-progress', '--non-interactive', '-D'].concat(loaderDeps),
            false,
            true,
            errorFilter);

    } else {
        await spawnPromise('npm',
            ['install', '-D', '--color', 'always', '--loglevel', 'error'].concat(loaderDeps),
            false,
            true,
            errorFilter);
    }
}
