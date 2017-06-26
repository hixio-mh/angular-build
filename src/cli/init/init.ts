import * as Ajv from 'ajv';
import * as fs from 'fs-extra';
import * as inquirer from 'inquirer';
import * as path from 'path';

import { colorize, Logger, spawnPromise, readJson } from '../../utils';
import { AngularBuildConfig } from '../../models';

import { CliOptions } from '../cli-options';

import { InitInfo } from './init-info';

import { initAppProjects, mergeAppWithUserConfig } from './init-app';
import { initLibProjects, mergeLibWithUserConfig } from './init-lib';

export async function init(cliOptions: CliOptions, logger: Logger = new Logger()): Promise<number> {
    return await initInternal(cliOptions, logger).then(() => 0).catch((err: Error) => {
        if (err) {
            let errMsg: string;
            if (err.stack && err.message) {
                const newErrStack = err.stack.replace(`Error: ${err.message}`, '');
                errMsg = newErrStack === err.stack ? err.stack : err.message + '\n\n' + newErrStack;
            } else {
                errMsg = err.stack ||
                    err.message ||
                    (typeof (err as any) === 'string' ? err as any : JSON.stringify(err));
            }

            errMsg = colorize('Error', 'red') + ': ' + errMsg.replace(/^Error:\s*/i, '');
            logger.errorLine(`${errMsg.trim()}\n`, false);
        } else {
            throw err;
        }
        return -1;
    });
}

async function initInternal(cliOptions: CliOptions, logger: Logger = new Logger()): Promise<number> {
    const projectRoot = cliOptions.cwd || process.cwd();
    logger.logLine(`\n${colorize(`angular-build ${cliOptions.cliVersion}`, 'green')}`);

    const cfg: InitInfo = {
        logger: logger,
        cwd: projectRoot,
        cliIsLocal: cliOptions.cliIsLocal as boolean,
        commandOptions: Object.assign({}, cliOptions.commandOptions || {})
    };

    // detect package manager
    if (!cfg.commandOptions.packageManager || typeof cfg.commandOptions.packageManager === 'undefined') {
        // const yarnLockFileExists = await fs.exists(path.resolve(cfg.cwd, 'yarn.lock'));
        const yarnInstalled = await spawnPromise('yarn', ['--version'])
            .then(() => true)
            .catch(() => false);
        cfg.commandOptions.packageManager = yarnInstalled ? 'yarn' : 'npm';
    }

    // check package.json
    if (!await fs.exists(path.resolve(projectRoot, 'package.json'))) {
        throw new Error(
            `We can't find 'package.json' file at current directory. If you are creating a new app, ${`please use '${
            colorize('ngb new', 'cyan')}' instead, or you can create 'package.json' file with '${colorize(
                cfg.commandOptions.packageManager + ' init',
                'cyan')}'.`}`);
    } else {
        cfg.userPackageConfig = await readJson(path.resolve(projectRoot, 'package.json'));
    }

    // init configs
    if (!await initConfigs(cfg)) {
        return 0;
    }

    if (cfg.commandOptions.installDeps || cfg.commandOptions.link) {
        await installWebpackLoaders(cfg);
    }

    if (cfg.commandOptions.link && !cfg.cliIsLocal) {
        await linkCli(cfg);
    }

    cfg.logger.logLine('Done.');
    return 0;
}

