'use strict';

const path = require('path');
const fs = require('fs-extra');
const readline = require('readline');
const chalk = require('chalk');
const cliVersion = require('../package.json').version;

const yargs = require('yargs')
	//.version(function() {
	//	return cliVersion;
	//})
	.usage(`\n${chalk.green(`angular-build ${cliVersion}`)}\n
Usage:
  angular-build command ${chalk.cyan('[options...]')}
  angular-build ${chalk.cyan('[options]')}`
	)
	.example('angular-build init', 'Create angular-build config files')
	.example('angular-build -h', 'Show help')
	.command({
        command: 'init',
        //alias: 'i',
		desc: 'Create angular-build config files',
		builder: (ya) => {
			return ya
				.reset()
				.usage(`\n${chalk.green(`angular-build ${cliVersion}`)}\n
Usage:
  angular-build init ${chalk.cyan('[options...]')}`
				)
				.example('angular-build init --prompt', 'Create angular-build config files with user prompt option')
				//.help('h')
				//.alias('h', 'help')
				//.describe('h', 'Show help')
				.option('p',
				{
					alias: 'prompt',
					describe: 'Confirm user by prompting',
					type: 'boolean'
					//default: false
                })
                .option('use-angular-cli-config-file',
                {
                    alias: 'useAngularCliConfigFile',
                    describe: 'Use angular-cli.json as a build config file',
                    type: 'boolean',
                    default: false
                })
                .option('webpack-config-file-name',
                {
                    alias: 'webpackConfigFileName',
                    describe: 'Webpack config file name',
                    type: 'string'
                })
                .option('favicon-naster-picture',
                {
                    alias: 'faviconMasterPicture',
                    describe: 'favicon master picture file name',
                    type: 'string'
                })
                .option('override-angular-build-config-file',
                {
                    alias: 'overrideAngularBuildConfigFile',
                    describe: 'Override angular-build.json file',
                    type: 'boolean',
                    default: false
                })
                .option('override-webpack-config-file',
                {
                    alias: 'overrideWebpackConfigFile',
                    describe: 'Override webpack config file',
                    type: 'boolean',
                    default: false
                })
                .option('root',
                {
                    describe: 'Client app root directory',
                    type: 'string'
                })
                .option('out-dir',
                {
                    alias: 'outDir',
                    describe: 'Build/bundle output directory',
                    type: 'string'
                })
                .option('public-path',
                {
                    alias: 'publicPath',
                    describe: 'Public Url address of the output files',
                    type: 'string'
                })
                .option('main',
                {
                    describe: 'App main bootstrap file',
                    type: 'string'
                })
                .option('tsconfig',
                {
                    describe: 'Typescript configuration file',
                    type: 'string'
                })
                .option('assets',
                {
                    describe: 'Assets to be copied to output directory',
                    type: 'array'
                })
                .option('styles',
                {
                    describe: 'Global styles (.css/.scss/.less/.stylus) to be bundled',
                    type: 'array'
                })
                .option('scripts',
                {
                    describe: 'Script files to be added to the global scope',
                    type : 'array'
                })
                .option('provide',
                {
                    describe: 'To automatically load module with alias key'
                })
                .option('index',
                {
                    describe: 'Html index source template file',
                    type: 'string'
                })
                .option('index-out-file-name',
                {
                    alias: 'indexOutFileName',
                    describe: 'The file to write the Html to',
                    type: 'string'
                })
                .option('favicon-config',
                {
                    alias: 'faviconConfig',
                    describe: 'Favicon configuration file',
                    type: 'string'
                })
                .option('html-inject-options',
                {
                    alias: 'htmlInjectOptions',
                    describe: 'Html injection options'
                })
                .option('reference-dll-on-development',
                {
                    alias: 'referenceDllOnDevelopment',
                    describe: 'Generate dll bundles for development builds',
                    type: 'boolean',
                    default: true
                })
                .option('reference-dll-on-production',
                {
                    alias: 'referenceDllOnProduction',
                    describe: 'Generate dll bundles for production builds',
                    type: 'boolean',
                    default: false
                })
                .option('try-build-dll',
                {
                    alias: 'tryBuildDll',
                    describe: 'To automatically run command as specified in tryBuildDllCommand when dll [vendor]-manifest.json file is not found',
                    type: 'boolean',
                    default: false
                })
                .option('try-build-dll-command',
                {
                    alias: 'tryBuildDllCommand',
                    describe: 'The tryBuildDll command',
                    type: 'string'
                })
                .option('try-build-dll-command-args',
                {
                    alias: 'tryBuildDllCommandArgs',
                    describe: 'The tryBuildDll command arguments',
                    type: 'array'
                })
                .option('dlls',
                {
                    describe: 'The entries for dll bundle',
                    type: 'array'
                })
                .option('import-polyfills-to-main',
                {
                    alias: 'importPolyfillsToMain',
                    describe: 'If true, dll polyfill entries are imported to main entry',
                    type: 'boolean',
                    default: true
                })
                .option('environments',
                {
                    describe: 'TheEnvironment files to be used with build args (--environment=dev or --environment=prod)'
                });
		},
        handler: (argv) => {
	        const projectRoot = process.cwd();
	        init(projectRoot, argv)
	         .then(() => exit(0))
	         .catch(err => {
	          console.error(chalk.white.bgRed('ERROR:') + ' ' + err);
	          exit(-1);
	         });
        }
	})
	.help('h')
	.option('h',
	{
		alias: ['help', '?'],
		describe: 'Show help',
		type: 'boolean'
	})
	.option('v',
	{
		alias: 'version',
		describe: 'Show version',
		type: 'boolean'
	});
