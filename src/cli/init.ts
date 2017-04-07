import * as path from 'path';
import * as fs from 'fs-extra';
import * as resolve from 'resolve';
import * as semver from 'semver';
import * as ajv from 'ajv';
import * as chalk from 'chalk';
import * as yargs from 'yargs';

import { CliOptions } from './models';
import { AngularBuildConfig, AppConfig } from '../models';
import { IconPluginOptions } from '../plugins/icon-webpack-plugin';

import {
    readJsonAsync, chageDashCase, mapToYargsType, checkFileOrDirectoryExistsAsync, findFileOrDirectoryFromPossibleAsync,
    getVersionfromPackageJsonAsync, askAsync, spawnAsync
} from '../utils';

// ReSharper disable CommonJsExternalModule
const schema = require('../../configs/schema.json');
const faviconSchema = require('../../configs/favicon-config-schema.json');
// ReSharper restore CommonJsExternalModule

export interface PackageToCheck {
    packageName: string;
    isPreReleased?: boolean;
    version?: string;
    resolvedPath?: string;
};

export interface PackageJsonConfig {
    dependencies?: { [key: string]: string },
    devDependencies?: { [key: string]: string }
}

export interface CommandOptions {
    /**
     * Confirm user by prompting
     * @default false
     */
    prompt?: boolean;
    /**
     * Force creating package.json file and not prompt you for any options
     * @default false
     */
    force?: boolean;
    /**
     * Link angular-build cli to current project
     * @default false
     */
    link?: boolean;
    /**
     * Skip install tooling
     * @default false
     */
    skipInstallTooling?: boolean;
    /**
     * Install loaders only
     * @default true
     */
    installLoadersOnly?: boolean;
    /**
     * Override angular-build.json file
     */
    overrideAngularBuildConfigFile?: boolean;
    /**
     * Webpack config file name
     */
    webpackConfigFileName?: string;
    /**
     * Override webpack config file
     * @default true
     */
    overrideWebpackConfigFile?: boolean;
}

export interface InitConfig {
    cwd: string;
    cliIsLocal?: boolean;

    commandOptions?: CommandOptions & AppConfig;
    cliPackageJsonConfig?: PackageJsonConfig;

    angularBuildConfigMaster?: AngularBuildConfig;
    userAngularBuildConfig?: any;
    angularBuildConfigFileExists?: boolean;

    userAngularCliConfig?: any;
    angularCliConfigFileExists?: boolean;

    faviconConfigMaster?: IconPluginOptions;

    webpackConfigFileExists?: boolean;

    userPackageConfigFileExists?: boolean;
    userPackageConfigFile?: string;
    userPackageConfig?: any;

    tsConfigMaster?: any;
    tsConfigAppMaster?: any;
    tsConfigAppAoTMaster?: any;
    tsConfigTestMaster?: any;

    faviconConfigFileExists?: boolean;
    userFaviconConfig?: any;

    isAspNetCore?: boolean;
}

export function getInitCommandModule(cliVersion: string): yargs.CommandModule {
    const initCommandUsage = `\n${chalk.green(`angular-build ${cliVersion}`)}\n
Usage:
  ngb init [options...]`;


    const initCommandModule: yargs.CommandModule = {
        command: 'init',
        describe: 'Create angular-build config files',
        builder: (yargv: yargs.Argv) => {
            let yargvObj = yargv
                .reset()
                .usage(initCommandUsage)
                .example('ngb init --prompt', 'Create angular-build config files with user prompt option')
                .help('h')
                .option('p',
                {
                    alias: 'prompt',
                    describe: 'Confirm user by prompting',
                    type: 'boolean',
                    default: false
                })
                .option('f',
                {
                    alias: 'force',
                    describe: 'Force creating package.json file and not prompt you for any options',
                    type: 'boolean',
                    default: false
                })
                .option('l',
                {
                    alias: 'link',
                    describe: 'Link angular-build cli to current project',
                    type: 'boolean',
                    default: false
                })
                .option('skip-install-tooling',
                {
                    describe: 'Skip install tooling',
                    type: 'boolean',
                    default: false
                })
                .option('install-loaders-only',
                {
                    describe: 'Install loaders only',
                    type: 'boolean',
                    default: true
                })
                .option('override-angular-build-config-file',
                {
                    describe: 'Override angular-build.json file',
                    type: 'boolean',
                    default: undefined
                })
                .option('webpack-config-file-name',
                {
                    describe: 'Webpack config file name',
                    type: 'string'
                })
                .option('override-webpack-config-file',
                {
                    describe: 'Override webpack config file',
                    type: 'boolean',
                    default: true
                });

            const appConfigSchema: any = schema.definitions.AppConfig.properties;
            Object.keys(appConfigSchema).filter((key: string) => key !== 'extends').forEach((key: string) => {
                yargvObj = yargvObj.options(chageDashCase(key),
                    {
                        describe: appConfigSchema[key].description || key,
                        type: mapToYargsType(appConfigSchema[key].type),
                        default: undefined
                    });
            });

            return yargvObj;
        },
        handler: null
    };

    return initCommandModule;
}