async function initConfigs(cfg: InitInfo): Promise<boolean> {
    const projectRoot = cfg.cwd;
    if (!cfg.angularBuildSchema) {
        let schemaPath = './schemas/schema.json';
        if (!await fs.exists(path.resolve(__dirname, schemaPath))) {
            schemaPath = '../schemas/schema.json';
        }
        if (!await fs.exists(path.resolve(__dirname, schemaPath))) {
            schemaPath = '../../schemas/schema.json';
        }
        if (!await fs.exists(path.resolve(__dirname, schemaPath))) {
            schemaPath = '../../../schemas/schema.json';
        }
        const schema = await fs.readJson(path.resolve(__dirname, schemaPath));
        if (schema.$schema) {
            delete schema.$schema;
        }
        cfg.angularBuildSchema = schema;
    }

    cfg.angularBuildConfigToWrite = cfg.angularBuildConfigToWrite ||
        {
            $schema: 'node_modules/@bizappframework/angular-build/schemas/schema-draft-04.json#'
        } as AngularBuildConfig;

    if (await fs.exists(path.resolve(projectRoot, 'angular-build.json'))) {
        cfg.userAngularBuildConfig = await readJson(path.resolve(projectRoot, 'angular-build.json'))
            .then((config: AngularBuildConfig) => config)
            .catch(() => undefined);
        let isValid = false;
        if (cfg.userAngularBuildConfig) {
            const clonedUserAngularBuildConfig = JSON.parse(JSON.stringify(cfg.userAngularBuildConfig));
            if ((clonedUserAngularBuildConfig as any).$schema) {
                delete (clonedUserAngularBuildConfig as any).$schema;
            }

            const ajv = new Ajv();
            const validate = ajv.compile(cfg.angularBuildSchema);
            isValid = validate(clonedUserAngularBuildConfig) as boolean;
        }

        const answer = await inquirer.prompt([
            {
                type: 'list',
                name: 'action',
                message: colorize(
                    `We found 'angular-build.json' in current working directory${!isValid
                        ? ', but configuration appears to be invalid'
                        : ''}. Select action to continue:`,
                    'white'),
                choices: [
                    'merge with prompt',
                    'override with prompt',
                    'exit'
                ],
                default: isValid ? 'merge with prompt' : 'override with prompt'
            }
        ]);
        if (answer.action === 'exit') {
            return false;
        }

        if (answer.action === 'merge with prompt' && cfg.userAngularBuildConfig) {
            if (isValid) {
                cfg.angularBuildConfigToWrite =
                    Object.assign(cfg.angularBuildConfigToWrite, cfg.userAngularBuildConfig);
            } else {
                if (cfg.commandOptions.projectType === 'lib') {
                    mergeLibWithUserConfig(cfg, cfg.userAngularBuildConfig);
                } else {
                    mergeAppWithUserConfig(cfg, cfg.userAngularBuildConfig);
                }
            }

            if (cfg.userAngularBuildConfig.apps &&
                cfg.userAngularBuildConfig.apps.length > 0 &&
                cfg.userAngularBuildConfig.apps[0].entry) {
                cfg.commandOptions.projectType = 'app';
            } else if (cfg.userAngularBuildConfig.libs &&
                cfg.userAngularBuildConfig.libs.length > 0 &&
                (cfg.userAngularBuildConfig.libs[0].srcDir || cfg.userAngularBuildConfig.libs[0].outDir) &&
                (cfg.userAngularBuildConfig.libs[0].tsTranspilations ||
                    cfg.userAngularBuildConfig.libs[0].bundleTargets)) {
                cfg.commandOptions.projectType = 'lib';
            }
        }
    }

    if (!cfg.commandOptions.projectType) {
        const answer = await inquirer.prompt([
            {
                type: 'list',
                name: 'projectType',
                message: colorize('Select project type:', 'white'),
                choices: [
                    'app project',
                    'lib project'
                ],
                default: cfg.userPackageConfig &&
                    (cfg.userPackageConfig.private || cfg.userPackageConfig.version === '0.0.0')
                    ? 'app project'
                    : 'lib project'
            }
        ]);
        cfg.commandOptions.projectType = answer.projectType === 'lib project' ? 'lib' : 'app';
    }

    if (cfg.commandOptions.projectType === 'lib') {
        await initLibProjects(cfg);
    } else if (cfg.commandOptions.projectType === 'app') {
        await initAppProjects(cfg);
    }

    await fs.writeFile(path.join(projectRoot, 'angular-build.json'),
        JSON.stringify(cfg.angularBuildConfigToWrite, null, 2));
    return true;
}

async function installWebpackLoaders(cfg: InitInfo): Promise<void> {
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

    let packageConfigPath = './package.json';
    if (!await fs.exists(path.resolve(__dirname, packageConfigPath))) {
        packageConfigPath = '../package.json';
    }
    if (!await fs.exists(path.resolve(__dirname, packageConfigPath))) {
        packageConfigPath = '../../package.json';
    }
    if (!await fs.exists(path.resolve(__dirname, packageConfigPath))) {
        packageConfigPath = '../../../package.json';
    }
    const pkgConfig = await fs.readJson(path.resolve(__dirname, packageConfigPath));

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

async function linkCli(cfg: InitInfo): Promise<void> {
    cfg.logger.logLine(`Linking @bizappframework/angular-build`);
    await spawnPromise('npm',
        ['link', '@bizappframework/angular-build'],
        false,
        true);
}
