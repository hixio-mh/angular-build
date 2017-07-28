import * as Ajv from 'ajv';
import * as denodeify from 'denodeify';
const fs = require('fs-extra');
import * as glob from 'glob';
import * as inquirer from 'inquirer';
import * as path from 'path';
import * as semver from 'semver';

import { colorize, Logger, spawnPromise, readJson } from '../../utils';
import { AngularBuildConfig } from '../../models';

import { CliOptions } from '../cli-options';

import { InitInfo } from './init-info';

import { initAppProjects, mergeAppWithUserConfig } from './init-app';
import { initLibProjects, mergeLibWithUserConfig } from './init-lib';

const globPromise = denodeify(glob) as (pattern: string, options?: glob.IOptions) => Promise<string[]>;

const depSaveList = [
    '@angular/compiler',
    '@angular/core',
    'aspnet-prerendering',

    'bootstrap',

    'core-js',
    'es6-promise',
    'es6-shim',

    'event-source-polyfill',
    'ie-shim',
    'intl',
    'isomorphic-fetch',

    'jquery',
    'preboot',
    'reflect-metadata',
    'rxjs',
    'systemjs',

    'tslib',
    'ts-helpers',

    'web-animations-js',
    'zone.js'
];

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

    // check package.json
    if (!await fs.exists(path.resolve(projectRoot, 'package.json'))) {
        throw new Error(
            `We can't find 'package.json' file at current directory. If you are creating a new app, please use '${
            colorize('ngb new', 'cyan')}' instead.`);
    } else {
        cfg.userPackageConfig = await readJson(path.resolve(projectRoot, 'package.json'));
    }

    // quick check ASP.Net MVC
    if (await fs.exists(path.resolve(projectRoot, 'Views'))) {
        const foundPaths = await globPromise('**/*.cshtml',
            { cwd: path.resolve(projectRoot, 'Views') });
        cfg.isAspNetMvc = (foundPaths as string[]).length > 0;
    }

    // for dll bundling
    await checkAndUpdateDevDependencies(cfg);

    // init configs
    await initConfigs(cfg);

    // check deps  to install
    const angularDepsOnly = !cfg.commandOptions.link && !cfg.webpackConfigFileCreated && !cfg.cliIsLocal;
    const packagesToInstall = await checkAngularAndWebpackDependenciesToInstall(cfg, angularDepsOnly);

    // install webpack and loaders
    if (packagesToInstall) {
        cfg.logger.logLine('\n  To work angular-build correctly, we need to install/upgrade the following dependencies:');
        cfg.logger.logLine(`  ${colorize(`${Object.keys(packagesToInstall).map(key => key + '@' + packagesToInstall[key])
            .sort()
            .join('\n  ')}`,
            'cyan')}`);

        const answer = await inquirer.prompt([
            {
                type: 'confirm',
                name: 'confirm',
                message: colorize(`Do you want to continue?`, 'white'),
                default: true
            }
        ]);

        if (answer.confirm) {
            await setPackageManagerWithPrompt(cfg);
            await installToolingDependencies(cfg, packagesToInstall);
        }
    } else if (cfg.shouldInstallPolyfills) {
        await setPackageManagerWithPrompt(cfg);
        await installPolyfillsOnly(cfg);
    }

    if ((cfg.commandOptions.link || cfg.webpackConfigFileCreated) && !cfg.cliIsLocal) {
        await linkCli(cfg);
    }

    cfg.logger.logLine('\n  Init completed.');
    return 0;
}

async function setPackageManagerWithPrompt(cfg: InitInfo): Promise<void> {
    // detect package manager
    if (!cfg.commandOptions.packageManager || typeof cfg.commandOptions.packageManager === 'undefined') {
        // const yarnLockFileExists = await fs.exists(path.resolve(cfg.cwd, 'yarn.lock'));
        const yarnInstalled = await spawnPromise('yarn', ['--version'], false, true, /^warning\s/i)
            .then(() => true)
            .catch(() => false);
        cfg.commandOptions.packageManager = yarnInstalled ? 'yarn' : 'npm';
        if (yarnInstalled) {
            const answer = await inquirer.prompt([
                {
                    type: 'list',
                    name: 'choice',
                    message: colorize('Select package manager to install dependencies.', 'white'),
                    choices: [
                        'npm',
                        'yarn'
                    ],
                    default: cfg.commandOptions.packageManager || 'npm'
                }
            ]);
            cfg.commandOptions.packageManager = answer.choice;
        }
    }
}

