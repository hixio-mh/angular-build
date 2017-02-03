import * as path from 'path';
import * as fs from 'fs-extra';
import * as resolve from 'resolve';
import * as semver from 'semver';

import * as chalk from 'chalk';
import * as yargs from 'yargs';

import { CliOptions } from './models';
import { AngularBuildConfig } from '../models';
import { IconPluginOptions } from '../plugins/icon-webpack-plugin';

import {
    readJsonAsync, chageDashCase, mapToYargsType, checkFileOrDirectoryExistsAsync, findFileOrDirectoryFromPossibleAsync,
    getVersionfromPackageJsonAsync, askAsync, spawnAsync
} from '../utils';

// ReSharper disable once InconsistentNaming
const SCHEMA_PATH = '../../configs/schema.json';

const cliVersion = require('../../package.json').version;
const initCommandUsage = `\n${chalk.green(`angular-build ${cliVersion}`)}\n
Usage:
  ngb init [options...]`;

const angularBuildSchema: any = readJsonAsync(require.resolve(SCHEMA_PATH));

export interface PackageToCheck {
    packageName: string;
    isPreReleased?: boolean;
    version?: string;
    resolvedPath?: string;
};

export interface PackageJsonConfig {
    dependencies?: { [key: string]: string },
    devDependencies?: { [key: string]: string },
    peerDependencies?: { [key: string]: string }
}

export interface InitConfig {
    cliOptions: CliOptions;
    cliPackageJsonConfig?: PackageJsonConfig;

    angularBuildConfig?: AngularBuildConfig;
    overrideAngularBuildConfigFile?: boolean;
    angularBuildConfigFileExists?: boolean;

    userAngularCliConfig?: any;
    useAngularCliConfigFile?: boolean;
    angularCliConfigFileExists?: boolean;

    faviconConfig?: IconPluginOptions;

    webpackConfigFileName?: string;
    webpackConfigFileExists?: boolean;
    overrideWebpackConfigFile?: boolean;

    userPackageConfigFileExists?: boolean;
    userPackageConfigFile?: string;
    userPackageConfig?: any;

    tsConfig?: any;
}