// Command
//
export function init(cliOptions: CliOptions): Promise<number> {
    const projectRoot = cliOptions.cwd || process.cwd();

    const cfg: InitConfig = {
        cwd: projectRoot,
        cliIsLocal: cliOptions.cliIsLocal,
        commandOptions: Object.assign({}, cliOptions.commandOptions || {})
    };

    return checkFileOrDirectoryExistsAsync(path.resolve(projectRoot, 'package.json'))
        .then((exists: boolean) => {
            if (exists) {
                cfg.userPackageConfigFileExists = true;
                cfg.userPackageConfigFile = path.resolve(projectRoot, 'package.json');
                return Promise.resolve();
            } else {
                if (cfg.commandOptions.force) {
                    return spawnAsync('npm', ['init', '-f', '--color', 'always', '--loglevel', 'error'])
                        .then(() => {
                            cfg.userPackageConfigFileExists = true;
                            cfg.userPackageConfigFile = path.resolve(projectRoot, 'package.json');
                        });
                } else {
                    const msg = `'package.json' file doesn't exist.\nPlease run ${chalk
                        .cyan('npm init')
                        } command to init 'package.json' file or run ${chalk
                            .cyan('ngb init -f')} to force create 'package.json' file.`;
                    return Promise.reject(msg);
                }
            }
        })
        // Read master files
        .then(() => {
            return readJsonAsync(require.resolve('../../package.json')).then(cliPkgConfig => {
                cfg.cliPackageJsonConfig = cliPkgConfig;
            });
        })
        .then(() => {
            return readJsonAsync(require.resolve('../../configs/angular-build.json'))
                .then((angularBuildConfig: AngularBuildConfig) => {
                    cfg.angularBuildConfigMaster = angularBuildConfig;
                });
        })
        .then(() => {
            return readJsonAsync(require.resolve('../../configs/tsconfig.json'))
                .then((tsConfig: any) => {
                    cfg.tsConfigMaster = tsConfig;
                });
        })
        .then(() => {
            return readJsonAsync(require.resolve('../../configs/tsconfig.app.json'))
                .then((tsConfig: any) => {
                    cfg.tsConfigAppMaster = tsConfig;
                });
        })
        .then(() => {
            return readJsonAsync(require.resolve('../../configs/tsconfig.app.aot.json'))
                .then((tsConfig: any) => {
                    cfg.tsConfigAppAoTMaster = tsConfig;
                });
        })
        .then(() => {
            return readJsonAsync(require.resolve('../../configs/tsconfig.test.json'))
                .then((tsConfig: any) => {
                    cfg.tsConfigTestMaster = tsConfig;
                });
        })
        .then(() => {
            return readJsonAsync(require.resolve('../../configs/favicon-config.json'))
                .then((faviconConfig: IconPluginOptions) => {
                    cfg.faviconConfigMaster = faviconConfig;
                });
        })
        // Read user angular-build.json
        .then(() => {
            const cliPath = path.resolve(projectRoot, 'angular-build.json');
            return checkFileOrDirectoryExistsAsync(cliPath).then((exists: boolean) => {
                cfg.angularBuildConfigFileExists = exists;
                if (exists) {
                    return readJsonAsync(cliPath).then((buildConfig: any) => {
                        buildConfig = buildConfig || {};
                        buildConfig.apps = buildConfig.apps || [];
                        cfg.userAngularBuildConfig = buildConfig;
                    });
                } else {
                    return Promise.resolve();
                }
            });
        })
        // Read user angular-cli.json
        .then(() => {
            const cliPath = path.resolve(projectRoot, 'angular-cli.json');
            return checkFileOrDirectoryExistsAsync(cliPath).then((exists: boolean) => {
                cfg.angularCliConfigFileExists = exists;
                if (exists) {
                    return readJsonAsync(cliPath).then((cliConfig: any) => {
                        cliConfig = cliConfig || {};
                        cliConfig.apps = cliConfig.apps || [];
                        cfg.userAngularCliConfig = cliConfig;
                    });
                } else {
                    return Promise.resolve();
                }
            });
        })
        // Read user webpack config file
        .then(() => {
            const possibleWebpackFiles = [
                'webpackfile.ts', 'webpackfile.babel.js', 'webpackfile.js', 'webpack.config.ts',
                'webpack.config.babel.js',
                'webpack.config.js'
            ];
            if (cfg.commandOptions.webpackConfigFileName && possibleWebpackFiles.indexOf(cfg.commandOptions.webpackConfigFileName) === -1) {
                possibleWebpackFiles.unshift(cfg.commandOptions.webpackConfigFileName);
            }

            return findFileOrDirectoryFromPossibleAsync(projectRoot,
                possibleWebpackFiles,
                cfg.commandOptions.webpackConfigFileName || 'webpack.config.js').then((foundName: string) => {
                if (foundName &&
                (!cfg.commandOptions
                    .webpackConfigFileName ||
                    foundName === cfg.commandOptions.webpackConfigFileName)) {
                    cfg.webpackConfigFileExists = true;
                    cfg.commandOptions.webpackConfigFileName = foundName;
                }
                return;
            });
        })
        // merge
        .then(() => mergeConfigAsync(cfg))
        // install toolings
        .then(() => {
            if (cfg.commandOptions.skipInstallTooling) {
                return Promise.resolve();
            }
            return checkAndInstallToolings(cfg);
        })
        // save angular-build.json file
        .then(() => {
            if (cfg.angularBuildConfigFileExists && cfg.commandOptions.overrideAngularBuildConfigFile === false) {
                return Promise.resolve();
            } else {
                if (cfg.angularBuildConfigFileExists && !cfg.commandOptions.overrideAngularBuildConfigFile) {

                    const userAngularBuildConfigClone = Object.assign({}, cfg.userAngularBuildConfig);
                    if ((userAngularBuildConfigClone as any)['$schema']) {
                        delete (userAngularBuildConfigClone as any)['$schema'];
                    }

                    const validate = ajv().compile(schema);
                    const valid = validate(userAngularBuildConfigClone);

                    if (valid) {
                        return Promise.resolve();
                    }
                }

                return new Promise((resolve, reject) => {
                    fs.writeFile(path.resolve(projectRoot, 'angular-build.json'),
                        JSON.stringify(cfg.angularBuildConfigMaster, null, 2),
                        err => err ? reject(err) : resolve());
                })
                    .then(() => {
                        console.log(chalk.green(`${cfg.angularBuildConfigFileExists ? 'Updated' : 'Created'}:`) +
                            ' angular-build.json');
                        return;
                    });
            }
        })
        // copy webpack.config file
        .then(() => {
            if (cfg.webpackConfigFileExists && cfg.commandOptions.overrideWebpackConfigFile === false) {
                return Promise.resolve();
            } else {
                const webpackConfigFileName = cfg.commandOptions.webpackConfigFileName || 'webpack.config.js';
                return new Promise((resolve, reject) => {
                        if (cfg.webpackConfigFileExists) {
                            fs.readFile(path.resolve(projectRoot, webpackConfigFileName),
                                'utf8',
                                (err, data) => {
                                    err ? reject(err) : resolve(data);
                                });
                        } else {
                            return resolve(null);
                        }
                    })
                    .then((data: string) => {
                        if (data) {
                            if (!data
                                .match(/const\s+getWebpackConfigs\s*=\s*require\s*\(\'@bizappframework\/angular-build\'\)\.getWebpackConfigs;\s*/g) &&
                                !data
                                .match(/import\s*\{\s*getWebpackConfigs\s*\}\s*from\s+\'@bizappframework\/angular-build\'\s*;\s*/g)) {
                                return true;
                            } else {
                                return false;
                            }
                        }
                        return true;
                    })
                    .then((shouldCopy: boolean) => {
                        if (shouldCopy) {
                            return new Promise((resolve, reject) => {
                                    if (webpackConfigFileName.match(/\.ts$/i)) {
                                        fs.copy(require.resolve('../../configs/webpack.config.ts'),
                                            path.resolve(projectRoot, webpackConfigFileName),
                                            err => {
                                                err ? reject(err) : resolve();
                                            });
                                    } else {
                                        fs.copy(require.resolve('../../configs/webpack.config.js'),
                                            path.resolve(projectRoot, webpackConfigFileName),
                                            err => {
                                                err ? reject(err) : resolve();
                                            });
                                    }
                                })
                                .then(() => {
                                    console.log(chalk.green(`${cfg.webpackConfigFileExists ? 'Updated' : 'Created'}:`) +
                                        ' ' +
                                        webpackConfigFileName);
                                    return;
                                });
                        } else {
                            return Promise.resolve();
                        }
                    });
            }
        })
        // copy empty.js
        .then(() => {
            const emptyPath = path.resolve(projectRoot, 'empty.js');
            return checkFileOrDirectoryExistsAsync(emptyPath).then(exists => {
                if (exists) {
                    return Promise.resolve();
                } else {
                    return new Promise((resolve, reject) => {
                            fs.copy(require.resolve('../../configs/empty.js'),
                                emptyPath,
                                err => {
                                    err ? reject(err) : resolve();
                                });
                        })
                        .then(() => {
                            console.log(chalk.green('Created:') + ' empty.js');
                            return;
                        });
                }
            });
        })
        // copy karma.conf.js
        .then(() => {
            const karmaPath = path.resolve(projectRoot, 'karma.conf.js');
            return checkFileOrDirectoryExistsAsync(karmaPath).then(exists => {
                if (exists) {
                    return Promise.resolve();
                } else {
                    return new Promise((resolve, reject) => {
                            fs.copy(require.resolve('../../configs/karma.conf.js'),
                                karmaPath,
                                err => {
                                    err ? reject(err) : resolve();
                                });
                        })
                        .then(() => {
                            console.log(chalk.green('Created:') + ' karma.conf.js');
                            return;
                        });
                }
            });
        })
        // copy protractor.conf.js
        .then(() => {
            const protractorPath = path.resolve(projectRoot, 'protractor.conf.js');
            return checkFileOrDirectoryExistsAsync(protractorPath).then(exists => {
                if (exists) {
                    return Promise.resolve();
                } else {
                    return new Promise((resolve, reject) => {
                            fs.readFile(require.resolve('../../configs/protractor.conf.js'),
                                'utf8',
                                (err, data) => {
                                    err ? reject(err) : resolve(data);
                                });
                        })
                        .then((data: string) => {
                            const appConfig = cfg.angularBuildConfigMaster.apps[0];
                            const appRoot = appConfig.root || 'src';
                            const content = data.replace(`const appRoot = 'src';`, `const appRoot = '${appRoot}';`);
                            return new Promise((resolve, reject) => {
                                fs.writeFile(path.resolve(projectRoot, 'protractor.conf.js'),
                                    content,
                                    (err) => {
                                        err ? reject(err) : resolve();
                                    });
                            });
                        })
                        .then(() => {
                            console.log(chalk.green('Created:') + ' protractor.conf.js');
                            return;
                        });
                }
            });
        })
        // save tsconfig.app.json file
        .then(() => {
            //const appConfig = cfg.angularBuildConfigMaster.apps[0];
            const tsConfigPath = path.resolve(projectRoot, 'tsconfig.app.json');
            return checkFileOrDirectoryExistsAsync(tsConfigPath).then(exists => {
                if (exists) {
                    return Promise.resolve();
                } else {
                    //const excludeList: string[] = cfg.tsConfigAppMaster.exclude || [];
                    //if (excludeList.indexOf(appConfig.outDir) === -1) {
                    //    excludeList.push(appConfig.outDir);
                    //}
                    //if (excludeList.indexOf(`${appConfig.root}/**/*.spec.ts`) === -1) {
                    //    excludeList.push(`${appConfig.root}/**/*.spec.ts`);
                    //}
                    //if (excludeList.indexOf(`${appConfig.root}/**/*.e2e.ts`) === -1) {
                    //    excludeList.push(`${appConfig.root}/**/*.e2e.ts`);
                    //}
                    //if (excludeList.indexOf(`${appConfig.root}/main*aot.ts`) === -1) {
                    //    excludeList.push(`${appConfig.root}/main*aot.ts`);
                    //}

                    const tsConfig: any = cfg.tsConfigAppMaster;
                    //tsConfig.exclude = excludeList;
                    // Create
                    return new Promise((resolve, reject) => {
                            fs.writeFile(tsConfigPath,
                                JSON.stringify(tsConfig, null, 2),
                                err => err ? reject(err) : resolve());
                        })
                        .then(() => {
                            console.log(chalk.green(`Created:`) +
                                ' tsconfig.app.json');
                            return;
                        });
                }
            });
        })
        // save tsconfig.app.aot.json file
        .then(() => {
            //const appConfig = cfg.angularBuildConfigMaster.apps[0];
            const tsConfigPath = path.resolve(projectRoot, 'tsconfig.app.aot.json');
            return checkFileOrDirectoryExistsAsync(tsConfigPath).then(exists => {
                if (exists) {
                    return Promise.resolve();
                } else {
                    //const excludeList: string[] = cfg.tsConfigAppAoTMaster.exclude || [];
                    //if (excludeList.indexOf(appConfig.outDir) === -1) {
                    //    excludeList.push(appConfig.outDir);
                    //}
                    //if (excludeList.indexOf(`${appConfig.root}/**/*.spec.ts`) === -1) {
                    //    excludeList.push(`${appConfig.root}/**/*.spec.ts`);
                    //}
                    //if (excludeList.indexOf(`${appConfig.root}/**/*.e2e.ts`) === -1) {
                    //    excludeList.push(`${appConfig.root}/**/*.e2e.ts`);
                    //}

                    const tsConfig: any = cfg.tsConfigAppAoTMaster;
                    //tsConfig.exclude = excludeList;
                    // Create
                    return new Promise((resolve, reject) => {
                            fs.writeFile(tsConfigPath,
                                JSON.stringify(tsConfig, null, 2),
                                err => err ? reject(err) : resolve());
                        })
                        .then(() => {
                            console.log(chalk.green(`Created:`) +
                                ' tsconfig.app.aot.json');
                            return;
                        });
                }
            });
        })
        // save tsconfig.test.json file
        .then(() => {
            const appConfig = cfg.angularBuildConfigMaster.apps[0];
            const tsConfigPath = path.resolve(projectRoot, 'tsconfig.test.json');
            return checkFileOrDirectoryExistsAsync(tsConfigPath).then(exists => {
                if (exists) {
                    return Promise.resolve();
                } else {
                    const tsConfig: any = cfg.tsConfigTestMaster;
                    tsConfig.files = [`${appConfig.root||'src'}/karma-test.browser.ts`];
                    tsConfig.include = [`${appConfig.root||'src'}/**/*.spec.ts`];
                    // Create
                    return new Promise((resolve, reject) => {
                            fs.writeFile(tsConfigPath,
                                JSON.stringify(tsConfig, null, 2),
                                err => err ? reject(err) : resolve());
                        })
                        .then(() => {
                            console.log(chalk.green(`Created:`) +
                                ' tsconfig.test.json');
                            return;
                        });
                }
            });
        })
        // save tsconfig.json file
        .then(() => {
            const tsConfigPath = path.resolve(projectRoot, 'tsconfig.json');
            return checkFileOrDirectoryExistsAsync(tsConfigPath).then(exists => {
                if (exists) {
                    return Promise.resolve();
                } else {
                    const tsConfig: any = cfg.tsConfigMaster;
                    // Create
                    return new Promise((resolve, reject) => {
                            fs.writeFile(tsConfigPath,
                                JSON.stringify(tsConfig, null, 2),
                                err => err ? reject(err) : resolve());
                        })
                        .then(() => {
                            console.log(chalk.green(`Created:`) +
                                ' tsconfig.json');
                            return;
                        });
                }
            });
        })
        // save tslint.json file
        //.then(() => {
        //    const tsLintPath = path.resolve(projectRoot, 'tslint.json');
        //    return checkFileOrDirectoryExistsAsync(tsLintPath).then(exists => {
        //        if (exists) {
        //            return Promise.resolve();
        //        } else {
        //            return new Promise((resolve, reject) => {
        //                    fs.copy(require.resolve('../../configs/tslint.json'),
        //                        tsLintPath,
        //                        err => {
        //                            err ? reject(err) : resolve();
        //                        });
        //                })
        //                .then(() => {
        //                    console.log(chalk.green('Created:') + ' tslint.json');
        //                    return;
        //                });
        //        }
        //    });
        //})
        // Create src folder
        .then(() => {
            const appConfig = cfg.angularBuildConfigMaster.apps[0];
            const srcPath = path.resolve(projectRoot, appConfig.root);
            return checkFileOrDirectoryExistsAsync(srcPath, true).then(exists => {
                if (exists) {
                    return Promise.resolve();
                } else {
                    return new Promise((resolve, reject) => {
                        fs.mkdir(srcPath, err => err ? reject(err) : resolve());
                    });
                }
            }
            );
        })
        // save favicon-config.json file
        .then(() => {
            const appConfig = cfg.angularBuildConfigMaster.apps[0];
            const faviconConfigFileName = appConfig.faviconConfig || 'favicon-config.json';
            const faviconConfigPath = path
                .resolve(projectRoot, appConfig.root, faviconConfigFileName);

            let userFaviconConfigExists = false;
            return checkFileOrDirectoryExistsAsync(faviconConfigPath).then(exists => {
                if (exists) {
                    userFaviconConfigExists = true;
                    // Merge
                    return readJsonAsync(faviconConfigPath).then((userFaviconConfig: any) => {
                        const cloneFaviconConfig = Object.assign({}, userFaviconConfig);
                        if ((cloneFaviconConfig as any)['$schema']) {
                            delete (cloneFaviconConfig as any)['$schema'];
                        }

                        const validate = ajv().compile(faviconSchema);
                        const valid = validate(cloneFaviconConfig);
                        if (valid && userFaviconConfig.masterPicture ) {
                            return Promise.resolve(null);
                        }

                        if (!valid) {
                            return Promise.resolve(cfg.faviconConfigMaster);

                        }

                        userFaviconConfig.masterPicture = userFaviconConfig.masterPicture ||
                            cfg.faviconConfigMaster.masterPicture;

                        return Object.assign({}, cfg.faviconConfigMaster, userFaviconConfig);

                    });
                } else {
                    return Promise.resolve(cfg.faviconConfigMaster);
                }
            }).then((faviconConfig: any) => {
                if (!faviconConfig) {
                    return Promise.resolve();
                }

                // Create
                return new Promise((resolve, reject) => {
                        fs.writeFile(faviconConfigPath,
                            JSON.stringify(faviconConfig, null, 2),
                            err => err ? reject(err) : resolve());
                    })
                    .then(() => {
                        const relativePath = path.relative(projectRoot, faviconConfigPath);
                        console.log(chalk.green(`${userFaviconConfigExists ? 'Updated' : 'Created'}:`) +
                            ' ' +
                            relativePath);
                        return;
                    });
            });
        })
        // copy polyfills.browser.ts
        .then(() => {
            const appConfig = cfg.angularBuildConfigMaster.apps[0];
            return checkFileOrDirectoryExistsAsync(path.resolve(projectRoot, appConfig.root, 'polyfills.browser.ts'))
                .then(exists => {
                    if (exists) {
                        return Promise.resolve();
                    } else {
                        return new Promise((resolve, reject) => {
                            fs.copy(require.resolve('../../configs/polyfills.browser.ts'),
                                path.resolve(projectRoot, appConfig.root, 'polyfills.browser.ts'),
                                err => {
                                    err ? reject(err) : resolve();
                                });
                        })
                            .then(() => {
                                console.log(chalk.green('Created:') +
                                    ' ' +
                                    path.join(appConfig.root, 'polyfills.browser.ts'));
                                return;
                            });
                    }
                });

        })
        // copy rxjs.imports.ts
        .then(() => {
            const appConfig = cfg.angularBuildConfigMaster.apps[0];
            return checkFileOrDirectoryExistsAsync(path.resolve(projectRoot, appConfig.root, 'rxjs.imports.ts'))
                .then(exists => {
                    if (exists) {
                        return Promise.resolve();
                    } else {
                        return new Promise((resolve, reject) => {
                            fs.copy(require.resolve('../../configs/rxjs.imports.ts'),
                                path.resolve(projectRoot, appConfig.root, 'rxjs.imports.ts'),
                                err => {
                                    err ? reject(err) : resolve();
                                });
                        })
                            .then(() => {
                                console.log(chalk.green('Created:') +
                                    ' ' +
                                    path.join(appConfig.root, 'rxjs.imports.ts'));
                                return;
                            });
                    }
                });

        })
        // copy custom-typings.d.ts
        .then(() => {
            const appConfig = cfg.angularBuildConfigMaster.apps[0];
            return checkFileOrDirectoryExistsAsync(path.resolve(projectRoot, appConfig.root, 'custom-typings.d.ts'))
                .then(exists => {
                    if (exists) {
                        return Promise.resolve();
                    } else {
                        return new Promise((resolve, reject) => {
                            fs.copy(require.resolve('../../configs/custom-typings.d.ts'),
                                path.resolve(projectRoot, appConfig.root, 'custom-typings.d.ts'),
                                err => {
                                    err ? reject(err) : resolve();
                                });
                        })
                            .then(() => {
                                console.log(chalk.green('Created:') +
                                    ' ' +
                                    path.join(appConfig.root, 'custom-typings.d.ts'));
                                return;
                            });
                    }
                });

        })
        // copy karma-test.browser.ts
        .then(() => {
            const appConfig = cfg.angularBuildConfigMaster.apps[0];
            return checkFileOrDirectoryExistsAsync(path.resolve(projectRoot, appConfig.root, 'karma-test.browser.ts'))
                .then(exists => {
                    if (exists) {
                        return Promise.resolve();
                    } else {
                        return new Promise((resolve, reject) => {
                                fs.copy(require.resolve('../../configs/karma-test.browser.ts'),
                                    path.resolve(projectRoot, appConfig.root, 'karma-test.browser.ts'),
                                    err => {
                                        err ? reject(err) : resolve();
                                    });
                            })
                            .then(() => {
                                console.log(chalk.green('Created:') +
                                    ' ' +
                                    path.join(appConfig.root, 'karma-test.browser.ts'));
                                return;
                            });
                    }
                });

        })
        // copy styles.scss
        .then(() => {
            const appConfig = cfg.angularBuildConfigMaster.apps[0];
            return checkFileOrDirectoryExistsAsync(path.resolve(projectRoot, appConfig.root, 'styles.scss'))
                .then(exists => {
                    if (exists) {
                        return Promise.resolve();
                    } else {
                        return new Promise((resolve, reject) => {
                            fs.copy(require.resolve('../../configs/styles.scss'),
                                path.resolve(projectRoot, appConfig.root, 'styles.scss'),
                                err => {
                                    err ? reject(err) : resolve();
                                });
                        })
                            .then(() => {
                                console.log(chalk.green('Created:') +
                                    ' ' +
                                    path.join(appConfig.root, 'styles.scss'));
                                return;
                            });
                    }
                });

        })
        // create environments folder
        .then(() => {
            const appConfig = cfg.angularBuildConfigMaster.apps[0];
            const environmentsPath = path.resolve(projectRoot, appConfig.root, 'environments');
            return checkFileOrDirectoryExistsAsync(environmentsPath, true).then(exists => {
                if (exists) {
                    return Promise.resolve();
                } else {
                    return new Promise((resolve, reject) => {
                        fs.mkdir(environmentsPath, err => err ? reject(err) : resolve());
                    });
                }
            }
            );
        })
        // copy environment files
        .then(() => {
            const appConfig = cfg.angularBuildConfigMaster.apps[0];
            return checkFileOrDirectoryExistsAsync(path
                .resolve(projectRoot, appConfig.root, 'environments', 'environment.ts'))
                .then(exists => {
                    if (exists) {
                        return Promise.resolve();
                    } else {
                        return new Promise((resolve, reject) => {
                            fs.copy(require.resolve('../../configs/environment.ts'),
                                path.resolve(projectRoot, appConfig.root, 'environments', 'environment.ts'),
                                err => {
                                    err ? reject(err) : resolve();
                                });
                        })
                            .then(() => {
                                console.log(chalk.green('Created:') +
                                    ' ' +
                                    path.join(appConfig.root, 'environments', 'environment.ts'));
                                return;
                            });
                    }
                }).then(() => {
                    return checkFileOrDirectoryExistsAsync(path.resolve(projectRoot,
                        appConfig.root,
                        'environments',
                        'environment.prod.ts'))
                        .then(exists => {
                            if (exists) {
                                return Promise.resolve();
                            } else {
                                return new Promise((resolve, reject) => {
                                    fs.copy(require.resolve('../../configs/environment.prod.ts'),
                                        path
                                            .resolve(projectRoot,
                                            appConfig
                                                .root,
                                            'environments',
                                            'environment.prod.ts'),
                                        err => {
                                            err ? reject(err) : resolve();
                                        });
                                })
                                    .then(() => {
                                        console.log(chalk.green('Created:') +
                                            ' ' +
                                            path.join(appConfig.root, 'environments', 'environment.prod.ts'));
                                        return;
                                    });
                            }
                        });
                });
        })
        // update package.json
        .then(() => {
            let outDir = 'dist';
            if (cfg.userAngularBuildConfig && cfg.userAngularBuildConfig.apps.length) {
                const firstAppConfig = cfg.userAngularBuildConfig.apps[0];
                outDir = firstAppConfig.outDir || 'dist';
            }

            const configOpt = typeof cfg.commandOptions.webpackConfigFileName === 'undefined' ||
                cfg.commandOptions.webpackConfigFileName === 'webpack.config.js'
                ? ' '
                : ` --config ${cfg.commandOptions.webpackConfigFileName} `;
            let packageScripts: any = {
                "build:dll": `cross-env NODE_ENV=development webpack${configOpt}--env.dll --profile --colors --bail`,
                "build:dev": `cross-env NODE_ENV=development webpack${configOpt}--env.dev --profile --colors --bail`,
                "build:prod": `cross-env NODE_ENV=production webpack${configOpt}--env.prod --profile --colors --bail`,
                "build:aot": `cross-env NODE_ENV=production webpack${configOpt}--env.aot --env.prod --profile --colors --bail`,
                "build:universal": `cross-env NODE_ENV=production webpack${configOpt}--env.universal --env.prod --profile --colors --bail`,
                "build:universal:aot": `cross-env NODE_ENV=production webpack${configOpt}--env.universal --env.aot --env.prod --profile --colors --bail`,
                "build": 'npm run build:dev'

                //"lint": `npm run tslint \"${appConfig.root}/**/*.ts\"`,
            };

            // Clean
            cfg.userAngularBuildConfig.apps.forEach((appConfig: AppConfig) => {
                if (appConfig.outDir === 'wwwroot') {
                    packageScripts['clean:' + appConfig.outDir] = 'npm run rimraf -- ' + appConfig.outDir + '/**/*';
                } else {
                    packageScripts['clean:' + appConfig.outDir] = 'npm run rimraf -- ' + appConfig.outDir;
                }
            });
            packageScripts['clean:aot-compiled'] = 'npm run rimraf -- aot-compiled';
            packageScripts['clean:coverage'] = 'npm run rimraf -- coverage';

            // Tests
            const pkgConfigTest: any = {
                "test": 'karma start',

                "e2e": 'npm-run-all -p -r http-server:run protractor',
                "e2e:live": 'npm-run-all -p -r http-server:run protractor -- --elementExplorer',
                "pree2e": 'npm run webdriver:update -- --standalone',

                "webdriver:start": 'npm run webdriver-manager start',
                "webdriver:update": 'npm run webdriver-manager update'
            };
            packageScripts = Object.assign(packageScripts, pkgConfigTest);

            // Http server
            const pkgConfigServer: any = {
                "serve:dev": `webpack-dev-server ${configOpt}--open --progress --inline --hot --watch --port 5000`,
                "serve": 'npm run serve:dev',
                "http-server:run": `http-server ${outDir} -p 5000 -c-1 --cors`
            };
            packageScripts = Object.assign(packageScripts, pkgConfigServer);

            // ASP.Net Core
            if (cfg.isAspNetCore) {
                const pkgConfigAspNet : any = {
                    "dotnet:run:dev": 'cross-env ASPNETCORE_ENVIRONMENT=Development dotnet run environment=development',
                    "dotnet:run:prod": 'cross-env ASPNETCORE_ENVIRONMENT=Production dotnet run --configuration Release environment=production',
                    "dotnet:run": 'dotnet run'
                };
                packageScripts = Object.assign(packageScripts, pkgConfigAspNet);
            }

            // Http server
            const pkgConfigMap: any = {
                "cross-env": 'cross-env',
                "rimraf": 'rimraf',
                "protractor": 'protractor',
                //"tslint": 'tslint',
                "webpack": 'webpack',
                "webdriver-manager": 'webdriver-manager',
                "webpack-dev-server": 'webpack-dev-server'
            };
            packageScripts = Object.assign(packageScripts, pkgConfigMap);

            // read package json
            return readJsonAsync(cfg.userPackageConfigFile).then((userPackageConfig: any) => {
                cfg.userPackageConfig = userPackageConfig;

                let shouldUpdate = true;
                if (cfg.userPackageConfig.scripts) {
                    const foundLen = Object.keys(packageScripts)
                        .filter((key: string) => cfg.userPackageConfig.scripts[key] &&
                            cfg.userPackageConfig.scripts[key] === packageScripts[key]).length;
                    if (foundLen === Object.keys(packageScripts).length) {
                        shouldUpdate = false;
                    }
                }
                if (shouldUpdate) {
                    cfg.userPackageConfig.scripts = Object
                        .assign({}, cfg.userPackageConfig.scripts || {}, packageScripts);
                    return new Promise((resolve, reject) => {
                        fs.writeFile(cfg.userPackageConfigFile,
                            JSON.stringify(cfg.userPackageConfig, null, 2),
                            err => err ? reject(err) : resolve());
                    })
                        .then(() => {
                            console.log(chalk.green('Updated:') + ' package.json');
                            return;
                        });
                } else {
                    return Promise.resolve();
                }
            });
        })
        .then(() => {
            if (cfg.commandOptions.link && !cfg.cliIsLocal) {
                console.log('\nLinking @bizappframework/angular-build...');
                return spawnAsync('npm',
                    ['link', '@bizappframework/angular-build', '--color', 'always', '--loglevel', 'error']);
            } else {
                return Promise.resolve(0);
            }
        })
        .then(() => {
            console.log('\nInitialization complete.');
            return 0;
        });
}

// Private functions
function mergeConfigAsync(cfg: InitConfig): Promise<void> {
    return mergeConfigWithPossibleAsync(cfg)
        .then(() => mergeConfigWithAngularCli(cfg))
        .then(() => mergeConfigWithUserAngularBuildConfig(cfg))
        .then(() => mergeConfigWithUserFaviconConfig(cfg))
        .then(() => mergeWithCommandOptions(cfg))
        .then(() => (cfg.commandOptions.prompt && !cfg.commandOptions.force)
            ? mergeConfigWithPromptAsync(cfg)
            : Promise.resolve());
}

function mergeConfigWithPossibleAsync(cfg: InitConfig): Promise<void> {
    const projectRoot = cfg.cwd;
    const appConfig = cfg.angularBuildConfigMaster.apps[0];

    const possibleSrcDirs = ['Client', 'src'];
    const possibleOutDirs = ['wwwroot', 'dist'];
    const possibleMains = ['main.browser.ts', 'main.ts'];
    const possibleStyles = ['styles.scss', 'styles.sass', 'styles.less', 'styles.stylus', 'styles.css'];
    const possibleFavicons = ['logo.svg', 'logo.png', 'favlogo.svg', 'favlogo.png', 'favicon.svg', 'favicon.png'];

    // root
    return findFileOrDirectoryFromPossibleAsync(projectRoot, possibleSrcDirs, appConfig.root, true)
        .then((foundRoot: string) => {
            appConfig.root = foundRoot || appConfig.root;

            // outDir
            return findFileOrDirectoryFromPossibleAsync(projectRoot, possibleOutDirs, appConfig.outDir, true)
                .then((foundOutDir: string) => {
                    appConfig.outDir = foundOutDir || appConfig.outDir;
                    return;
                });
        })
        .then(() => {
            // main
            return findFileOrDirectoryFromPossibleAsync(path.resolve(projectRoot, appConfig.root),
                possibleMains,
                appConfig.main,
                false)
                .then((foundMain: string) => {
                    appConfig.main = foundMain || appConfig.main;
                    return;
                });
        })
        .then(() => {
            // styles
            return findFileOrDirectoryFromPossibleAsync(path.resolve(projectRoot, appConfig.root),
                possibleStyles,
                'styles.scss',
                false)
                .then((foundStyle: string) => {
                    if (foundStyle) {
                        if (Array.isArray(appConfig.styles)) {
                            if (appConfig.styles.indexOf(foundStyle) === -1) {
                                appConfig.styles.push(foundStyle);
                            }
                        } else {
                            if (!appConfig.styles) {
                                appConfig.styles = [foundStyle];
                            }
                        }
                    }

                    return;
                });
        })
        .then(() => {
            // asset folder
            return findFileOrDirectoryFromPossibleAsync(path.resolve(projectRoot, appConfig.root),
                ['assets'],
                'asset',
                true)
                .then((foundAsset: string) => {
                    if (foundAsset) {
                        if (Array.isArray(appConfig.assets)) {
                            if (appConfig.assets.indexOf(foundAsset) === -1 &&
                                appConfig.assets.indexOf('assets/**/*') === -1) {
                                appConfig.assets.push('assets/**/*');
                            }
                        } else {
                            if (!appConfig.styles) {
                                appConfig.assets = ['assets/**/*'];
                            }
                        }
                    }

                    return;
                });
        })
        .then(() => {
            // robots.txt
            return findFileOrDirectoryFromPossibleAsync(path.resolve(projectRoot, appConfig.root),
                ['robots.txt'],
                'robots.txt',
                false)
                .then((foundAsset: string) => {
                    if (foundAsset) {
                        if (Array.isArray(appConfig.assets)) {
                            if (appConfig.assets.indexOf(foundAsset) === -1) {
                                appConfig.assets.push(foundAsset);
                            }
                        } else {
                            if (!appConfig.styles) {
                                appConfig.assets = [foundAsset];
                            }
                        }
                    }

                    return;
                });
        })
        .then(() => {
            // humans.txt
            return findFileOrDirectoryFromPossibleAsync(path.resolve(projectRoot, appConfig.root),
                ['humans.txt'],
                'humans.txt',
                false)
                .then((foundAsset: string) => {
                    if (foundAsset) {
                        if (Array.isArray(appConfig.assets)) {
                            if (appConfig.assets.indexOf(foundAsset) === -1) {
                                appConfig.assets.push(foundAsset);
                            }
                        } else {
                            if (!appConfig.styles) {
                                appConfig.assets = [foundAsset];
                            }
                        }
                    }

                    return;
                });
        })
        .then(() => {
            // favicon
            return findFileOrDirectoryFromPossibleAsync(path.resolve(projectRoot, appConfig.root),
                possibleFavicons,
                'favicon.svg',
                false)
                .then((foundFavicon: string) => {
                    if (foundFavicon) {
                        cfg.faviconConfigMaster.masterPicture = foundFavicon;
                        appConfig.faviconConfig = appConfig.faviconConfig || 'favicon-config.json';
                    } else {
                        if (cfg.faviconConfigMaster) {
                            cfg.faviconConfigMaster.masterPicture = '';
                        }
                    }

                    return;
                });
        })
        .then(() => {
            // index
            return findFileOrDirectoryFromPossibleAsync(path.resolve(projectRoot, appConfig.root),
                ['index.html'],
                'index.html',
                false)
                .then((foundIndex: string) => {
                    if (foundIndex) {
                        appConfig.index = foundIndex;
                    }

                    return;
                });
        })
        .then(() => {
            // asp.net core
            return checkFileOrDirectoryExistsAsync(path.resolve(projectRoot, 'Views', 'Shared'), true)
                .then(exists => exists
                    ? checkFileOrDirectoryExistsAsync(path.resolve(projectRoot, 'wwwroot'), true)
                    : Promise.resolve(false));
        })
        .then(aspNet => {
            if (aspNet) {
                //if (appConfig.index) {
                //    delete appConfig.index;
                //}
                cfg.isAspNetCore = true;
                appConfig.htmlInjectOptions = appConfig.htmlInjectOptions || {};
                appConfig.htmlInjectOptions.scriptsOutFileName = '../Views/Shared/_BundledScripts.cshtml';
                appConfig.htmlInjectOptions.iconsOutFileName = '../Views/Shared/_FavIcons.cshtml';
                appConfig.htmlInjectOptions.stylesOutFileName = '../Views/Shared/_BundledStyles.cshtml';
                appConfig.htmlInjectOptions
                    .customTagAttributes = [
                        { tagName: 'link', attribute: { "asp-append-version": true } },
                        { tagName: 'script', attribute: { "asp-append-version": true } }
                    ];

            }
            return;
        });
}

function mergeConfigWithAngularCli(cfg: InitConfig): void {
    if (cfg.angularBuildConfigFileExists ||
        !cfg.angularCliConfigFileExists ||
        !cfg.userAngularCliConfig ||
        !cfg.userAngularCliConfig.apps ||
        !cfg.userAngularCliConfig.apps[0]) {
        return;
    }

    const appConfig = cfg.angularBuildConfigMaster.apps[0] as any;
    const cliAppConfig = cfg.userAngularCliConfig.apps[0] as any;
    const appConfigSchema: any = schema.definitions.AppConfig.properties;

    Object.keys(cliAppConfig)
        .filter((key: string) => cfg.userAngularCliConfig[key] !== null && appConfigSchema[key] && key !== 'tsconfig')
        .forEach((key: string) => {
            appConfig[key] = cliAppConfig[key];
        });
}

function mergeConfigWithUserAngularBuildConfig(cfg: InitConfig): void {
    if (!cfg.angularBuildConfigFileExists ||
        !cfg.userAngularBuildConfig ||
        !cfg.userAngularBuildConfig.apps ||
        !cfg.userAngularBuildConfig.apps[0]) {
        return;
    }

    const masterAppConfig = cfg.angularBuildConfigMaster.apps[0] as any;
    const userAppConfig = cfg.userAngularBuildConfig.apps[0] as any;
    const appConfigSchema: any = schema.definitions.AppConfig.properties;

    Object.keys(userAppConfig)
        .filter((key: string) => appConfigSchema[key] && userAppConfig[key] !== null && userAppConfig[key] !== '')
        .forEach((key: string) => {
            masterAppConfig[key] = userAppConfig[key];
        });

}

function mergeConfigWithUserFaviconConfig(cfg: InitConfig): Promise<void> {
    const projectRoot = cfg.cwd;
    let faviconConfigPath = '';
    if (cfg.angularBuildConfigFileExists &&
        cfg.userAngularBuildConfig &&
        cfg.userAngularBuildConfig.apps &&
        cfg.userAngularBuildConfig.apps[0].faviconConfig &&
        cfg.userAngularBuildConfig.apps[0].root) {
        faviconConfigPath = path.resolve(projectRoot,
            cfg.userAngularBuildConfig.apps[0].root,
            cfg.userAngularBuildConfig.apps[0].faviconConfig);
    }

    if (!faviconConfigPath) {
        return Promise.resolve();
    }

    return checkFileOrDirectoryExistsAsync(faviconConfigPath).then((exists: boolean) => {
        cfg.faviconConfigFileExists = exists;
        if (exists) {
            return readJsonAsync(faviconConfigPath).then((faviconConfig: any) => {
                cfg.userFaviconConfig = faviconConfig;
                if (faviconConfig.masterPicture) {
                    cfg.faviconConfigMaster.masterPicture = faviconConfig.masterPicture;
                    cfg.faviconConfigMaster = Object.assign({}, cfg.faviconConfigMaster, faviconConfig);
                }
                return;
            });
        } else {
            return Promise.resolve();
        }
    }).then(() => {
        return;
    });
}

function mergeWithCommandOptions(cfg: InitConfig): void {
    const appConfig = cfg.angularBuildConfigMaster.apps[0];
    const appConfigSchema: any = schema.definitions.AppConfig.properties;

    Object.keys(cfg.commandOptions).forEach((key: string) => {
        const commandOptions: any = cfg.commandOptions;
        if (typeof commandOptions[key] !== 'undefined' &&
            commandOptions[key] !== null &&
            (!Array.isArray(commandOptions[key]) ||
                (Array.isArray(commandOptions[key]) && commandOptions[key].find((s: any) => s !== null))) &&
            key !== 'extends' &&
            appConfigSchema[key]) {
            const obj = appConfig as any;
            if (appConfigSchema[key].type === 'boolean') {
                obj[key] = commandOptions[key].toString().toLowerCase() === 'true';
            } else {
                obj[key] = commandOptions[key];
            }
        }
    });
}

function mergeConfigWithPromptAsync(cfg: InitConfig): Promise<void> {
    const appConfig = cfg.angularBuildConfigMaster.apps[0];

    return Promise.resolve(cfg.angularBuildConfigFileExists)
        .then((exists: boolean) => {
            if (exists) {
                if (cfg.commandOptions.overrideAngularBuildConfigFile) {
                    return Promise.resolve();
                }
                return askAsync(chalk.bgYellow('WARNING:') +
                    ` Override 'angular-build.json' yes/no ('no')?: `)
                    .then((answer: string) => {
                        if (answer &&
                            answer.trim() &&
                            (answer.trim().toLowerCase() === 'yes' ||
                                answer.trim().toLowerCase() === 'y')) {
                            cfg.commandOptions.overrideAngularBuildConfigFile = true;
                        }
                    });
            } else {
                return Promise.resolve();
            }
        })
        .then(() => {
            if (cfg.webpackConfigFileExists) {
                return askAsync(chalk.bgYellow('WARNING:') +
                    ` Override '${cfg.commandOptions.webpackConfigFileName}' yes/no (yes)?: `)
                    .then((answer: string) => {
                        if (answer &&
                            answer.trim() &&
                            (answer.trim().toLowerCase() === 'no' ||
                                answer.trim().toLowerCase() === 'n')) {
                            cfg.commandOptions.overrideWebpackConfigFile = false;
                        } else {
                            cfg.commandOptions.overrideWebpackConfigFile = true;
                        }
                    });
            } else {
                return Promise.resolve();
            }
        })
        .then(() => {
            if (cfg.commandOptions.root ||
                (cfg.angularBuildConfigFileExists && !cfg.commandOptions.overrideAngularBuildConfigFile)) {
                return Promise.resolve();
            }
            return askAsync(`Enter client app root folder ${appConfig.root ? `(${appConfig.root})` : ''}: `)
                .then((answer: string) => {
                    if (answer && answer.trim()) {
                        appConfig.root = answer.trim();
                    }
                });
        })
        .then(() => {
            if (cfg.commandOptions.outDir ||
                (cfg.angularBuildConfigFileExists && !cfg.commandOptions.overrideAngularBuildConfigFile)) {
                return Promise.resolve();
            }
            return askAsync(`Enter build output folder ${appConfig.outDir ? `(${appConfig.outDir})` : ''}: `)
                .then((answer: string) => {
                    if (answer && answer.trim()) {
                        appConfig.outDir = answer.trim();
                    }
                });
        })
        .then(() => {
            if (cfg.commandOptions.publicPath ||
                (cfg.angularBuildConfigFileExists && !cfg.commandOptions.overrideAngularBuildConfigFile)) {
                return Promise.resolve();
            }
            return askAsync(`Enter public path ${appConfig.publicPath ? `(${appConfig.publicPath})` : ''}: `)
                .then((answer: string) => {
                    if (answer && answer.trim()) {
                        appConfig.publicPath = answer.trim();
                        if (!appConfig.publicPath.endsWith('/')) {
                            appConfig.publicPath += '/';
                        }
                    }
                });
        })
        .then(() => {
            if (cfg.commandOptions.main ||
                (cfg.angularBuildConfigFileExists && !cfg.commandOptions.overrideAngularBuildConfigFile)) {
                return Promise.resolve();
            }
            return askAsync(`Enter app bootstrap main file ${appConfig.main ? `(${appConfig.main})` : ''}: `)
                .then((answer: string) => {
                    if (answer && answer.trim()) {
                        appConfig.main = answer.trim();
                    }
                });
        })
        .then(() => { return; });
}

function checkAndInstallToolings(cfg: InitConfig): Promise<void> {
    const projectRoot = cfg.cwd;
    if (typeof cfg.commandOptions.installLoadersOnly === 'undefined') {
        cfg.commandOptions.installLoadersOnly = cfg.commandOptions.link;
    }
    const installLoadersOnly = cfg.commandOptions.installLoadersOnly;

    const preReleasedPackageNames : string[] = [
    ];

    const peerDeps = [
        '@angular/service-worker',
        '@types/node',
        '@types/jasmine',

        //'codelyzer',
        'cross-env',
        'event-source-polyfill',

        'http-server',
        'ie-shim',

        'jasmine-core',
        'jasmine-spec-reporter',

        'karma',
        'karma-chrome-launcher',
        //'karma-cli',
        'karma-coverage-istanbul-reporter',
        'karma-jasmine',
        'karma-jasmine-html-reporter',
        'karma-mocha-reporter',
        //'karma-phantomjs-launcher',
        //'karma-source-map-support',
        'karma-sourcemap-loader',
        'karma-webpack',

        'npm-run-all',
        'protractor',

        'rimraf',
        'typescript',
        'ts-node',
        'tslib',
        'tslint',
        'webpack',
        'webpack-dev-server',
        'webpack-hot-middleware'
    ];

    const aspWebpackTools = [
        'aspnet-webpack',
        'aspnet-prerendering'
    ];
    const loaderDeps = [
        '@angular/compiler-cli',
        '@angular/compiler',
        '@angular/core',
        '@ngtools/webpack',
        'less',
        'node-sass',
        'stylus'
    ];

    const angularMinimalDeps = [
        '@angular/common',
        '@angular/forms',
        '@angular/http',
        '@angular/router',
        '@angular/platform-browser',
        '@angular/platform-browser-dynamic',
        '@angular/platform-server',

        'core-js',
        'rxjs',
        'zone.js'
    ];

    const depSaveFilteredList = [
        'es6-promise',
        'es6-shim',
        'ie-shim',
        'reflect-metadata',
        'rxjs',
        'core-js',
        'ts-helpers',
        'tslib',
        'zone.js',

        'event-source-polyfill',
        '@angular/service-worker',

        '@angular/compiler',
        '@angular/core',

        '@angular/common',
        '@angular/forms',
        '@angular/http',
        '@angular/router',
        '@angular/platform-browser',
        '@angular/platform-browser-dynamic',
        '@angular/platform-server'
    ];

    const depsToInstall: string[] = [];

    const depPackages: PackageToCheck[] = Object.keys(cfg.cliPackageJsonConfig.dependencies)
        .filter((key: string) => !installLoadersOnly || (installLoadersOnly && key.match(/loader$/)))
        .map((key: string) => {
            const ver = cfg.cliPackageJsonConfig.dependencies[key];
            const isPreReleased = !(preReleasedPackageNames.indexOf(key) === -1);
            return {
                packageName: key,
                version: ver,
                isPreReleased: isPreReleased
            };
        });


    return checkPackagesToInstall(peerDeps, projectRoot)
        .then((packageNames: string[]) => {
            packageNames.forEach((pkgName: string) => {
                if (depsToInstall.indexOf(pkgName) === -1) {
                    depsToInstall.push(pkgName);
                }
            });
        })
        .then(() => {
            if (!cfg.isAspNetCore) {
                return Promise.resolve();
            }

            return checkPackagesToInstall(aspWebpackTools, projectRoot)
                .then((packageNames: string[]) => {
                    packageNames.forEach((pkgName: string) => {
                        if (depsToInstall.indexOf(pkgName) === -1) {
                            depsToInstall.push(pkgName);
                        }
                    });
                });
        })
        .then(() => {
            if (cfg.cliIsLocal) {
                return Promise.resolve();
            }

            return checkPackagesToInstall(depPackages, projectRoot)
                .then((packageNames: string[]) => {
                    packageNames.forEach((pkgName: string) => {
                        if (depsToInstall.indexOf(pkgName) === -1) {
                            depsToInstall.push(pkgName);
                        }
                    });
                });
        })
        .then(() => {
            if (cfg.cliIsLocal) {
                return Promise.resolve();
            }

            return checkPackagesToInstall(loaderDeps, projectRoot)
                .then((packageNames: string[]) => {
                    packageNames.forEach((pkgName: string) => {
                        if (depsToInstall.indexOf(pkgName) === -1) {
                            depsToInstall.push(pkgName);
                        }
                    });
                });
        })
        .then(() => {
            if (depsToInstall.indexOf('@angular/core') > -1) {
                depsToInstall.push(...angularMinimalDeps);
            }

            if (depsToInstall.length) {
                console.log('Installing packages for tooling via npm...');
                const installedPackages: string[] = [];
                const depsToSave: string[] = [];
                const devDepsToSave: string[] = [];
                depsToInstall.forEach(p => {
                    if (depSaveFilteredList.indexOf(p) > -1) {
                        depsToSave.push(p);
                    } else {
                        devDepsToSave.push(p);
                    }
                });

                return Promise.resolve(0).then(() => {
                        if (!depsToSave.length) {
                            return Promise.resolve();
                        }
                        return spawnAsync('npm',
                                ['install', '-S', '--color', 'always', '--loglevel', 'error']
                                .concat(depsToSave))
                            .then(() => {
                                installedPackages.push(...depsToSave);
                                return;
                            });
                    })
                    .then(() => {
                        if (!devDepsToSave.length) {
                            return Promise.resolve();
                        }
                        return spawnAsync('npm',
                                ['install', '-D', '--color', 'always', '--loglevel', 'error']
                                .concat(devDepsToSave))
                            .then(() => {
                                installedPackages.push(...devDepsToSave);
                                return;
                            });
                    })
                    .then(() => {
                        if (installedPackages.length) {
                            console.log(chalk.green(installedPackages.join('\n')));
                        }
                        console.log('Packages were installed.\n');
                        return;
                    });
            } else {
                return Promise.resolve();
            }
        });
}

function checkPackagesToInstall(packagesToCheck: (PackageToCheck|string)[], projectRoot: string): Promise<string[]> {
    const tasks = packagesToCheck.map((pkgToCheck: PackageToCheck | string) => {
        const pkgToCheckObj: PackageToCheck = typeof pkgToCheck === 'string' ? { packageName: pkgToCheck } : pkgToCheck;
        const baseDir = path.resolve(projectRoot, 'node_modules');
        return new Promise(res => {
            resolve(pkgToCheckObj.packageName,
                { basedir: baseDir },
                (error, resolvedPath) => {
                    if (error) {
                        res(pkgToCheckObj);
                    } else {
                        pkgToCheckObj.resolvedPath = resolvedPath;
                        res(pkgToCheckObj);
                    }
                });
        }).then((packageObj: any) => {
            if (packageObj.resolvedPath) {
                if (packageObj.version) {
                    const versionRange = semver.validRange(packageObj.version);
                    return getVersionfromPackageJsonAsync(path
                        .resolve(projectRoot, 'node_modules', packageObj.packageName)).then((localVer: string) => {
                            if (localVer && semver.satisfies(localVer, versionRange)) {
                                return null;
                            }
                            if (packageObj.isPreReleased) {
                                return packageObj.packageName + '@' + packageObj.version;
                            } else {
                                return packageObj.packageName;
                            }
                        });
                } else {
                    return Promise.resolve(null);
                }
            } else {
                if (packageObj.packageName.match(/^@types\//)) {
                    return checkFileOrDirectoryExistsAsync(path
                        .resolve(projectRoot, 'node_modules', packageObj.packageName),
                        true)
                        .then((exists: boolean) => {
                            return exists ? null : packageObj.packageName;
                        });
                }
                if (packageObj.isPreReleased && packageObj.version) {
                    return Promise.resolve(packageObj.packageName + '@' + packageObj.version);
                } else {
                    return Promise.resolve(packageObj.packageName);
                }
            }
        });
    });

    return Promise.all(tasks).then(packages => packages.filter(p => p !== null));
}