const options = yargs.argv;
const command = yargs.argv._[0];

// commands
// ------------------------------------------------------------
function init(projectRoot, opts) {
    return checkFileOrDirectoryExistsAsync(path.resolve(projectRoot, 'angular-build.json')).then(exists => {
        if (exists && (!opts || !opts.prompt)) {
            return Promise.resolve(null);
        } else {
            return initCore(projectRoot, opts);
        }
    });
}

function initCore(projectRoot, opts) {
	return readPackageConfigAsync(projectRoot)
		.then(pkgConfig => {
            const cfg = {};
			cfg.projectRoot = projectRoot;
            cfg.pkgConfig = pkgConfig;
            cfg.commandOptions = opts;
            cfg.webpackConfigFileName = 'webpack.config.js';

			return readJsonAsync(require.resolve('../config/angular-build.json')).then(angularBuildConfig => {
				cfg.angularBuildConfig = angularBuildConfig;
				return cfg;
			});
		})
		.then((cfg) => {
			return readJsonAsync(require.resolve('../config/tsconfig-json')).then(tsConfig => {
				cfg.tsConfig = tsConfig;
				return cfg;
			});
		})
		.then(cfg => {
			return readJsonAsync(require.resolve('../config/favicon-config.json')).then(faviconConfig => {
				cfg.faviconConfig = faviconConfig;
				return cfg;
			});
		})
		// 0. merge
		.then(cfg => mergeConfigAsync(cfg).then(() => cfg))
		// 1. save angular-build.json file
		.then(cfg => {
            if (cfg.useAngularCliConfigFile) {
	            if (cfg.angularCliConfigFileExists && cfg.cliConfig) {
		            cfg.cliConfig.apps[0] = Object.assign(cfg.cliConfig.apps[0], cfg.angularBuildConfig.apps[0]);
		            return new Promise((resolve, reject) => {
			            fs.writeFile(path.resolve(projectRoot, 'angular-cli.json'),
				            JSON.stringify(cfg.cliConfig, null, 2),
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
        .then(cfg => {
            if (cfg.webpackConfigFileExists && !cfg.overrideWebpackConfigFile) {
                return Promise.resolve(cfg);
            } else {
                return new Promise((resolve, reject) => {
                    if (cfg.webpackConfigFileName && cfg.webpackConfigFileName.match(/\.ts$/i)) {
                        fs.copy(require.resolve('../config/webpack-config-ts'),
                            path.resolve(projectRoot, cfg.webpackConfigFileName),
                            err => {
                                err ? reject(err) : resolve(cfg);
                            });
                    } else {
                        fs.copy(require.resolve('../config/webpack-config-js'),
                            path.resolve(projectRoot, cfg.webpackConfigFileName || 'webpack.config.js'),
                            err => {
                                err ? reject(err) : resolve(cfg);
                            });
                    }
                });
            }
		})
		// 3. Create src folder
		.then(cfg => {
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
        .then(cfg => {
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
        .then(cfg => {

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
		.then(cfg => {
			const appConfig = cfg.angularBuildConfig.apps[0];
			return checkFileOrDirectoryExistsAsync(path.resolve(projectRoot, appConfig.root, 'polyfills.ts'))
				.then(exists => {
					if (exists) {
						return Promise.resolve(cfg);
					} else {
						return new Promise((resolve, reject) => {
							fs.copy(require.resolve('../config/polyfills-ts'),
								path.resolve(projectRoot, appConfig.root, 'polyfills.ts'),
								err => {
									err ? reject(err) : resolve(cfg);
								});
						});
					}
				}).then(() => {
					return checkFileOrDirectoryExistsAsync(path.resolve(projectRoot, appConfig.root, 'vendors.ts'))
						.then(exists => {
							if (exists) {
								return Promise.resolve(cfg);
							} else {
								return new Promise((resolve, reject) => {
									fs.copy(require.resolve('../config/vendors-ts'),
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
		.then(cfg => {
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
		.then(cfg => {
			const appConfig = cfg.angularBuildConfig.apps[0];
			return checkFileOrDirectoryExistsAsync(path.resolve(projectRoot, appConfig.root, 'environments', 'environment.ts'))
				.then(exists => {
					if (exists) {
						return Promise.resolve(cfg);
					} else {
						return new Promise((resolve, reject) => {
							fs.copy(require.resolve('../config/environment-ts'),
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
									fs.copy(require.resolve('../config/environment-prod-ts'),
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
		.then(cfg => {
			const appConfig = cfg.angularBuildConfig.apps[0];
			const packageScripts = {
				"build:dll": 'cross-env NODE_ENV=development webpack --profile --colors --bail',
				"prebuilt:dll": 'npm run clean:dist ',
				"build:dev": 'cross-env NODE_ENV=development webpack --profile --colors --bail',
				"build:prod": 'cross-env NODE_ENV=production webpack --profile --colors --bail',
				"build": 'npm run build:dev',
				"clean:dist": `npm run rimraf -- ${appConfig.outDir}`
			};
			cfg.pkgConfig.scripts = Object.assign({}, cfg.pkgConfig.scripts || {}, packageScripts);
			return new Promise((resolve, reject) => {
				fs.writeFile(path.resolve(projectRoot, 'package.json'),
					JSON.stringify(cfg.pkgConfig, null, 2),
					err => err ? reject(err) : resolve(cfg));
			});
		});
}

// Main
// ------------------------------------------------------------
if (command === 'init') {
    // Do nothing, handled in yargs
	//init(options.prompt);
}else if (options.version) {
    console.log(cliVersion);
    exit(0);
}else {
    yargs.showHelp();
    exit(0);
}

// Helpers
// ------------------------------------------------------------
function readPackageConfigAsync(projectRoot) {
    const pkgPath = path.resolve(projectRoot, 'package.json');
	return checkFileOrDirectoryExistsAsync(pkgPath).then(exists => exists
		? readJsonAsync(pkgPath)
		: Promise.reject(`${chalk.yellow('package.json')} file doesn't exist.\nRun ${chalk
			.yellow('npm init')} command first.`));
}

function mergeConfigAsync(cfg) {
    return mergeConfigWithPossibleAsync(cfg)
        .then(() => mergeConfigWithAngularCliAsync(cfg))
        .then(() => mergeWithOptions(cfg))
        .then(() => cfg.commandOptions && cfg.commandOptions.prompt ? mergeConfigWithPrompt(cfg) : Promise.resolve(true));
}

function mergeConfigWithPossibleAsync(cfg) {

	const projectRoot = cfg.projectRoot;
    const appConfig = cfg.angularBuildConfig.apps[0];

	const possibleSrcDirs = ['client', 'Client', 'src'];
	const possibleOutDirs = ['wwwroot', 'dist'];
	const possibleMains = ['main.browser.ts', 'main.ts'];
	const possibleStyles = ['styles.scss', 'styles.sass', 'styles.less', 'styles.stylus', 'styles.css'];
	const possibleFavicons = ['logo.svg', 'logo.png', 'favicon.svg', 'favicon.png'];

	// root
	return findFileOrDirectoryFromPossibleAsync(projectRoot, possibleSrcDirs, appConfig.root, true).then(foundRoot => {
			appConfig.root = foundRoot || appConfig.root;

			// outDir
			return findFileOrDirectoryFromPossibleAsync(projectRoot, possibleOutDirs, appConfig.outDir, true);
		})
		.then(foundOutDir => {
			appConfig.outDir = foundOutDir || appConfig.outDir;

            // main
			return findFileOrDirectoryFromPossibleAsync(path.resolve(projectRoot, appConfig.root),
				possibleMains,
				appConfig.main,
				false);
		})
		.then(foundMain => {
			appConfig.main = foundMain || appConfig.main;

			// styles
			return findFileOrDirectoryFromPossibleAsync(path.resolve(projectRoot, appConfig.root),
				possibleStyles,
				'styles.scss',
				false);
		})
		.then(foundStyle => {
			if (foundStyle && appConfig.styles.indexOf(foundStyle) === -1) {
				appConfig.styles.push(foundStyle);
			}

			// asset folder
			return findFileOrDirectoryFromPossibleAsync(path.resolve(projectRoot, appConfig.root), ['assets'], 'asset', true);
		})
		.then(foundAsset => {
			if (foundAsset && appConfig.assets.indexOf(foundAsset) === -1) {
				appConfig.assets.push('assets/**/*');
			}

			// robots.txt
			return findFileOrDirectoryFromPossibleAsync(path.resolve(projectRoot, appConfig.root),
				['robots.txt'],
				'robots.txt',
				false);
		})
		.then(foundAsset => {
			if (foundAsset && appConfig.assets.indexOf(foundAsset) === -1) {
				appConfig.assets.push(foundAsset);
			}

			// humans.txt
			return findFileOrDirectoryFromPossibleAsync(path.resolve(projectRoot, appConfig.root),
				['humans.txt'],
				'humans.txt',
				false);
		})
		.then(foundAsset => {
			if (foundAsset && appConfig.assets.indexOf(foundAsset) === -1) {
				appConfig.assets.push(foundAsset);
			}

			// favicon
			return findFileOrDirectoryFromPossibleAsync(path.resolve(projectRoot, appConfig.root),
				possibleFavicons,
				'logo.svg',
				false);
		})
		.then(foundFavicon => {
            if (foundFavicon) {
                cfg.faviconMasterPicture = foundFavicon;
	            cfg.faviconConfig.masterPicture = foundFavicon;
				appConfig.faviconConfig = appConfig.faviconConfig || 'favicon-config.json';
			} else {
				appConfig.faviconConfig = null;
			}

			// index
			return findFileOrDirectoryFromPossibleAsync(path.resolve(projectRoot, appConfig.root),
				['index.html'],
				'index.html',
				false);
		})
		.then(foundIndex => {
			if (foundIndex) {
				appConfig.index = foundIndex;
				return Promise.resolve(false);
			}

			// asp.net
			return checkFileOrDirectoryExistsAsync(path.resolve(projectRoot, 'Views', 'Shared'), true)
				.then(exists => exists
					? checkFileOrDirectoryExistsAsync(path.resolve(projectRoot, 'wwwroot'), true)
					: Promise.resolve(false));
		})
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
}

function mergeConfigWithAngularCliAsync(cfg) {
    const projectRoot = cfg.projectRoot;
    const appConfig = cfg.angularBuildConfig.apps[0];
    const cliPath = path.resolve(projectRoot, 'angular-cli.json');

	return checkFileOrDirectoryExistsAsync(cliPath).then(exists => {
        if (exists) {
	        return readJsonAsync(cliPath).then(cliConfig => {
		        cliConfig = cliConfig || {};
		        cliConfig.apps = cliConfig.apps || [];
                const cliAppConfig = cliConfig.apps[0] || {};
                if (cliAppConfig.root) {
                    cfg.angularCliConfigFileExists = true;
	                cfg.cliConfig = cliConfig;
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
        } else {
            return Promise.resolve(null);
        }
	});
}

function mergeWithOptions(cfg) {
    const commandOptions = cfg.commandOptions || {};

    cfg.useAngularCliConfigFile = commandOptions.useAngularCliConfigFile || cfg.useAngularCliConfigFile;
    cfg.webpackConfigFileName = commandOptions.webpackConfigFileName || cfg.webpackConfigFileName;
    cfg.faviconMasterPicture = commandOptions.faviconMasterPicture || cfg.faviconMasterPicture;
    cfg.overrideAngularBuildConfigFile = commandOptions.overrideAngularBuildConfigFile || cfg.overrideAngularBuildConfigFile;
    cfg.overrideWebpackConfigFile = commandOptions.overrideWebpackConfigFile || cfg.overrideWebpackConfigFile;

    const appConfig = cfg.angularBuildConfig.apps[0];
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
        appConfig.referenceDllOnDevelopment = commandOptions.referenceDllOnDevelopment == true ? true : false;
    }
    if (typeof commandOptions.referenceDllOnProduction !== 'undefined') {
        // ReSharper disable once CoercedEqualsUsing
        appConfig.referenceDllOnProduction = commandOptions.referenceDllOnProduction == true ? true : false;
    }
    if (typeof commandOptions.tryBuildDll !== 'undefined') {
        // ReSharper disable once CoercedEqualsUsing
        appConfig.tryBuildDll = commandOptions.tryBuildDll == true ? true : false;
    }

    appConfig.tryBuildDllCommand = commandOptions.tryBuildDllCommand || appConfig.tryBuildDllCommand;
    if (commandOptions.tryBuildDllCommandArgs && commandOptions.tryBuildDllCommandArgs.length && Array.isArray(commandOptions.tryBuildDllCommandArgs)) {
        appConfig.tryBuildDllCommandArgs = commandOptions.tryBuildDllCommandArgs;
    }
    if (commandOptions.dlls && commandOptions.dlls.length && Array.isArray(commandOptions.dlls)) {
        appConfig.dlls = commandOptions.dlls;
    }
    if (typeof commandOptions.importPolyfillsToMain !== 'undefined') {
        // ReSharper disable once CoercedEqualsUsing
        appConfig.importPolyfillsToMain = commandOptions.importPolyfillsToMain == true ? true : false;
    }

	if (commandOptions.styles && commandOptions.styles.length && Array.isArray(commandOptions.styles)) {
        commandOptions.styles.forEach(style => {
            style = style.trim();
            if (appConfig.styles.indexOf(style) === -1) {
                appConfig.styles.push(style);
            }
        });
    }
    if (commandOptions.scripts && commandOptions.scripts.length && Array.isArray(commandOptions.scripts)) {
        commandOptions.scripts.forEach(script => {
            script = script.trim();
            if (appConfig.scripts.indexOf(script) === -1) {
                appConfig.scripts.push(script);
            }
        });
    }
    if (commandOptions.assets && commandOptions.assets.length && Array.isArray(commandOptions.assets)) {
        commandOptions.assets.forEach(asset => {
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
    const projectRoot = cfg.projectRoot;
    const appConfig = cfg.angularBuildConfig.apps[0];

	return checkFileOrDirectoryExistsAsync(path.resolve(projectRoot, 'angular-build.json'))
		.then(exists => {
            if (exists) {
                cfg.angularBuildConfigFileExists = true;
				return askAsync(chalk.bgYellow('WARNING:') +
						` Override ${chalk
						.yellow('angular-build.json')} yes/no (${cfg.overrideAngularBuildConfigFile ? 'yes' : 'no'})?: `)
					.then(answer => {
						if (answer &&
							answer.trim() &&
							(answer.trim().toLowerCase() === 'yes' ||
								answer.trim().toLowerCase() === 'y' ||
								answer.trim().toLowerCase() === 'true')) {
							cfg.overrideAngularBuildConfigFile = true;
						}
					});
			} else {
				return Promise.resolve(null);
			}
		})
		.then(() => {
			if (cfg.angularCliConfigFileExists) {
				return askAsync(`Use ${chalk
						.yellow('angular-cli.json')} as a build config yes/no (${cfg.useAngularCliConfigFile ? 'yes' : 'no'})?: `)
					.then(answer => {
						if (answer &&
							answer.trim() &&
							(answer.trim().toLowerCase() === 'yes' ||
								answer.trim().toLowerCase() === 'y' ||
								answer.trim().toLowerCase() === 'true')) {
							cfg.useAngularCliConfigFile = true;
						}
					});
			} else {
				return Promise.resolve(null);
			}
		})
        .then(() => {
			if (cfg.webpackConfigFileName &&
				cfg.webpackConfigFileName.match(/\.js$/i) &&
				!cfg.webpackConfigFileName.match(/\.bable\.js$/i)) {
				cfg.tmpTsWebpackConfigFileName = cfg.webpackConfigFileName.substring(0, cfg.webpackConfigFileName.length - 3) +
					'.ts';
				return checkFileOrDirectoryExistsAsync(path
					.resolve(projectRoot, cfg.tmpTsWebpackConfigFileName));
			} else if (cfg.webpackConfigFileName && cfg.webpackConfigFileName.match(/\.ts$/i)) {
				return checkFileOrDirectoryExistsAsync(path
					.resolve(projectRoot, cfg.webpackConfigFileName || 'webpack.config.ts'));
			} else {
				return Promise.resolve(false);
			}
		})
		.then(exists => {
            if (exists) {
                cfg.webpackConfigFileExists = true;

                cfg.webpackConfigFileName = cfg.tmpTsWebpackConfigFileName || cfg.webpackConfigFileName || 'webpack.config.ts';
	            const webpackConfigFileName = cfg.webpackConfigFileName;

				return askAsync(chalk.bgYellow('WARNING:') +
						` Override ${chalk.yellow(webpackConfigFileName)} yes/no (${cfg.overrideWebpackConfigFile ? 'yes' : 'no'})?: `)
					.then(answer => {
						if (answer &&
							answer.trim() &&
							(answer.trim().toLowerCase() === 'yes' ||
								answer.trim().toLowerCase() === 'y' ||
								answer.trim().toLowerCase() === 'true')) {
							cfg.overrideWebpackConfigFile = true;
						}
						return true;
					});
			} else {
				return Promise.resolve(false);
			}
		})
		.then(webpackTsExists => {
			if (webpackTsExists) {
				return Promise.resolve(false);
			} else {
				return checkFileOrDirectoryExistsAsync(path.resolve(projectRoot, 'webpack.config.js'));
			}
		})
		.then(exists => {
            if (exists) {
                cfg.webpackConfigFileExists = true;
                cfg.webpackConfigFileName = cfg.webpackConfigFileName || 'webpack.config.ts';
                const webpackConfigFileName = cfg.webpackConfigFileName;

				return askAsync(chalk.bgYellow('WARNING:') +
						` Override ${chalk.yellow(webpackConfigFileName)} yes/no (${cfg.overrideWebpackConfigFile ? 'yes' : 'no'})?: `)
					.then(answer => {
						if (answer &&
							answer.trim() &&
							(answer.trim().toLowerCase() === 'yes' ||
								answer.trim().toLowerCase() === 'y' ||
								answer.trim().toLowerCase() === 'true')) {
							cfg.overrideWebpackConfigFile = true;
						}
						return true;
					});
			} else {
				return Promise.resolve(false);
			}
		}).then(() => {
			return askAsync(`Enter client app root folder (${appConfig.root}): `)
				.then(answer => {
					if (answer && answer.trim()) {
						appConfig.root = answer.trim();
					}
				});
		})
		.then(() => askAsync(`Enter build output folder (${appConfig.outDir}): `))
		.then(answer => {
			if (answer && answer.trim()) {
				appConfig.outDir = answer.trim();
			}
			return;
		})
		.then(() => askAsync(`Enter public path (${appConfig.publicPath}): `))
		.then(answer => {
			if (answer && answer.trim()) {
				appConfig.publicPath = answer.trim();
				if (!appConfig.publicPath.endsWith('/')) {
					appConfig.publicPath += '/';
				}
			}
		})
		.then(() => askAsync(`Enter app bootstrap main file (${appConfig.main || ''}): `))
		.then(answer => {
			if (answer && answer.trim()) {
				appConfig.main = answer.trim();
			}
		})
		.then(() => askAsync(`Enter css/scss/less/stylus global style files (${appConfig.styles.join(', ')}): `))
		.then(answer => {
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
		})
		.then(() => askAsync(`Enter favicon master logo file (${cfg
			.faviconMasterPicture
			? cfg.faviconMasterPicture
			: ''}): `))
		.then(answer => {
			if (answer && answer.trim()) {
				answer = answer.trim();
				cfg.faviconMasterPicture = answer;
				cfg.faviconConfig.masterPicture = answer;
				appConfig.faviconConfig = appConfig.faviconConfig || 'favicon-config.json';
			}
		})
        .then(() => {
            if (cfg.overrideWebpackConfigFile || cfg.webpackConfigFileExists) {
	            return Promise.resolve(null);
            } else {
	            return askAsync(`Enter webpack config file name (${cfg.webpackConfigFileName || 'webpack.config.js'}): `)
		            .then(answer => {
			            if (answer && answer.trim()) {
				            cfg.webpackConfigFileName = answer.trim();
			            }
		            });
            }
		});

}

// Utils
// ------------------------------------------------------------
function exit(code) {
    if (process.platform === 'win32' && process.stdout.bufferSize) {
        process.stdout.once('drain', function () {
            process.exit(code);
        });
        return;
    }
    process.exit(code);
}

function stripComments(content){
    /**
     * First capturing group matches double quoted string
     * Second matches single quotes string
     * Third matches block comments
     * Fourth matches line comments
     */
    const regexp = /("(?:[^\\\"]*(?:\\.)?)*")|('(?:[^\\\']*(?:\\.)?)*')|(\/\*(?:\r?\n|.)*?\*\/)|(\/{2,}.*?(?:(?:\r?\n)|$))/g;
    const result = content.replace(regexp, (match, m1, m2, m3, m4) => {
        // Only one of m1, m2, m3, m4 matches
        if (m3) {
            // A block comment. Replace with nothing
            return '';
        } else if (m4) {
            // A line comment. If it ends in \r?\n then keep it.
            let length = m4.length;
            if (length > 2 && m4[length - 1] === '\n') {
                return m4[length - 2] === '\r' ? '\r\n' : '\n';
            } else {
                return '';
            }
        } else {
            // We match a string
            return match;
        }
    });
    return result;
};

function readJsonAsync(filePath, throwError) {
	return new Promise((resolve, reject) => {
        fs.readFile(filePath, function (err, data) {
            if (err) {
                throwError === false ? resolve(null) : reject(err);
            } else {
                const context = stripComments(data.toString().replace(/^\uFEFF/, ''));
                resolve(JSON.parse(context));

            }
        });
	});
}

function checkFileOrDirectoryExistsAsync(filePath, isDir) {
    return new Promise((resolve) => {
        fs.stat(filePath, (err, stats) => {
            resolve(err ? false : isDir ? stats.isDirectory() : stats.isFile());
        });
    });
}

function findFileOrDirectoryFromPossibleAsync(baseDir, possibleNames, preferredName, isDir) {
    const tasks = possibleNames.map(name => {
        const pathToFind = path.resolve(baseDir, name);
        return checkFileOrDirectoryExistsAsync(pathToFind, isDir).then(exists => exists ? name : null);
    });

    return Promise.all(tasks)
        .then(foundList => {
            if (preferredName) {
                return foundList.find(f => f === preferredName) || foundList.find(f => f !== null);
            }
            return foundList.find(f => f !== null);
        });
}

function askAsync(msg) {

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    return new Promise((resolve) => {
        rl.question(msg, (answer) => {
            rl.close();
            resolve(answer);
        });
    });
}