export function getInitCommandModule(): yargs.CommandModule {

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
                    describe: 'It will use only defaults and not prompt you for any options',
                    type: 'boolean',
                    default: false
                })
                .option('link-cli',
                {
                    alias: ['l', 'linkCli'],
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
                .option('use-angular-cli-config-file',
                {
                    describe: 'Use angular-cli.json as a build config file',
                    type: 'boolean',
                    default: undefined
                })
                .option('webpack-config-file-name',
                {
                    describe: 'Webpack config file name',
                    type: 'string'
                })
                .option('favicon-naster-picture',
                {
                    describe: 'favicon master picture file name',
                    type: 'string'
                })
                .option('override-angular-build-config-file',
                {
                    describe: 'Override angular-build.json file',
                    type: 'boolean',
                    default: false
                })
                .option('override-webpack-config-file',
                {
                    describe: 'Override webpack config file',
                    type: 'boolean',
                    default: false
                });

            const appConfigSchema: any = angularBuildSchema.definitions.AppConfig.properties;
            Object.keys(appConfigSchema).forEach((key: string) => {
                yargvObj = yargvObj.options(chageDashCase(key),
                {
                    describe: appConfigSchema[key].description || key,
                    type: mapToYargsType(appConfigSchema[key].type),
                    default: appConfigSchema[key].default
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
export function init(cliOptions: CliOptions) {
    return checkFileOrDirectoryExistsAsync(path.resolve(cliOptions.cwd, 'angular-build.json')).then(exists => {
        if (exists && (!cliOptions.commandOptions || !(cliOptions.commandOptions.prompt || cliOptions.commandOptions.force || cliOptions.commandOptions.linkCli))) {
            return Promise.resolve(0);
        } else {
            return initCore(cliOptions);
        }
    });
}

function initCore(cliOptions: CliOptions) {
    const projectRoot = cliOptions.cwd;

    return checkFileOrDirectoryExistsAsync(path.resolve(projectRoot, 'package.json'))
        .then((exists: boolean) => {
            const cfg: InitConfig = {
                cliOptions: cliOptions
            };

            if (exists) {
                cfg.userPackageConfigFileExists = true;
                cfg.userPackageConfigFile = path.resolve(projectRoot, 'package.json');
                return Promise.resolve(cfg);
            } else {
                if (cliOptions.commandOptions.force) {
                    return spawnAsync('npm', ['init', '-f', '--color', 'always', '--loglevel', 'error']).then(() => {
                        cfg.userPackageConfigFileExists = true;
                        cfg.userPackageConfigFile = path.resolve(projectRoot, 'package.json');
                        return cfg;
                    });
                } else {
                    const msg = `'package.json' file doesn't exist.\nPlease run ${chalk
                        .cyan('npm init')
                        } command to init 'package.json' file or run ${chalk.cyan('ngb init -f')} to force create 'package.json' file.`;
                    return Promise.reject(msg);
                }
            }
        })
        .then((cfg: InitConfig) => {
            return readJsonAsync(require.resolve('../../package.json')).then(cliPkgConfig => {
                cfg.cliPackageJsonConfig = cliPkgConfig;
                return cfg;
            });
        })
        .then((cfg: InitConfig) => {
            if (cfg.cliOptions.commandOptions.skipInstallTooling) {
                return Promise.resolve(cfg);
            }
            return installToolings(cfg).then(() => cfg);
        })
        .then((cfg: InitConfig) => {
            return readJsonAsync(require.resolve('../../configs/angular-build.json')).then((angularBuildConfig: AngularBuildConfig) => {
                cfg.angularBuildConfig = angularBuildConfig;
                return cfg;
            });
        })
        .then((cfg: InitConfig) => {
            return readJsonAsync(require.resolve('../../configs/tsconfig.json')).then((tsConfig: any) => {
                cfg.tsConfig = tsConfig;
                return cfg;
            });
        })
        .then((cfg: InitConfig) => {
            return readJsonAsync(require.resolve('../../configs/favicon-config.json')).then((faviconConfig: IconPluginOptions) => {
                cfg.faviconConfig = faviconConfig;
                return cfg;
            });
        })
        .then((cfg: InitConfig) => {
            return readJsonAsync(cfg.userPackageConfigFile).then((userPackageConfig: any) => {
                cfg.userPackageConfig = userPackageConfig;
                return cfg;
            });
        })
        // 0. merge
        .then((cfg: InitConfig) => mergeConfigAsync(cfg).then(() => cfg))
        // 1. save angular-build.json file
        .then((cfg: InitConfig) => {
            if (cfg.useAngularCliConfigFile) {
                if (cfg.angularCliConfigFileExists && cfg.userAngularCliConfig) {
                    cfg.userAngularCliConfig.apps[0] = Object.assign(cfg.userAngularCliConfig.apps[0], cfg.angularBuildConfig.apps[0]);
                    return new Promise((resolve, reject) => {
                        fs.writeFile(path.resolve(projectRoot, 'angular-cli.json'),
                            JSON.stringify(cfg.userAngularCliConfig, null, 2),
                            err => err ? reject(err) : resolve(cfg));
                    });
                } else {
                    return new Promise((resolve, reject) => {
                        fs.writeFile(path.resolve(projectRoot, 'angular-cli.json'),
                            JSON.stringify(cfg.angularBuildConfig, null, 2),
                            err => err ? reject(err) : resolve(cfg));
                    });
                }

            } else {
                if (cfg.angularBuildConfigFileExists && !cfg.overrideAngularBuildConfigFile) {
                    return Promise.resolve(cfg);
                } else {
                    return new Promise((resolve, reject) => {
                        fs.writeFile(path.resolve(projectRoot, 'angular-build.json'),
                            JSON.stringify(cfg.angularBuildConfig, null, 2),
                            err => err ? reject(err) : resolve(cfg));
                    });
                }
            }
        })
        // 2. copy webpack.config file
        .then((cfg: InitConfig) => {
            if (cfg.webpackConfigFileExists && !cfg.overrideWebpackConfigFile) {
                return Promise.resolve(cfg);
            } else {
                return new Promise((resolve, reject) => {
                    if (cfg.webpackConfigFileName && cfg.webpackConfigFileName.match(/\.ts$/i)) {
                        fs.copy(require.resolve('../../configs/webpack.config.ts'),
                            path.resolve(projectRoot, cfg.webpackConfigFileName),
                            err => {
                                err ? reject(err) : resolve(cfg);
                            });
                    } else {
                        fs.copy(require.resolve('../../configs/webpack.config.js'),
                            path.resolve(projectRoot, cfg.webpackConfigFileName || 'webpack.config.js'),
                            err => {
                                err ? reject(err) : resolve(cfg);
                            });
                    }
                });
            }
        })
        // 3. Create src folder
        .then((cfg: InitConfig) => {
            const appConfig = cfg.angularBuildConfig.apps[0];
            const srcPath = path.resolve(projectRoot, appConfig.root);
            return checkFileOrDirectoryExistsAsync(srcPath, true).then(exists => {
                if (exists) {
                    return Promise.resolve(cfg);
                } else {
                    return new Promise((resolve, reject) => {
                        fs.mkdir(srcPath, err => err ? reject(err) : resolve(cfg));
                    });
                }
            }
            );
        })
        // 4. save tsconfig.json file
        .then((cfg: InitConfig) => {
            const appConfig = cfg.angularBuildConfig.apps[0];
            const tsConfigPath = path.resolve(projectRoot, appConfig.root, appConfig.tsconfig);
            const tsConfig = cfg.tsConfig;
            tsConfig.compilerOptions.outDir = `../${appConfig.outDir}/out-tsc`;

            return checkFileOrDirectoryExistsAsync(tsConfigPath).then(exists => {
                if (exists) {
                    return Promise.resolve(cfg);
                } else {
                    return new Promise((resolve, reject) => {
                        fs.writeFile(tsConfigPath, JSON.stringify(tsConfig, null, 2), err => err ? reject(err) : resolve(cfg));
                    });
                }
            });

        })
        // 5. save/override favicon-config.json file
        .then((cfg: InitConfig) => {
            const appConfig = cfg.angularBuildConfig.apps[0];
            const faviconConfig = cfg.faviconConfig;
            const faviconConfigPath = path
                .resolve(projectRoot, appConfig.root, appConfig.faviconConfig || 'favicon-config.json');

            return new Promise((resolve, reject) => {
                fs.writeFile(faviconConfigPath,
                    JSON.stringify(faviconConfig, null, 2),
                    err => err ? reject(err) : resolve(cfg));
            });
        })
        // 6. copy polyfills.ts and verdors.ts
        .then((cfg: InitConfig) => {
            const appConfig = cfg.angularBuildConfig.apps[0];
            return checkFileOrDirectoryExistsAsync(path.resolve(projectRoot, appConfig.root, 'polyfills.ts'))
                .then(exists => {
                    if (exists) {
                        return Promise.resolve(cfg);
                    } else {
                        return new Promise((resolve, reject) => {
                            fs.copy(require.resolve('../../configs/polyfills.ts'),
                                path.resolve(projectRoot, appConfig.root, 'polyfills.ts'),
                                err => {
                                    err ? reject(err) : resolve(cfg);
                                });
                        });
                    }
                }).then((cfg: any) => {
                    return checkFileOrDirectoryExistsAsync(path.resolve(projectRoot, appConfig.root, 'vendors.ts'))
                        .then(exists => {
                            if (exists) {
                                return Promise.resolve(cfg);
                            } else {
                                return new Promise((resolve, reject) => {
                                    fs.copy(require.resolve('../../configs/vendors.ts'),
                                        path.resolve(projectRoot, appConfig.root, 'vendors.ts'),
                                        err => {
                                            err ? reject(err) : resolve(cfg);
                                        });
                                });
                            }
                        });
                });
        })
        // 7. Create environments folder
        .then((cfg: InitConfig) => {
            const appConfig = cfg.angularBuildConfig.apps[0];
            const environmentsPath = path.resolve(projectRoot, appConfig.root, 'environments');
            return checkFileOrDirectoryExistsAsync(environmentsPath, true).then(exists => {
                if (exists) {
                    return Promise.resolve(cfg);
                } else {
                    return new Promise((resolve, reject) => {
                        fs.mkdir(environmentsPath, err => err ? reject(err) : resolve(cfg));
                    });
                }
            }
            );
        })
        // 8. Copy environment files
        .then((cfg: InitConfig) => {
            const appConfig = cfg.angularBuildConfig.apps[0];
            return checkFileOrDirectoryExistsAsync(path.resolve(projectRoot, appConfig.root, 'environments', 'environment.ts'))
                .then(exists => {
                    if (exists) {
                        return Promise.resolve(cfg);
                    } else {
                        return new Promise((resolve, reject) => {
                            fs.copy(require.resolve('../../configs/environment.ts'),
                                path.resolve(projectRoot, appConfig.root, 'environments', 'environment.ts'),
                                err => {
                                    err ? reject(err) : resolve(cfg);
                                });
                        });
                    }
                }).then(() => {
                    return checkFileOrDirectoryExistsAsync(path.resolve(projectRoot,
                        appConfig.root,
                        'environments',
                        'environment.prod.ts'))
                        .then(exists => {
                            if (exists) {
                                return Promise.resolve(cfg);
                            } else {
                                return new Promise((resolve, reject) => {
                                    fs.copy(require.resolve('../../configs/environment.prod.ts'),
                                        path.resolve(projectRoot, appConfig.root, 'environments', 'environment.prod.ts'),
                                        err => {
                                            err ? reject(err) : resolve(cfg);
                                        });
                                });
                            }
                        });
                });
        })
        // 9. Update package.json
        .then((cfg: InitConfig) => {
            const appConfig = cfg.angularBuildConfig.apps[0];
            const packageScripts = {
                "build:dll": 'cross-env NODE_ENV=development webpack --hide-modules --profile --colors --bail',
                "prebuilt:dll": 'npm run clean:dist ',
                "build:dev": 'cross-env NODE_ENV=development webpack --profile --colors --bail',
                "build:prod": 'cross-env NODE_ENV=production webpack --profile --colors --bail',
                "build": 'npm run build:dev',
                "clean:dist": `npm run rimraf -- ${appConfig.outDir}`
            };
            cfg.userPackageConfig.scripts = Object.assign({}, cfg.userPackageConfig.scripts || {}, packageScripts);
            return new Promise((resolve, reject) => {
                fs.writeFile(cfg.userPackageConfigFile,
                    JSON.stringify(cfg.userPackageConfig, null, 2),
                    err => err ? reject(err) : resolve(cfg));
            });
        })
        .then((cfg: InitConfig) => {
            if (cfg.cliOptions.commandOptions.linkCli && !cfg.cliOptions.cliIsLocal) {
                return spawnAsync('npm', ['link', '@bizappframework/angular-build', '--color', 'always', '--loglevel', 'error']);
            } else {
                return Promise.resolve(cfg);
            }
        });
}

// Helpers
//
function installToolings(cfg: InitConfig) {
    const projectRoot = cfg.cliOptions.cwd;

    const preReleasedPackageNames = [
        'extract-text-webpack-plugin',
        'webpack-dev-server',
        'webpack'
    ];
    const depPackagesToInstall: string[] = [];
    const depPackagesToInstallWithSave: string[] = [];
    const devDepPackagesToInstall: string[] = [];

    const depsSaveList = [
        'reflect-metadata', 'rxjs', 'zone.js', 'core-js', 'ts-helpers', 'tslib', '@angular/compiler', '@angular/core'
    ];
    //const devDepsSaveList = ['@angular/compiler-cli', '@ngtools/webpack', 'typescript', 'ts-node', '@types/node'];
    const angularDeps = [
        '@angular/common', '@angular/forms', '@angular/http', '@angular/platform-browser',
        '@angular/platform-browser-dynamic', '@angular/router'
    ];


    const depPackages = Object.keys(cfg.cliPackageJsonConfig.dependencies).map((key: string) => {
        const ver = cfg.cliPackageJsonConfig.dependencies[key];
        const isPreReleased = !(preReleasedPackageNames.indexOf(key) === -1);
        return {
            packageName: key,
            version: ver,
            isPreReleased: isPreReleased
        };
    });
    const depSavePackages = Object.keys(cfg.cliPackageJsonConfig.peerDependencies).filter((key: string) => depsSaveList.indexOf(key) > -1).map((key: string) => {
        const ver = cfg.cliPackageJsonConfig.peerDependencies[key];
        const isPreReleased = !(preReleasedPackageNames.indexOf(key) === -1);
        return {
            packageName: key,
            version: ver,
            isPreReleased: isPreReleased
        };
    });
    const devDepSavePackages = Object.keys(cfg.cliPackageJsonConfig.peerDependencies)
        .filter((key: string) => depsSaveList.indexOf(key) === -1).map((key: string) => {
            const ver = cfg.cliPackageJsonConfig.peerDependencies[key];
            const isPreReleased = !(preReleasedPackageNames.indexOf(key) === -1);
            return {
                packageName: key,
                version: ver,
                isPreReleased: isPreReleased
            };
        });

    return checkPackagesToInstall(depSavePackages, projectRoot)
        .then((packageNames: string[]) => depPackagesToInstallWithSave.push(...packageNames))
        .then(() => {
            if (cfg.cliOptions.cliIsLocal) {
                return Promise.resolve(null);
            }
            return checkPackagesToInstall(depPackages, projectRoot)
                .then((packageNames: string[]) => depPackagesToInstall.push(...packageNames));
        })
        .then(() => {
            return checkPackagesToInstall(devDepSavePackages, projectRoot)
                .then((packageNames: string[]) => devDepPackagesToInstall.push(...packageNames));
        }).then(() => {
            if (depPackagesToInstallWithSave.indexOf('@angular/core') > -1) {
                depPackagesToInstallWithSave.push(...angularDeps);
            }
            if (depPackagesToInstallWithSave.length || depPackagesToInstall.length || devDepPackagesToInstall.length) {
                console.log('Installing packages for tooling via npm...');
                return Promise.resolve(0).then(() => {
                    if (!depPackagesToInstallWithSave.length) {
                        return Promise.resolve(0);
                    }
                    return spawnAsync('npm',
                        ['install', '-S', '--color', 'always', '--loglevel', 'error']
                            .concat(depPackagesToInstallWithSave));
                })
                    .then(() => {
                        if (cfg.cliOptions.cliIsLocal || !depPackagesToInstall.length) {
                            return Promise.resolve(0);
                        }
                        return spawnAsync('npm',
                            ['install', '--color', 'always', '--loglevel', 'error'].concat(depPackagesToInstall));
                    }).then(() => {
                        if (!devDepPackagesToInstall.length) {
                            return Promise.resolve(0);
                        }
                        return spawnAsync('npm',
                            ['install', '-D', '--color', 'always', '--loglevel', 'error']
                                .concat(devDepPackagesToInstall)).then(() => {
                                    console.log('Packages were installed.');
                                    return 0;
                                });
                    });
            } else {
                return Promise.resolve(0);
            }
        });
}

function mergeConfigAsync(cfg: InitConfig) {
    return mergeConfigWithPossibleAsync(cfg)
        .then(() => mergeConfigWithAngularCliAsync(cfg))
        .then(() => mergeWithCommandOptions(cfg))
        .then(() => cfg.cliOptions.commandOptions && (cfg.cliOptions.commandOptions.prompt && !cfg.cliOptions.commandOptions.force) ? mergeConfigWithPrompt(cfg) : Promise.resolve(true));
}

function mergeConfigWithPossibleAsync(cfg: InitConfig) {

    const projectRoot = cfg.cliOptions.cwd;
    const appConfig = cfg.angularBuildConfig.apps[0];

    const possibleSrcDirs = ['client', 'Client', 'src'];
    const possibleOutDirs = ['wwwroot', 'dist'];
    const possibleMains = ['main.browser.ts', 'main.ts'];
    const possibleStyles = ['styles.scss', 'styles.sass', 'styles.less', 'styles.stylus', 'styles.css'];
    const possibleFavicons = ['logo.svg', 'logo.png', 'favicon.svg', 'favicon.png'];

    // root
    return findFileOrDirectoryFromPossibleAsync(projectRoot, possibleSrcDirs, appConfig.root, true)
        .then((foundRoot: string) => {
            appConfig.root = foundRoot || appConfig.root;

            // outDir
            return findFileOrDirectoryFromPossibleAsync(projectRoot, possibleOutDirs, appConfig.outDir, true)
                .then((foundOutDir: string) => {
                    appConfig.outDir = foundOutDir || appConfig.outDir;
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
                            if (appConfig.assets.indexOf(foundAsset) === -1 && appConfig.assets.indexOf('assets/**/*') === -1) {
                                appConfig.assets.push('assets/**/*');
                            }
                        } else {
                            if (!appConfig.styles) {
                                appConfig.assets = ['assets/**/*'];
                            }
                        }
                    }
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
                });
        })
        .then(() => {
            // favicon
            return findFileOrDirectoryFromPossibleAsync(path.resolve(projectRoot, appConfig.root),
                possibleFavicons,
                'logo.svg',
                false)
                .then((foundFavicon: string) => {
                    if (foundFavicon) {
                        cfg.faviconConfig = cfg.faviconConfig ||
                            {
                                masterPicture: foundFavicon
                            };
                        cfg.faviconConfig.masterPicture = foundFavicon;
                        appConfig.faviconConfig = appConfig.faviconConfig || 'favicon-config.json';
                    } else {
                        if (cfg.faviconConfig) {
                            cfg.faviconConfig.masterPicture = null;
                        }
                    }
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
                });
        })
        .then(() => {
            // asp.net
            return checkFileOrDirectoryExistsAsync(path.resolve(projectRoot, 'Views', 'Shared'), true)
                .then(exists => exists
                    ? checkFileOrDirectoryExistsAsync(path.resolve(projectRoot, 'wwwroot'), true)
                    : Promise.resolve(false))
                .then(aspNet => {
                    if (aspNet) {
                        appConfig.index = null;
                        appConfig.htmlInjectOptions = appConfig.htmlInjectOptions || {};
                        appConfig.htmlInjectOptions.indexOutFileName = '../Views/Shared/_BundledScripts.cshtml';
                        appConfig.htmlInjectOptions.iconsOutFileName = '../Views/Shared/_FavIcons.cshtml';
                        appConfig.htmlInjectOptions.stylesOutFileName = '../Views/Shared/_BundledStyles.cshtml';
                        appConfig.htmlInjectOptions
                            .customTagAttributes = [
                                { tagName: 'link', attribute: { "asp-append-version": true } },
                                { tagName: 'script', attribute: { "asp-append-version": true } }
                            ];

                    }
                });
        });
}

function mergeConfigWithAngularCliAsync(cfg: InitConfig) {
    const projectRoot = cfg.cliOptions.cwd;
    const appConfig = cfg.angularBuildConfig.apps[0] as any;
    const cliPath = path.resolve(projectRoot, 'angular-cli.json');

    return checkFileOrDirectoryExistsAsync(cliPath).then((exists: boolean) => {
        if (exists) {
            return readJsonAsync(cliPath).then((cliConfig: any) => {
                cliConfig = cliConfig || {};
                cliConfig.apps = cliConfig.apps || [];
                const cliAppConfig = cliConfig.apps[0] || {};
                if (cliAppConfig.root) {
                    cfg.angularCliConfigFileExists = true;
                    cfg.userAngularCliConfig = cliConfig;
                }


                Object.keys(cliAppConfig).filter((key: string) => typeof cliAppConfig[key] !== 'undefined' && cliAppConfig[key] !== null).forEach((key: string) => {
                    if (typeof cliAppConfig[key] === 'object') {
                        appConfig[key] = Object.assign({}, appConfig[key] || {}, cliAppConfig[key]);
                    } else {
                        appConfig[key] = cliAppConfig[key];
                    }
                });

            });
        } else {
            return Promise.resolve(null);
        }
    });
}

function mergeWithCommandOptions(cfg: InitConfig) {
    const commandOptions = cfg.cliOptions.commandOptions || {};
    const appConfig = cfg.angularBuildConfig.apps[0];

    if (commandOptions.useAngularCliConfigFile !== null && typeof commandOptions.useAngularCliConfigFile !== 'undefined') {
        cfg.useAngularCliConfigFile = commandOptions.useAngularCliConfigFile &&
            commandOptions.useAngularCliConfigFile !== 'no' &&
            commandOptions.useAngularCliConfigFile !== 'n';
    } else if (cfg.angularCliConfigFileExists) {
        cfg.useAngularCliConfigFile = true;
    }
    cfg.webpackConfigFileName = commandOptions.webpackConfigFileName || cfg.webpackConfigFileName;
    if (commandOptions.faviconMasterPicture) {
        cfg.faviconConfig = cfg.faviconConfig ||
            {
                masterPicture: commandOptions.faviconMasterPicture
            };
        cfg.faviconConfig.masterPicture = commandOptions.faviconMasterPicture;
        appConfig.faviconConfig = appConfig.faviconConfig || 'favicon-config.json';
    }
    cfg.overrideAngularBuildConfigFile = commandOptions.overrideAngularBuildConfigFile ||
        cfg.overrideAngularBuildConfigFile;
    cfg.overrideWebpackConfigFile = commandOptions.overrideWebpackConfigFile || cfg.overrideWebpackConfigFile;

    const appConfigSchema: any = angularBuildSchema.definitions.AppConfigBase.properties;

    Object.keys(commandOptions).forEach((key: string) => {
        if (typeof commandOptions[key] !== 'undefined' && key !== 'extends' && appConfigSchema[key]) {
            const obj = appConfig as any;
            if (appConfigSchema[key].type === 'string') {
                obj[key] = commandOptions[key].toString();
            }else if (appConfigSchema[key].type === 'boolean') {
                obj[key] = commandOptions[key].toString().toLowerCase() === 'true';
            } else {
                obj[key] = commandOptions[key];
            }
        }
    });
    return cfg;
}

function mergeConfigWithPrompt(cfg: InitConfig) {
    const projectRoot = cfg.cliOptions.cwd;
    const appConfig = cfg.angularBuildConfig.apps[0];

    return checkFileOrDirectoryExistsAsync(path.resolve(projectRoot, 'angular-build.json'))
        .then((exists: boolean) => {
            if (exists) {
                cfg.angularBuildConfigFileExists = true;
                if (cfg.useAngularCliConfigFile) {
                    return Promise.resolve(null);
                }
                if (cfg.overrideAngularBuildConfigFile) {
                    return Promise.resolve(null);
                }
                return askAsync(chalk.bgYellow('WARNING:') +
                    ` Override 'angular-build.json' yes/no (${cfg.overrideAngularBuildConfigFile ? 'yes' : 'no'})?: `)
                    .then((answer: string) => {
                        if (answer &&
                            answer.trim() &&
                            (answer.trim().toLowerCase() === 'yes' ||
                                answer.trim().toLowerCase() === 'y')) {
                            cfg.overrideAngularBuildConfigFile = true;
                        }
                    });
            } else {
                return Promise.resolve(null);
            }
        })
        .then(() => {
            if (cfg.angularCliConfigFileExists && !cfg.useAngularCliConfigFile && !cfg.overrideAngularBuildConfigFile) {
                return askAsync(`Use 'angular-cli.json' as a build config yes/no (${cfg.useAngularCliConfigFile ? 'yes' : 'no'})?: `)
                    .then((answer: string) => {
                        if (answer &&
                            answer.trim() &&
                            (answer.trim().toLowerCase() === 'yes' ||
                                answer.trim().toLowerCase() === 'y')) {
                            cfg.useAngularCliConfigFile = true;
                        }
                    });
            } else {
                return Promise.resolve(null);
            }
        })
        .then(() => {
            const possibleWebpackFiles = [
                'webpackfile.ts', 'webpackfile.babel.js', 'webpackfile.js', 'webpack.config.ts', 'webpack.config.babel.js',
                'webpack.config.js'
            ];
            if (cfg.webpackConfigFileName && possibleWebpackFiles.indexOf(cfg.webpackConfigFileName) === -1) {
                possibleWebpackFiles.unshift(cfg.webpackConfigFileName);
            }

            return findFileOrDirectoryFromPossibleAsync(projectRoot,
                possibleWebpackFiles,
                cfg.webpackConfigFileName || 'webpack.config.js').then((foundName: string) => {
                    if (foundName && (!cfg.webpackConfigFileName || foundName === cfg.webpackConfigFileName)) {
                        cfg.webpackConfigFileExists = true;
                        cfg.webpackConfigFileName = foundName;
                        if (cfg.overrideWebpackConfigFile) {
                            return Promise.resolve(null);
                        }
                        return askAsync(chalk.bgYellow('WARNING:') +
                            ` Override '${foundName}' yes/no (${cfg.overrideWebpackConfigFile ? 'yes' : 'no'})?: `)
                            .then((answer: string) => {
                                if (answer &&
                                    answer.trim() &&
                                    (answer.trim().toLowerCase() === 'yes' ||
                                        answer.trim().toLowerCase() === 'y')) {
                                    cfg.overrideWebpackConfigFile = true;
                                }
                            });
                    } else {
                        return Promise.resolve(null);
                    }
                });
        })
        .then(() => {
            if (cfg.cliOptions.commandOptions.root) {
                return Promise.resolve(null);
            }
            return askAsync(`Enter client app root folder (${appConfig.root}): `)
                .then((answer: string) => {
                    if (answer && answer.trim()) {
                        appConfig.root = answer.trim();
                    }
                });
        })
        .then(() => {
            if (cfg.cliOptions.commandOptions.outDir) {
                return Promise.resolve(null);
            }
            return askAsync(`Enter build output folder (${appConfig.outDir}): `)
                .then((answer: string) => {
                    if (answer && answer.trim()) {
                        appConfig.outDir = answer.trim();
                    }
                });
        })
        .then(() => {
            if (cfg.cliOptions.commandOptions.publicPath) {
                return Promise.resolve(null);
            }
            return askAsync(`Enter public path (${appConfig.publicPath}): `)
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
            if (cfg.cliOptions.commandOptions.main) {
                return Promise.resolve(null);
            }
            return askAsync(`Enter app bootstrap main file (${appConfig.main || ''}): `)
                .then((answer: string) => {
                    if (answer && answer.trim()) {
                        appConfig.main = answer.trim();
                    }
                });
        })
        .then(() => {
            if (cfg.cliOptions.commandOptions.styles && cfg.cliOptions.commandOptions.styles.length && Array.isArray(cfg.cliOptions.commandOptions.styles)) {
                return Promise.resolve(null);
            }
            return askAsync(`Enter global css/scss/less/stylus style files (${appConfig.styles ? Array.isArray(appConfig.styles) ? appConfig.styles.join(', ') : appConfig.styles : ''}): `)
                .then((answer: string) => {
                    if (answer && answer.trim().length) {
                        answer = answer.trim();
                        const answerArray = answer.split(',');
                        answerArray.forEach(style => {
                            style = style.trim();
                            if (Array.isArray(appConfig.styles)) {
                                if (appConfig.styles.indexOf(style) === -1) {
                                    appConfig.styles.push(style);
                                }
                            } else if (typeof (appConfig.styles as any) === 'string' && (appConfig.styles as any) !== style){
                                appConfig.styles = [style];
                            }

                        });
                    }
                });
        })
        .then(() => {
            if (cfg.cliOptions.commandOptions.faviconMasterPicture) {
                return Promise.resolve(null);
            }
            return askAsync(`Enter favicon master logo file (${cfg.faviconConfig.masterPicture
                ? cfg.faviconConfig.masterPicture
                : ''}): `)
                .then((answer: string) => {
                    if (answer && answer.trim()) {
                        answer = answer.trim();
                        cfg.faviconConfig = cfg.faviconConfig ||
                            {
                                masterPicture: answer
                            };
                        cfg.faviconConfig.masterPicture = answer;
                        appConfig.faviconConfig = appConfig.faviconConfig || 'favicon-config.json';
                    }
                });
        })
        .then(() => {
            if (cfg.cliOptions.commandOptions.overrideWebpackConfigFile || cfg.cliOptions.commandOptions.webpackConfigFileExists) {
                return Promise.resolve(null);
            }
            return askAsync(`Enter webpack config file name (${cfg.webpackConfigFileName || 'webpack.config.js'}): `)
                .then((answer: string) => {
                    if (answer && answer.trim()) {
                        cfg.webpackConfigFileName = answer.trim();
                    }
                });
        });

}

function checkPackagesToInstall(packagesToCheck: PackageToCheck[], projectRoot: string) {
    const tasks = packagesToCheck.map((pkgToCheck: PackageToCheck) => {
        return new Promise(res => {
            resolve(pkgToCheck.packageName, { basedir: projectRoot }, (error, resolvedPath) => {
                if (error) {
                    res(pkgToCheck);
                } else {
                    pkgToCheck.resolvedPath = resolvedPath;
                    res(pkgToCheck);
                }
            });
        }).then((packageObj: any) => {
            if (packageObj.resolvedPath && packageObj.version) {

                const versionRange = semver.validRange(packageObj.version);
                return getVersionfromPackageJsonAsync(path.resolve(projectRoot, 'node_modules', packageObj.packageName)).then((localVer: string) => {
                    if (localVer && semver.satisfies(localVer, versionRange)) {
                        return null;
                    }
                    if (packageObj.isPreReleased) {
                        return Promise.resolve(packageObj.packageName + '@' + packageObj.version);
                    } else {
                        return Promise.resolve(packageObj.packageName);
                    }
                });
            } else {
                if (packageObj.isPreReleased) {
                    return Promise.resolve(packageObj.packageName + '@' + packageObj.version);
                } else {
                    return Promise.resolve(packageObj.packageName);
                }
            }
        });
    });

    return Promise.all(tasks).then(packages => packages.filter(p => p !== null));
}