async function initConfigs(cfg: InitInfo): Promise<void> {
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
                name: 'choice',
                message: colorize(
                    `We found 'angular-build.json' file at current directory${!isValid
                        ? ', but configuration appears to be invalid'
                        : ''}. Select action to continue:`,
                    'yellow'),
                choices: [
                    'merge',
                    'override'
                ],
                default: isValid ? 'merge' : 'override'
            }
        ]);

        if (answer.choice === 'merge' && cfg.userAngularBuildConfig) {
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
                name: 'choice',
                message: colorize('Select project type:', 'white'),
                choices: [
                    'app project',
                    'lib project'
                ],
                default: cfg.userPackageConfig &&
                    (cfg.isAspNetMvc || cfg.userPackageConfig.private || cfg.userPackageConfig.version === '0.0.0')
                    ? 'app project'
                    : 'lib project'
            }
        ]);
        cfg.commandOptions.projectType = answer.choice === 'lib project' ? 'lib' : 'app';
    }

    if (cfg.commandOptions.projectType === 'lib') {
        await initLibProjects(cfg);
    } else if (cfg.commandOptions.projectType === 'app') {
        await initAppProjects(cfg);
    }

    await fs.writeFile(path.join(projectRoot, 'angular-build.json'),
        JSON.stringify(cfg.angularBuildConfigToWrite, null, 2));
}

async function installPolyfillsOnly(cfg: InitInfo): Promise<void> {
    const polyfillsDeps = ['core-js', 'rxjs', 'zone.js'];
    let filteredDeps: string[];

    if (cfg.userPackageConfig.dependencies) {
        const userDeps = Object.keys(cfg.userPackageConfig.dependencies);
        filteredDeps = polyfillsDeps.filter(p => userDeps.indexOf(p) === -1);
    } else {
        filteredDeps = polyfillsDeps;
    }

    if (!filteredDeps.length) {
        return;
    }

    cfg.logger.logLine(`\n  Installing polyfills dependencies via ${cfg.commandOptions.packageManager}`);
    if (cfg.commandOptions.packageManager === 'yarn') {
        await spawnPromise('yarn',
            ['add', '--silent', '--no-progress', '--non-interactive'].concat(filteredDeps),
            false,
            true,
            /^warning\s/i);

    } else {
        await spawnPromise('npm',
            ['install', '-S', '--color', 'always', '--loglevel', 'error'].concat(filteredDeps),
            false,
            true,
            /^warning\s/i);
    }
}


async function checkAngularAndWebpackDependenciesToInstall(cfg: InitInfo, angularDepsOnly?: boolean):
    Promise<{ [key: string]: string } | null> {
    const projectRoot = cfg.cwd;

    const peerDepNames = [
        '@angular-devkit/build-optimizer',
        '@angular/compiler-cli',
        '@angular/compiler',
        '@angular/core',
        '@ngtools/webpack',
        'core-js',
        'rxjs',
        'zone.js',
        'less',
        'node-sass',
        'typescript',
        'tslib',
        // 'ts-node',
        'webpack',
        // 'webpack-dev-server',
        // 'webpack-hot-middleware',
        '@types/node'
    ];

    let masterPackageConfigPath = './package.json';
    if (!await fs.exists(path.resolve(__dirname, masterPackageConfigPath))) {
        masterPackageConfigPath = '../package.json';
    }
    if (!await fs.exists(path.resolve(__dirname, masterPackageConfigPath))) {
        masterPackageConfigPath = '../../package.json';
    }
    if (!await fs.exists(path.resolve(__dirname, masterPackageConfigPath))) {
        masterPackageConfigPath = '../../../package.json';
    }

    const packagesToCheck: { [key: string]: string } = {
        '@types/node': '',
        'tslib': ''
        // 'webpack-dev-server': '',
        // 'webpack-hot-middleware': ''
    };

    const masterPkgConfig = await fs.readJson(path.resolve(__dirname, masterPackageConfigPath));
    let angularVersion = '';
    if (angularDepsOnly) {
        Object.keys(masterPkgConfig.dependencies)
            .filter((key: string) => /^@angular\//.test(key)).forEach((key: string) => {
                packagesToCheck[key] = masterPkgConfig.dependencies[key];
                if (!angularVersion) {
                    angularVersion = packagesToCheck[key];
                }
            });
    } else {
        Object.keys(masterPkgConfig.dependencies)
            .filter((key: string) => peerDepNames.indexOf(key) > -1 || key.match(/\-loader$/)).forEach(
                (key: string) => {
                    packagesToCheck[key] = masterPkgConfig.dependencies[key];
                    if (!angularVersion && /^@angular\//.test(key)) {
                        angularVersion = packagesToCheck[key];
                    }
                });

        Object.keys(masterPkgConfig.optionalDependencies)
            .forEach((key: string) => {
                packagesToCheck[key] = masterPkgConfig.optionalDependencies[key];
            });
    }

    if (cfg.userPackageConfig.dependencies) {
        Object.keys(cfg.userPackageConfig.dependencies).forEach((key: string) => {
            if (/^@angular\//.test(key)) {
                packagesToCheck[key] = angularVersion;
            }
        });
    }

    return await checkPackagesToInstall(packagesToCheck, projectRoot);
}

