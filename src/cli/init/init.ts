import * as fs from 'fs-extra';
import * as path from 'path';

import { CliOptions } from '../cli-options';

import { AngularBuildConfig } from '../../models';
import { colorize, Logger, spawnPromise } from '../../utils';

const pkgConfig = require('../../../package.json');


export interface CommandOptions {
    /**
     * Package manager to use while installing dependencies.
     */
    packageManager?: 'npm' | 'yarn';
    /**
     * Link angular-build cli to current project.
     * @default false
     */
    link?: boolean;
    /**
     * Install webpack loaders and dependencies.
     */
    installDeps?: boolean;
    projectType?: 'app' | 'lib' | 'both';
}


export interface InitConfig {
    logger: Logger;
    cwd: string;
    cliIsLocal: boolean;
    commandOptions: CommandOptions;

    shouldWriteAngularBuildConfig?: boolean;
    angularBuildConfigToWrite?: AngularBuildConfig;
    shouldWriteFaviconConfig?: boolean;
    faviconConfigSrcDir?: string;
    faviconConfigToWrite?: any;
}

export async function init(cliOptions: CliOptions, logger: Logger = new Logger()): Promise<number> {
    const projectRoot = cliOptions.cwd || process.cwd();
    logger.logLine(`\n${colorize(`angular-build ${cliOptions.cliVersion}`, 'green')}`);

    const cfg: InitConfig = {
        logger: logger,
        cwd: projectRoot,
        cliIsLocal: cliOptions.cliIsLocal as boolean,
        commandOptions: Object.assign({}, cliOptions.commandOptions || {})
    };

    if (typeof cfg.commandOptions.packageManager === 'undefined') {
        const yarnLockFileExists = await fs.exists(path.resolve(cfg.cwd, 'yarn.lock'));
        cfg.commandOptions.packageManager = yarnLockFileExists ? 'yarn' : 'npm';
    }

    await createOrUpdteAngularBuildConfig(cfg);

    if (cfg.commandOptions.installDeps || cfg.commandOptions.link) {
        await installWebpackLoaders(cfg);
    }

    if (cfg.commandOptions.link) {
        await linkCli(cfg);
    }

    cfg.logger.logLine('Done.');
    return 0;
}

async function createOrUpdteAngularBuildConfig(cfg: InitConfig): Promise<void> {
    const projectRoot = cfg.cwd;
    const logger = cfg.logger;

    if (cfg.shouldWriteFaviconConfig && cfg.faviconConfigSrcDir) {
        logger.logLine(`Saving 'favicon-config.json' file`);
        await fs.writeFile(path.join(cfg.faviconConfigSrcDir, 'favicon-config.json'), cfg.faviconConfigToWrite);
    }
    if (cfg.shouldWriteAngularBuildConfig) {
        logger.logLine(`Saving 'angular-build.json' file`);
        await fs.writeFile(path.join(projectRoot, 'angular-build.json'), cfg.angularBuildConfigToWrite);
    }
}

async function installWebpackLoaders(cfg: InitConfig): Promise<void> {
    const loaderDeps = [
        '@angular/compiler-cli',
        '@angular/compiler',
        '@angular/core',
        '@ngtools/webpack',
        'rxjs',
        'zone.js',
        'less',
        'node-sass',
        'typescript',
        'tslib',
        'webpack',
        'webpack-dev-server',
        'webpack-hot-middleware',
        '@types/node'
    ];

    Object.keys(pkgConfig.dependencies)
        .filter((key: string) => loaderDeps.indexOf(key) > -1 && key.match(/\-loader$/)).forEach((dep: string) => {
            loaderDeps.push(dep);
        });

    cfg.logger.logLine(`Installing tooling dependencies via ${cfg.commandOptions.packageManager}`);

    const errorFilter = /^warning\sfsevents/g;
    if (cfg.commandOptions.packageManager === 'yarn') {
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

async function linkCli(cfg: InitConfig): Promise<void> {
    cfg.logger.logLine(`Linking @bizappframework/angular-build`);
    if (cfg.commandOptions.packageManager === 'yarn') {
        await spawnPromise('yarn',
            ['link', '@bizappframework/angular-build'],
            false,
            true);

    } else {
        await spawnPromise('npm',
            ['link', '@bizappframework/angular-build'],
            false,
            true);
    }
}
