"use strict";
const path = require("path");
const fs = require("fs-extra");
const resolve = require("resolve");
const semver = require("semver");
const chalk = require("chalk");
const utils_1 = require("../utils");
const cliVersion = require('../../package.json').version;
const initCommandUsage = `\n${chalk.green(`angular-build ${cliVersion}`)}\n
Usage:
  ngb init [options...]`;
exports.initCommandModule = {
    command: 'init',
    describe: 'Create angular-build config files',
    builder: (yargv) => {
        return yargv
            .reset()
            .usage(initCommandUsage)
            .example('ngb init --prompt', 'Create angular-build config files with user prompt option')
            .help('h')
            .option('p', {
            alias: 'prompt',
            describe: 'Confirm user by prompting',
            type: 'boolean'
        })
            .option('f', {
            alias: 'force',
            describe: 'it will use only defaults and not prompt you for any options',
            type: 'boolean'
        })
            .option('link-cli', {
            alias: ['l', 'linkCli'],
            describe: 'Link angular-build cli to current project',
            type: 'boolean'
        })
            .option('skip-install-tooling', {
            describe: 'Skip install tooling',
            type: 'boolean'
        })
            .option('use-angular-cli-config-file', {
            describe: 'Use angular-cli.json as a build config file'
        })
            .option('webpack-config-file-name', {
            describe: 'Webpack config file name',
            type: 'string'
        })
            .option('favicon-naster-picture', {
            describe: 'favicon master picture file name',
            type: 'string'
        })
            .option('override-angular-build-config-file', {
            describe: 'Override angular-build.json file',
            type: 'boolean',
            default: false
        })
            .option('override-webpack-config-file', {
            describe: 'Override webpack config file',
            type: 'boolean',
            default: false
        })
            .option('root', {
            describe: 'Client app root directory',
            type: 'string'
        })
            .option('out-dir', {
            describe: 'Build/bundle output directory',
            type: 'string'
        })
            .option('public-path', {
            describe: 'Public Url address of the output files',
            type: 'string'
        })
            .option('main', {
            describe: 'App main bootstrap file',
            type: 'string'
        })
            .option('tsconfig', {
            describe: 'Typescript configuration file',
            type: 'string'
        })
            .option('assets', {
            describe: 'Assets to be copied to output directory',
            type: 'array'
        })
            .option('styles', {
            describe: 'Global styles (.css/.scss/.less/.stylus) to be bundled',
            type: 'array'
        })
            .option('scripts', {
            describe: 'Script files to be added to the global scope',
            type: 'array'
        })
            .option('provide', {
            describe: 'To automatically load module with alias key'
        })
            .option('index', {
            describe: 'Html index source template file',
            type: 'string'
        })
            .option('index-out-file-name', {
            describe: 'The file to write the Html to',
            type: 'string'
        })
            .option('favicon-config', {
            describe: 'Favicon configuration file',
            type: 'string'
        })
            .option('html-inject-options', {
            describe: 'Html injection options'
        })
            .option('reference-dlls-on-development', {
            describe: 'Generate dll bundles for development builds',
            type: 'boolean'
        })
            .option('reference-dlls-on-production', {
            describe: 'Generate dll bundles for production builds',
            type: 'boolean'
        })
            .option('try-bundle-dlls', {
            describe: 'To automatically bundle dlls',
            type: 'boolean'
        })
            .option('dlls', {
            describe: 'The entries for dll bundle',
            type: 'array'
        })
            .option('environments', {
            describe: 'TheEnvironment files to be used with build args (--environment=dev or --environment=prod)'
        });
    },
    handler: null
};
;
// Command
//
function init(cliOptions) {
    return utils_1.checkFileOrDirectoryExistsAsync(path.resolve(cliOptions.cwd, 'angular-build.json')).then(exists => {
        if (exists && (!cliOptions.commandOptions || !(cliOptions.commandOptions.prompt || cliOptions.commandOptions.force || cliOptions.commandOptions.linkCli))) {
            return Promise.resolve(0);
        }
        else {
            return initCore(cliOptions);
        }
    });
}
exports.init = init;
function initCore(cliOptions) {
    const projectRoot = cliOptions.cwd;
    return utils_1.checkFileOrDirectoryExistsAsync(path.resolve(projectRoot, 'package.json'))
        .then((exists) => {
        const cfg = {
            cliOptions: cliOptions
        };
        if (exists) {
            cfg.userPackageConfigFileExists = true;
            cfg.userPackageConfigFile = path.resolve(projectRoot, 'package.json');
            return Promise.resolve(cfg);
        }
        else {
            if (cliOptions.commandOptions.force) {
                return utils_1.spawnAsync('npm', ['init', '-f', '--color', 'always', '--loglevel', 'error']).then(() => {
                    cfg.userPackageConfigFileExists = true;
                    cfg.userPackageConfigFile = path.resolve(projectRoot, 'package.json');
                    return cfg;
                });
            }
            else {
                const msg = `'package.json' file doesn't exist.\nPlease run ${chalk
                    .cyan('npm init')} command to init 'package.json' file or run ${chalk.cyan('ngb init -f')} to force create 'package.json' file.`;
                return Promise.reject(msg);
            }
        }
    })
        .then((cfg) => {
        return utils_1.readJsonAsync(require.resolve('../../package.json')).then(cliPkgConfig => {
            cfg.cliPackageJsonConfig = cliPkgConfig;
            return cfg;
        });
    })
        .then((cfg) => {
        if (cfg.cliOptions.commandOptions.skipInstallTooling) {
            return Promise.resolve(cfg);
        }
        return installToolings(cfg).then(() => cfg);
    })
        .then((cfg) => {
        return utils_1.readJsonAsync(require.resolve('../../templates/angular-build.json')).then(angularBuildConfig => {
            cfg.angularBuildConfig = angularBuildConfig;
            return cfg;
        });
    })
        .then((cfg) => {
        return utils_1.readJsonAsync(require.resolve('../../templates/tsconfig.json')).then((tsConfig) => {
            cfg.tsConfig = tsConfig;
            return cfg;
        });
    })
        .then((cfg) => {
        return utils_1.readJsonAsync(require.resolve('../../templates/favicon-config.json')).then((faviconConfig) => {
            cfg.faviconConfig = faviconConfig;
            return cfg;
        });
    })
        .then((cfg) => {
        return utils_1.readJsonAsync(cfg.userPackageConfigFile).then((userPackageConfig) => {
            cfg.userPackageConfig = userPackageConfig;
            return cfg;
        });
    })
        .then((cfg) => mergeConfigAsync(cfg).then(() => cfg))
        .then((cfg) => {
        if (cfg.useAngularCliConfigFile) {
            if (cfg.angularCliConfigFileExists && cfg.userAngularCliConfig) {
                cfg.userAngularCliConfig.apps[0] = Object.assign(cfg.userAngularCliConfig.apps[0], cfg.angularBuildConfig.apps[0]);
                return new Promise((resolve, reject) => {
                    fs.writeFile(path.resolve(projectRoot, 'angular-cli.json'), JSON.stringify(cfg.userAngularCliConfig, null, 2), err => err ? reject(err) : resolve(cfg));
                });
            }
            else {
                return new Promise((resolve, reject) => {
                    fs.writeFile(path.resolve(projectRoot, 'angular-cli.json'), JSON.stringify(cfg.angularBuildConfig, null, 2), err => err ? reject(err) : resolve(cfg));
                });
            }
        }
        else {
            if (cfg.angularBuildConfigFileExists && !cfg.overrideAngularBuildConfigFile) {
                return Promise.resolve(cfg);
            }
            else {
                return new Promise((resolve, reject) => {
                    fs.writeFile(path.resolve(projectRoot, 'angular-build.json'), JSON.stringify(cfg.angularBuildConfig, null, 2), err => err ? reject(err) : resolve(cfg));
                });
            }
        }
    })
        .then((cfg) => {
        if (cfg.webpackConfigFileExists && !cfg.overrideWebpackConfigFile) {
            return Promise.resolve(cfg);
        }
        else {
            return new Promise((resolve, reject) => {
                if (cfg.webpackConfigFileName && cfg.webpackConfigFileName.match(/\.ts$/i)) {
                    fs.copy(require.resolve('../../templates/webpack.config.ts'), path.resolve(projectRoot, cfg.webpackConfigFileName), err => {
                        err ? reject(err) : resolve(cfg);
                    });
                }
                else {
                    fs.copy(require.resolve('../../templates/webpack.config.js'), path.resolve(projectRoot, cfg.webpackConfigFileName || 'webpack.config.js'), err => {
                        err ? reject(err) : resolve(cfg);
                    });
                }
            });
        }
    })
        .then((cfg) => {
        const appConfig = cfg.angularBuildConfig.apps[0];
        const srcPath = path.resolve(projectRoot, appConfig.root);
        return utils_1.checkFileOrDirectoryExistsAsync(srcPath, true).then(exists => {
            if (exists) {
                return Promise.resolve(cfg);
            }
            else {
                return new Promise((resolve, reject) => {
                    fs.mkdir(srcPath, err => err ? reject(err) : resolve(cfg));
                });
            }
        });
    })
        .then((cfg) => {
        const appConfig = cfg.angularBuildConfig.apps[0];
        const tsConfigPath = path.resolve(projectRoot, appConfig.root, appConfig.tsconfig);
        const tsConfig = cfg.tsConfig;
        tsConfig.compilerOptions.outDir = `../${appConfig.outDir}/out-tsc`;
        return utils_1.checkFileOrDirectoryExistsAsync(tsConfigPath).then(exists => {
            if (exists) {
                return Promise.resolve(cfg);
            }
            else {
                return new Promise((resolve, reject) => {
                    fs.writeFile(tsConfigPath, JSON.stringify(tsConfig, null, 2), err => err ? reject(err) : resolve(cfg));
                });
            }
        });
    })
        .then((cfg) => {
        const appConfig = cfg.angularBuildConfig.apps[0];
        const faviconConfig = cfg.faviconConfig;
        const faviconConfigPath = path
            .resolve(projectRoot, appConfig.root, appConfig.faviconConfig || 'favicon-config.json');
        return new Promise((resolve, reject) => {
            fs.writeFile(faviconConfigPath, JSON.stringify(faviconConfig, null, 2), err => err ? reject(err) : resolve(cfg));
        });
    })
        .then((cfg) => {
        const appConfig = cfg.angularBuildConfig.apps[0];
        return utils_1.checkFileOrDirectoryExistsAsync(path.resolve(projectRoot, appConfig.root, 'polyfills.ts'))
            .then(exists => {
            if (exists) {
                return Promise.resolve(cfg);
            }
            else {
                return new Promise((resolve, reject) => {
                    fs.copy(require.resolve('../../templates/polyfills.ts'), path.resolve(projectRoot, appConfig.root, 'polyfills.ts'), err => {
                        err ? reject(err) : resolve(cfg);
                    });
                });
            }
        }).then((cfg) => {
            return utils_1.checkFileOrDirectoryExistsAsync(path.resolve(projectRoot, appConfig.root, 'vendors.ts'))
                .then(exists => {
                if (exists) {
                    return Promise.resolve(cfg);
                }
                else {
                    return new Promise((resolve, reject) => {
                        fs.copy(require.resolve('../../templates/vendors.ts'), path.resolve(projectRoot, appConfig.root, 'vendors.ts'), err => {
                            err ? reject(err) : resolve(cfg);
                        });
                    });
                }
            });
        });
    })
        .then((cfg) => {
        const appConfig = cfg.angularBuildConfig.apps[0];
        const environmentsPath = path.resolve(projectRoot, appConfig.root, 'environments');
        return utils_1.checkFileOrDirectoryExistsAsync(environmentsPath, true).then(exists => {
            if (exists) {
                return Promise.resolve(cfg);
            }
            else {
                return new Promise((resolve, reject) => {
                    fs.mkdir(environmentsPath, err => err ? reject(err) : resolve(cfg));
                });
            }
        });
    })
        .then((cfg) => {
        const appConfig = cfg.angularBuildConfig.apps[0];
        return utils_1.checkFileOrDirectoryExistsAsync(path.resolve(projectRoot, appConfig.root, 'environments', 'environment.ts'))
            .then(exists => {
            if (exists) {
                return Promise.resolve(cfg);
            }
            else {
                return new Promise((resolve, reject) => {
                    fs.copy(require.resolve('../../templates/environment.ts'), path.resolve(projectRoot, appConfig.root, 'environments', 'environment.ts'), err => {
                        err ? reject(err) : resolve(cfg);
                    });
                });
            }
        }).then(() => {
            return utils_1.checkFileOrDirectoryExistsAsync(path.resolve(projectRoot, appConfig.root, 'environments', 'environment.prod.ts'))
                .then(exists => {
                if (exists) {
                    return Promise.resolve(cfg);
                }
                else {
                    return new Promise((resolve, reject) => {
                        fs.copy(require.resolve('../../templates/environment.prod.ts'), path.resolve(projectRoot, appConfig.root, 'environments', 'environment.prod.ts'), err => {
                            err ? reject(err) : resolve(cfg);
                        });
                    });
                }
            });
        });
    })
        .then((cfg) => {
        const appConfig = cfg.angularBuildConfig.apps[0];
        const packageScripts = {
            "build:dll": 'cross-env NODE_ENV=development webpack --profile --colors --bail',
            "prebuilt:dll": 'npm run clean:dist ',
            "build:dev": 'cross-env NODE_ENV=development webpack --profile --colors --bail',
            "build:prod": 'cross-env NODE_ENV=production webpack --profile --colors --bail',
            "build": 'npm run build:dev',
            "clean:dist": `npm run rimraf -- ${appConfig.outDir}`
        };
        cfg.userPackageConfig.scripts = Object.assign({}, cfg.userPackageConfig.scripts || {}, packageScripts);
        return new Promise((resolve, reject) => {
            fs.writeFile(cfg.userPackageConfigFile, JSON.stringify(cfg.userPackageConfig, null, 2), err => err ? reject(err) : resolve(cfg));
        });
    })
        .then((cfg) => {
        if (cfg.cliOptions.commandOptions.linkCli && !cfg.cliOptions.cliIsLocal) {
            return utils_1.spawnAsync('npm', ['link', '@bizappframework/angular-build', '--color', 'always', '--loglevel', 'error']);
        }
        else {
            return Promise.resolve(cfg);
        }
    });
}
// Helpers
//
function installToolings(cfg) {
    const projectRoot = cfg.cliOptions.cwd;
    const preReleasedPackageNames = [
        'extract-text-webpack-plugin',
        'webpack-dev-server',
        'webpack'
    ];
    const depPackagesToInstall = [];
    const depPackagesToInstallWithSave = [];
    const devDepPackagesToInstall = [];
    const depsSaveList = [
        'reflect-metadata', 'rxjs', 'zone.js', 'core-js', 'ts-helpers', 'tslib', '@angular/compiler', '@angular/core'
    ];
    const devDepsSaveList = ['@angular/compiler-cli', '@ngtools/webpack', 'typescript', 'ts-node'];
    const angularDeps = [
        '@angular/common', '@angular/forms', '@angular/http', '@angular/platform-browser',
        '@angular/platform-browser-dynamic', '@angular/router'
    ];
    const depPackages = Object.keys(cfg.cliPackageJsonConfig.dependencies).map((key) => {
        const ver = cfg.cliPackageJsonConfig.dependencies[key];
        const isPreReleased = !(preReleasedPackageNames.indexOf(key) === -1);
        return {
            packageName: key,
            version: ver,
            isPreReleased: isPreReleased
        };
    });
    const depSavePackages = depsSaveList.map(key => {
        const ver = cfg.cliPackageJsonConfig.peerDependencies[key];
        const isPreReleased = !(preReleasedPackageNames.indexOf(key) === -1);
        return {
            packageName: key,
            version: ver,
            isPreReleased: isPreReleased
        };
    });
    const devDepSavePackages = devDepsSaveList.map(key => {
        const ver = cfg.cliPackageJsonConfig.peerDependencies[key];
        const isPreReleased = !(preReleasedPackageNames.indexOf(key) === -1);
        return {
            packageName: key,
            version: ver,
            isPreReleased: isPreReleased
        };
    });
    return checkPackagesToInstall(depSavePackages, projectRoot)
        .then((packageNames) => depPackagesToInstallWithSave.push(...packageNames))
        .then(() => {
        if (cfg.cliOptions.cliIsLocal) {
            return Promise.resolve(null);
        }
        return checkPackagesToInstall(depPackages, projectRoot)
            .then((packageNames) => depPackagesToInstall.push(...packageNames));
    })
        .then(() => {
        return checkPackagesToInstall(devDepSavePackages, projectRoot)
            .then((packageNames) => devDepPackagesToInstall.push(...packageNames));
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
                return utils_1.spawnAsync('npm', ['install', '-S', '--color', 'always', '--loglevel', 'error']
                    .concat(depPackagesToInstallWithSave));
            })
                .then(() => {
                if (cfg.cliOptions.cliIsLocal || !depPackagesToInstall.length) {
                    return Promise.resolve(0);
                }
                return utils_1.spawnAsync('npm', ['install', '--color', 'always', '--loglevel', 'error'].concat(depPackagesToInstall));
            }).then(() => {
                if (!devDepPackagesToInstall.length) {
                    return Promise.resolve(0);
                }
                return utils_1.spawnAsync('npm', ['install', '-D', '--color', 'always', '--loglevel', 'error']
                    .concat(devDepPackagesToInstall)).then(() => {
                    console.log('Packages were installed.');
                    return 0;
                });
            });
        }
        else {
            return Promise.resolve(0);
        }
    });
}
function mergeConfigAsync(cfg) {
    return mergeConfigWithPossibleAsync(cfg)
        .then(() => mergeConfigWithAngularCliAsync(cfg))
        .then(() => mergeWithOptions(cfg))
        .then(() => cfg.cliOptions.commandOptions && (cfg.cliOptions.commandOptions.prompt && !cfg.cliOptions.commandOptions.force) ? mergeConfigWithPrompt(cfg) : Promise.resolve(true));
}
function mergeConfigWithPossibleAsync(cfg) {
    const projectRoot = cfg.cliOptions.cwd;
    const appConfig = cfg.angularBuildConfig.apps[0];
    const possibleSrcDirs = ['client', 'Client', 'src'];
    const possibleOutDirs = ['wwwroot', 'dist'];
    const possibleMains = ['main.browser.ts', 'main.ts'];
    const possibleStyles = ['styles.scss', 'styles.sass', 'styles.less', 'styles.stylus', 'styles.css'];
    const possibleFavicons = ['logo.svg', 'logo.png', 'favicon.svg', 'favicon.png'];
    // root
    return utils_1.findFileOrDirectoryFromPossibleAsync(projectRoot, possibleSrcDirs, appConfig.root, true)
        .then((foundRoot) => {
        appConfig.root = foundRoot || appConfig.root;
        // outDir
        return utils_1.findFileOrDirectoryFromPossibleAsync(projectRoot, possibleOutDirs, appConfig.outDir, true)
            .then((foundOutDir) => {
            appConfig.outDir = foundOutDir || appConfig.outDir;
        });
    })
        .then(() => {
        // main
        return utils_1.findFileOrDirectoryFromPossibleAsync(path.resolve(projectRoot, appConfig.root), possibleMains, appConfig.main, false)
            .then((foundMain) => {
            appConfig.main = foundMain || appConfig.main;
        });
    })
        .then(() => {
        // styles
        return utils_1.findFileOrDirectoryFromPossibleAsync(path.resolve(projectRoot, appConfig.root), possibleStyles, 'styles.scss', false)
            .then((foundStyle) => {
            if (foundStyle && appConfig.styles.indexOf(foundStyle) === -1) {
                appConfig.styles.push(foundStyle);
            }
        });
    })
        .then(() => {
        // asset folder
        return utils_1.findFileOrDirectoryFromPossibleAsync(path.resolve(projectRoot, appConfig.root), ['assets'], 'asset', true)
            .then((foundAsset) => {
            if (foundAsset && appConfig.assets.indexOf(foundAsset) === -1) {
                appConfig.assets.push('assets/**/*');
            }
        });
    })
        .then(() => {
        // robots.txt
        return utils_1.findFileOrDirectoryFromPossibleAsync(path.resolve(projectRoot, appConfig.root), ['robots.txt'], 'robots.txt', false)
            .then(foundAsset => {
            if (foundAsset && appConfig.assets.indexOf(foundAsset) === -1) {
                appConfig.assets.push(foundAsset);
            }
        });
    })
        .then(() => {
        // humans.txt
        return utils_1.findFileOrDirectoryFromPossibleAsync(path.resolve(projectRoot, appConfig.root), ['humans.txt'], 'humans.txt', false)
            .then(foundAsset => {
            if (foundAsset && appConfig.assets.indexOf(foundAsset) === -1) {
                appConfig.assets.push(foundAsset);
            }
        });
    })
        .then(() => {
        // favicon
        return utils_1.findFileOrDirectoryFromPossibleAsync(path.resolve(projectRoot, appConfig.root), possibleFavicons, 'logo.svg', false)
            .then((foundFavicon) => {
            if (foundFavicon) {
                cfg.faviconConfig = cfg.faviconConfig ||
                    {
                        masterPicture: foundFavicon
                    };
                cfg.faviconConfig.masterPicture = foundFavicon;
                appConfig.faviconConfig = appConfig.faviconConfig || 'favicon-config.json';
            }
            else {
                if (cfg.faviconConfig) {
                    cfg.faviconConfig.masterPicture = null;
                }
            }
        });
    })
        .then(() => {
        // index
        return utils_1.findFileOrDirectoryFromPossibleAsync(path.resolve(projectRoot, appConfig.root), ['index.html'], 'index.html', false)
            .then((foundIndex) => {
            if (foundIndex) {
                appConfig.index = foundIndex;
            }
        });
    })
        .then(() => {
        // asp.net
        return utils_1.checkFileOrDirectoryExistsAsync(path.resolve(projectRoot, 'Views', 'Shared'), true)
            .then(exists => exists
            ? utils_1.checkFileOrDirectoryExistsAsync(path.resolve(projectRoot, 'wwwroot'), true)
            : Promise.resolve(false))
            .then(aspNet => {
            if (aspNet) {
                appConfig.index = null;
                appConfig.indexOutFileName = '../Views/Shared/_BundledScripts.cshtml';
                appConfig.htmlInjectOptions.iconsInjectOutFileName = '../Views/Shared/_FavIcons.cshtml';
                appConfig.htmlInjectOptions.stylesInjectOutFileName = '../Views/Shared/_BundledStyles.cshtml';
                appConfig.htmlInjectOptions.customScriptAttributes = { "asp-append-version": true };
                appConfig.htmlInjectOptions.customLinkAttributes = { "asp-append-version": true };
            }
        });
    });
}
function mergeConfigWithAngularCliAsync(cfg) {
    const projectRoot = cfg.cliOptions.cwd;
    const appConfig = cfg.angularBuildConfig.apps[0];
    const cliPath = path.resolve(projectRoot, 'angular-cli.json');
    return utils_1.checkFileOrDirectoryExistsAsync(cliPath).then((exists) => {
        if (exists) {
            return utils_1.readJsonAsync(cliPath).then((cliConfig) => {
                cliConfig = cliConfig || {};
                cliConfig.apps = cliConfig.apps || [];
                const cliAppConfig = cliConfig.apps[0] || {};
                if (cliAppConfig.root) {
                    cfg.angularCliConfigFileExists = true;
                    cfg.userAngularCliConfig = cliConfig;
                }
                appConfig.root = cliAppConfig.root || appConfig.root;
                appConfig.outDir = cliAppConfig.outDir || appConfig.outDir;
                appConfig.main = cliAppConfig.main || appConfig.main;
                appConfig.test = cliAppConfig.test || appConfig.test;
                appConfig.tsconfig = cliAppConfig.tsconfig || appConfig.tsconfig;
                appConfig.index = cliAppConfig.index || appConfig.index;
                if (cliAppConfig.assets && cliAppConfig.assets.length) {
                    appConfig.assets = cliAppConfig.assets;
                }
                if (cliAppConfig.scripts && cliAppConfig.scripts.length) {
                    appConfig.scripts = cliAppConfig.scripts;
                }
                if (cliAppConfig.styles && cliAppConfig.styles.length) {
                    appConfig.styles = cliAppConfig.styles;
                }
                if (cliAppConfig.environments && Object.keys(cliAppConfig.environments).length) {
                    appConfig.environments = cliAppConfig.environments;
                }
            });
        }
        else {
            return Promise.resolve(null);
        }
    });
}
function mergeWithOptions(cfg) {
    const commandOptions = cfg.cliOptions.commandOptions || {};
    const appConfig = cfg.angularBuildConfig.apps[0];
    if (typeof commandOptions.useAngularCliConfigFile !== undefined) {
        cfg.useAngularCliConfigFile = commandOptions.useAngularCliConfigFile &&
            commandOptions.useAngularCliConfigFile !== 'no' &&
            commandOptions.useAngularCliConfigFile !== 'n';
    }
    else if (cfg.angularCliConfigFileExists) {
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
    appConfig.root = commandOptions.root || appConfig.root;
    appConfig.outDir = commandOptions.outDir || appConfig.outDir;
    appConfig.publicPath = commandOptions.publicPath || appConfig.publicPath;
    appConfig.main = commandOptions.main || appConfig.main;
    appConfig.test = commandOptions.test || appConfig.test;
    appConfig.tsconfig = commandOptions.tsconfig || appConfig.tsconfig;
    appConfig.index = commandOptions.index || appConfig.index;
    appConfig.indexOutFileName = commandOptions.indexOutFileName || appConfig.indexOutFileName;
    appConfig.faviconConfig = commandOptions.faviconConfig || appConfig.faviconConfig;
    if (typeof commandOptions.referenceDllOnDevelopment !== 'undefined') {
        // ReSharper disable once CoercedEqualsUsing
        appConfig.referenceDllsOnDevelopment = commandOptions.referenceDllOnDevelopment == true;
    }
    if (typeof commandOptions.referenceDllOnProduction !== 'undefined') {
        // ReSharper disable once CoercedEqualsUsing
        appConfig.referenceDllsOnProduction = commandOptions.referenceDllOnProduction == true;
    }
    if (typeof commandOptions.tryBundleDlls !== 'undefined') {
        // ReSharper disable once CoercedEqualsUsing
        appConfig.tryBundleDlls = commandOptions.tryBundleDlls == true;
    }
    if (commandOptions.dlls && commandOptions.dlls.length && Array.isArray(commandOptions.dlls)) {
        appConfig.dlls = commandOptions.dlls;
    }
    if (commandOptions.styles && commandOptions.styles.length && Array.isArray(commandOptions.styles)) {
        commandOptions.styles.forEach((style) => {
            style = style.trim();
            if (appConfig.styles.indexOf(style) === -1) {
                appConfig.styles.push(style);
            }
        });
    }
    if (commandOptions.scripts && commandOptions.scripts.length && Array.isArray(commandOptions.scripts)) {
        commandOptions.scripts.forEach((script) => {
            script = script.trim();
            if (appConfig.scripts.indexOf(script) === -1) {
                appConfig.scripts.push(script);
            }
        });
    }
    if (commandOptions.assets && commandOptions.assets.length && Array.isArray(commandOptions.assets)) {
        commandOptions.assets.forEach((asset) => {
            asset = asset.trim();
            if (appConfig.assets.indexOf(asset) === -1) {
                appConfig.assets.push(asset);
            }
        });
    }
    if (commandOptions.provide && typeof commandOptions.provide === 'object') {
        appConfig.provide = commandOptions.provide;
    }
    if (commandOptions.htmlInjectOptions && typeof commandOptions.htmlInjectOptions === 'object') {
        appConfig.htmlInjectOptions = Object.assign({}, appConfig.htmlInjectOptions, commandOptions.htmlInjectOptions);
    }
    if (commandOptions.environments && typeof commandOptions.environments === 'object') {
        appConfig.environments = Object.assign({}, appConfig.environments, commandOptions.environments);
    }
    return cfg;
}
function mergeConfigWithPrompt(cfg) {
    const projectRoot = cfg.cliOptions.cwd;
    const appConfig = cfg.angularBuildConfig.apps[0];
    return utils_1.checkFileOrDirectoryExistsAsync(path.resolve(projectRoot, 'angular-build.json'))
        .then((exists) => {
        if (exists) {
            cfg.angularBuildConfigFileExists = true;
            if (cfg.useAngularCliConfigFile) {
                return Promise.resolve(null);
            }
            if (cfg.overrideAngularBuildConfigFile) {
                return Promise.resolve(null);
            }
            return utils_1.askAsync(chalk.bgYellow('WARNING:') +
                ` Override 'angular-build.json' yes/no (${cfg.overrideAngularBuildConfigFile ? 'yes' : 'no'})?: `)
                .then((answer) => {
                if (answer &&
                    answer.trim() &&
                    (answer.trim().toLowerCase() === 'yes' ||
                        answer.trim().toLowerCase() === 'y')) {
                    cfg.overrideAngularBuildConfigFile = true;
                }
            });
        }
        else {
            return Promise.resolve(null);
        }
    })
        .then(() => {
        if (cfg.angularCliConfigFileExists && !cfg.useAngularCliConfigFile && !cfg.overrideAngularBuildConfigFile) {
            return utils_1.askAsync(`Use 'angular-cli.json' as a build config yes/no (${cfg.useAngularCliConfigFile ? 'yes' : 'no'})?: `)
                .then((answer) => {
                if (answer &&
                    answer.trim() &&
                    (answer.trim().toLowerCase() === 'yes' ||
                        answer.trim().toLowerCase() === 'y')) {
                    cfg.useAngularCliConfigFile = true;
                }
            });
        }
        else {
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
        return utils_1.findFileOrDirectoryFromPossibleAsync(projectRoot, possibleWebpackFiles, cfg.webpackConfigFileName || 'webpack.config.js').then((foundName) => {
            if (foundName && (!cfg.webpackConfigFileName || foundName === cfg.webpackConfigFileName)) {
                cfg.webpackConfigFileExists = true;
                cfg.webpackConfigFileName = foundName;
                if (cfg.overrideWebpackConfigFile) {
                    return Promise.resolve(null);
                }
                return utils_1.askAsync(chalk.bgYellow('WARNING:') +
                    ` Override '${foundName}' yes/no (${cfg.overrideWebpackConfigFile ? 'yes' : 'no'})?: `)
                    .then((answer) => {
                    if (answer &&
                        answer.trim() &&
                        (answer.trim().toLowerCase() === 'yes' ||
                            answer.trim().toLowerCase() === 'y')) {
                        cfg.overrideWebpackConfigFile = true;
                    }
                });
            }
            else {
                return Promise.resolve(null);
            }
        });
    })
        .then(() => {
        if (cfg.cliOptions.commandOptions.root) {
            return Promise.resolve(null);
        }
        return utils_1.askAsync(`Enter client app root folder (${appConfig.root}): `)
            .then((answer) => {
            if (answer && answer.trim()) {
                appConfig.root = answer.trim();
            }
        });
    })
        .then(() => {
        if (cfg.cliOptions.commandOptions.outDir) {
            return Promise.resolve(null);
        }
        return utils_1.askAsync(`Enter build output folder (${appConfig.outDir}): `)
            .then((answer) => {
            if (answer && answer.trim()) {
                appConfig.outDir = answer.trim();
            }
        });
    })
        .then(() => {
        if (cfg.cliOptions.commandOptions.publicPath) {
            return Promise.resolve(null);
        }
        return utils_1.askAsync(`Enter public path (${appConfig.publicPath}): `)
            .then((answer) => {
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
        return utils_1.askAsync(`Enter app bootstrap main file (${appConfig.main || ''}): `)
            .then((answer) => {
            if (answer && answer.trim()) {
                appConfig.main = answer.trim();
            }
        });
    })
        .then(() => {
        if (cfg.cliOptions.commandOptions.styles && cfg.cliOptions.commandOptions.styles.length && Array.isArray(cfg.cliOptions.commandOptions.styles)) {
            return Promise.resolve(null);
        }
        return utils_1.askAsync(`Enter css/scss/less/stylus global style files (${appConfig.styles.join(', ')}): `)
            .then((answer) => {
            if (answer && answer.trim().length) {
                answer = answer.trim();
                const answerArray = answer.split(',');
                answerArray.forEach(style => {
                    style = style.trim();
                    if (appConfig.styles.indexOf(style) === -1) {
                        appConfig.styles.push(style);
                    }
                });
            }
        });
    })
        .then(() => {
        if (cfg.cliOptions.commandOptions.faviconMasterPicture) {
            return Promise.resolve(null);
        }
        return utils_1.askAsync(`Enter favicon master logo file (${cfg.faviconConfig.masterPicture
            ? cfg.faviconConfig.masterPicture
            : ''}): `)
            .then((answer) => {
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
        return utils_1.askAsync(`Enter webpack config file name (${cfg.webpackConfigFileName || 'webpack.config.js'}): `)
            .then((answer) => {
            if (answer && answer.trim()) {
                cfg.webpackConfigFileName = answer.trim();
            }
        });
    });
}
function checkPackagesToInstall(packagesToCheck, projectRoot) {
    const tasks = packagesToCheck.map((pkgToCheck) => {
        return new Promise(res => {
            resolve(pkgToCheck.packageName, { basedir: projectRoot }, (error, resolvedPath) => {
                if (error) {
                    res(pkgToCheck);
                }
                else {
                    pkgToCheck.resolvedPath = resolvedPath;
                    res(pkgToCheck);
                }
            });
        }).then((packageObj) => {
            if (packageObj.resolvedPath && packageObj.version) {
                const versionRange = semver.validRange(packageObj.version);
                return utils_1.getVersionfromPackageJsonAsync(path.resolve(projectRoot, 'node_modules', packageObj.packageName)).then((localVer) => {
                    if (localVer && semver.satisfies(localVer, versionRange)) {
                        return null;
                    }
                    if (packageObj.isPreReleased) {
                        return Promise.resolve(packageObj.packageName + '@' + packageObj.version);
                    }
                    else {
                        return Promise.resolve(packageObj.packageName);
                    }
                });
            }
            else {
                if (packageObj.isPreReleased) {
                    return Promise.resolve(packageObj.packageName + '@' + packageObj.version);
                }
                else {
                    return Promise.resolve(packageObj.packageName);
                }
            }
        });
    });
    return Promise.all(tasks).then(packages => packages.filter(p => p !== null));
}
//# sourceMappingURL=init.js.map