async function installToolingDependencies(cfg: InitInfo, packagesToInstall: { [key: string]: string }): Promise<void> {
    const toSaveDeps = Object.keys(packagesToInstall).filter(key => depSaveList.indexOf(key) > -1)
        .map(key => `${key}@${packagesToInstall[key]}`);
    const toSaveDevDeps = Object.keys(packagesToInstall).filter(key => depSaveList.indexOf(key) === -1)
        .map(key => `${key}@${packagesToInstall[key]}`);

    cfg.logger.logLine(`  Installing tool dependencies via ${cfg.commandOptions.packageManager}`);

    if (cfg.commandOptions.packageManager === 'yarn') {
        if (toSaveDeps.length) {
            await spawnPromise('yarn',
                ['add', '--silent', '--no-progress', '--non-interactive'].concat(toSaveDeps),
                false,
                true,
                /^warning\s/i);
        }

        if (toSaveDevDeps.length) {
            await spawnPromise('yarn',
                ['add', '--silent', '--no-progress', '--non-interactive', '-D'].concat(toSaveDevDeps),
                false,
                true,
                /^warning\s/i);
        }
    } else {
        if (toSaveDeps.length) {
            await spawnPromise('npm',
                ['install', '-S', '--color', 'always', '--loglevel', 'error'].concat(toSaveDeps),
                false,
                true,
                /^warning\s/i);
        }

        if (toSaveDevDeps.length) {
            await spawnPromise('npm',
                ['install', '-D', '--color', 'always', '--loglevel', 'error'].concat(toSaveDevDeps),
                false,
                true,
                /^warning\s/i);
        }
    }
}

async function checkAndUpdateDevDependencies(cfg: InitInfo): Promise<void> {
    const projectRoot = cfg.cwd;

    const otherKnownDevDeps = [
        '@angular/tsc-wrapped',
        'aspnet-webpack',
        'css',
        'chai',
        'codelyzer',
        'jasmine-core',
        'karma',
        'node-sass',
        'tslint',
        'ts-node',
        'url',
        'webpack-merge'
    ];

    let masterPackageConfigPath = './package.json';
    if (!await fs.exists(path.resolve(__dirname, masterPackageConfigPath))) {
        masterPackageConfigPath = '../package.json';
    }
    if (!await fs.exists(path.resolve(__dirname, masterPackageConfigPath))) {
        masterPackageConfigPath = '../../package.json';
    }
    if (!await fs.exists(path.resolve(__dirname, masterPackageConfigPath))) {
        masterPackageConfigPath = '../../../package.json';
    }

    const masterPkgConfig = await fs.readJson(path.resolve(__dirname, masterPackageConfigPath));
    const masterPkgDepNames = Object.keys(masterPkgConfig.dependencies);
    const masterPkgDevDepNames = Object.keys(masterPkgConfig.devDependencies);

    // move to dev dependencies
    const userPackageConfig = cfg.userPackageConfig;
    let shouldUpdateUserPackageConfig = false;
    if (userPackageConfig.dependencies) {
        Object.keys(userPackageConfig.dependencies).forEach((key: string) => {
            if ((/\-loader$/.test(key) ||
                /\-plugin$/.test(key) ||
                /karma\-/.test(key) ||
                /webpack\-/.test(key) ||
                /@types\//.test(key) ||
                masterPkgDepNames.indexOf(key) !== -1 ||
                masterPkgDevDepNames.indexOf(key) !== -1 ||
                otherKnownDevDeps.indexOf(key) !== -1) &&
                depSaveList.indexOf(key) === -1) {
                userPackageConfig.devDependencies = userPackageConfig.devDependencies || {};
                userPackageConfig.devDependencies[key] = userPackageConfig.dependencies[key];
                delete userPackageConfig.dependencies[key];
                shouldUpdateUserPackageConfig = true;
            }
        });
    }
    if (shouldUpdateUserPackageConfig) {
        await fs.writeFile(path.resolve(projectRoot, 'package.json'), JSON.stringify(userPackageConfig, null, 2));
    }
}

async function linkCli(cfg: InitInfo): Promise<void> {
    cfg.logger.logLine(`\n  Linking @bizappframework/angular-build`);
    await spawnPromise('npm',
        ['link', '@bizappframework/angular-build'],
        false,
        true, /^warning\s/i);
}

async function checkPackagesToInstall(packagesToCheck: { [key: string]: string }, projectRoot: string):
    Promise<{ [key: string]: string } | null> {
    let packagesToInstall: { [key: string]: string } | null = null;

    for (let key in packagesToCheck) {
        if (packagesToCheck.hasOwnProperty(key)) {
            const pkgPath = path.resolve(projectRoot, 'node_modules', key, 'package.json');
            if (await fs.exists(pkgPath)) {
                if (!packagesToCheck[key]) {
                    continue;
                }
                const versionRange = semver.validRange(packagesToCheck[key]);
                const installedPkgJson = await fs.readJson(pkgPath);
                const installedVer = installedPkgJson.version;
                if (installedVer && semver.satisfies(installedVer, versionRange)) {
                    continue;
                }
            }

            packagesToInstall = packagesToInstall || {};
            packagesToInstall[key] = packagesToCheck[key];
        }
    }

    return packagesToInstall;
}
