import * as path from 'path';
import * as fs from 'fs';
import * as rimraf from 'rimraf';
import * as chalk from 'chalk';
import * as yargs from 'yargs';
import * as webpack from 'webpack';

import { CliOptions } from './models';

import { getAppConfigs, getWebpackConfig, getWebpackStatsConfig } from '../webpack-configs';
import { AppConfig } from '../models/index';
import { chageDashCase, mapToYargsType, readJsonAsync } from '../utils';

// ReSharper disable once CommonJsExternalModule
const schema = require('../../configs/schema.json');

export function getBuildCommandModule(cliVersion: string) : yargs.CommandModule {
    const buildCommandUsage = `\n${chalk.green(`angular-build ${cliVersion}`)}\n
Usage:
  ngb build [options...]`;

    const buildCommandModule: yargs.CommandModule = {
        command: 'build',
        describe: 'Build/bundle the app(s)',
        builder: (yargv: yargs.Argv) => {
            let yargvObj = yargv
                .reset()
                .usage(buildCommandUsage)
                .example('ngb build', 'Build/bundle the app(s) using angular-build.json file.')
                .help('h')
                .option('project',
                {
                    describe: 'The target project location',
                    type: 'string'
                })
                .option('watch',
                {
                    describe: 'Build/bundle the app(s) with watch mode',
                    type: 'boolean',
                    default: undefined
                });

            const buildOptionsSchema = schema.definitions.BuildOptions.properties;
            Object.keys(buildOptionsSchema).forEach((key: string) => {
                yargvObj = yargvObj.options(chageDashCase(key),
                    {
                        describe: buildOptionsSchema[key].description || key,
                        type: mapToYargsType(buildOptionsSchema[key].type),
                        default: undefined
                    });
            });

            return yargvObj;
        },
        handler: null
    };
    return buildCommandModule;
}

export function build(cliOptions: CliOptions): Promise<number> {
    cliOptions.cwd = cliOptions.cwd ? path.resolve(cliOptions.cwd) : process.cwd();
    if (cliOptions.commandOptions.project) {
        cliOptions.cwd = path.isAbsolute(cliOptions.commandOptions.project)
            ? path.resolve(cliOptions.commandOptions.project)
            : path.resolve(cliOptions.cwd, cliOptions.commandOptions.project);
    }

    const projectRoot = cliOptions.cwd;
    const buildOptions: any = {};
    const statsConfig = getWebpackStatsConfig();
    statsConfig.children = true;
    let webpackConfigs: any = null;

    return Promise.resolve()
        .then(() => {
            if (cliOptions.commandOptions && typeof cliOptions.commandOptions === 'object') {
                const buildOptionsSchema = schema.definitions.BuildOptions.properties;
                Object.keys(cliOptions.commandOptions)
                    .filter((key: string) => buildOptionsSchema[key] &&
                        typeof cliOptions.commandOptions[key] !== 'undefined' &&
                        cliOptions.commandOptions[key] !== null &&
                        cliOptions.commandOptions[key] !== '')
                    .forEach((key: string) => {
                        buildOptions[key] = cliOptions.commandOptions[key];
                    });
            }

            buildOptions.webpackIsGlobal = true;

            const appConfigs = getAppConfigs(projectRoot, null, buildOptions);
            if (!appConfigs || appConfigs.length === 0) {
                throw new Error(`Error in getting webpack configs. Received empty config.`);
            }

            webpackConfigs = appConfigs
                .map((appConfig: AppConfig) => {
                    return getWebpackConfig(projectRoot, appConfig, buildOptions, true);
                });
            if (!webpackConfigs || webpackConfigs.length === 0) {
                throw new Error(`Error in getting webpack configs. Received empty config.`);
            }

            if (buildOptions.dll) {
                // delete dlls
                const outDirs = appConfigs
                    .filter((appConfig: AppConfig) => path.resolve(projectRoot, appConfig.outDir) !==
                        path.resolve(projectRoot, appConfig.root) &&
                        path.resolve(projectRoot, appConfig.outDir) !== projectRoot)
                    .map((appConfig: AppConfig) => path.resolve(projectRoot, appConfig.outDir));
                const delTasks = outDirs.map((p: string) =>
                    new Promise((resolve: any, reject: any) => rimraf(p,
                            (err: Error) => err ? reject(err) : resolve(err))
                    ));
                return Promise.all(delTasks).then(() => {
                    return;
                });
            } else {
                return Promise.resolve()
                    .then(() => {
                        if (buildOptions.aot) {
                            // delete aot-compiled
                            const parsedTsConfigPaths: string[] = [];
                            const aotGenDirTasks = appConfigs.map((appConfig: AppConfig) => {
                                if (appConfig.root && appConfig.tsconfig) {
                                    const tsConfigPath = path.resolve(projectRoot, appConfig.root, appConfig.tsconfig);
                                    if (parsedTsConfigPaths
                                        .indexOf(tsConfigPath) ===
                                        -1 &&
                                        fs.existsSync(tsConfigPath)) {
                                        parsedTsConfigPaths.push(tsConfigPath);
                                        //const tsConfig = readJsonSync(tsConfigPath);
                                        return readJsonAsync(tsConfigPath)
                                            .then((tsConfig: any) => {
                                                if (tsConfig.angularCompilerOptions &&
                                                    tsConfig.angularCompilerOptions.genDir &&
                                                    path.resolve(path.dirname(tsConfigPath),tsConfig.angularCompilerOptions.genDir) !== projectRoot &&
                                                    fs.existsSync(path
                                                        .resolve(path.dirname(tsConfigPath),
                                                            tsConfig.angularCompilerOptions.genDir))) {
                                                    return path.resolve(path.dirname(tsConfigPath),
                                                        tsConfig.angularCompilerOptions.genDir);
                                                }
                                                return null;
                                            });
                                    }
                                }
                                return Promise.resolve(null);
                            });

                            return Promise.all(aotGenDirTasks).then((aotGenDirs: string[]) => {
                                const delTasks = aotGenDirs.filter((p: string) => p !== null).map((p: string) =>
                                    new Promise((resolve: any, reject: any) => {
                                        rimraf(p,
                                            (err: Error) =>
                                            err ? reject(err) : resolve()
                                        );
                                    })
                                );
                                return Promise.all(delTasks).then(() => {
                                    return;
                                });
                            });
                        }
                        return Promise.resolve();
                    })
                    .then(() => {
                        if (!appConfigs.find((appConfig: AppConfig) => appConfig.referenceDll)) {
                            const outDirs = appConfigs
                                .filter((appConfig: AppConfig) => path.resolve(projectRoot, appConfig.outDir) !==
                                    path.resolve(projectRoot, appConfig.root) &&
                                    path.resolve(projectRoot, appConfig.outDir) !== projectRoot)
                                .map((appConfig: AppConfig) => path.resolve(projectRoot, appConfig.outDir));
                            const delTasks = outDirs.map((p: string) =>
                                new Promise((resolve: any, reject: any) => rimraf(p,
                                    (err: Error) => err ? reject(err) : resolve(err))
                                ));
                            return Promise.all(delTasks).then(() => {
                                return;
                            });
                        }
                        return Promise.resolve();
                    });
            }
        })
        .then(() => {
            const webpackCompiler = webpack(webpackConfigs);
            return new Promise((resolve, reject) => {
                const callback: webpack.compiler.CompilerCallback = (err: Error, stats: webpack.compiler.Stats) => {
                    if (err) {
                        return reject(err);
                    }

                    //const statsConfig = configs[0].stats;
                    console.log(stats.toString(statsConfig));
                    if (cliOptions.commandOptions.watch) {
                        return;
                    }

                    if (stats.hasErrors()) {
                        reject();
                    } else {
                        resolve();
                    }
                };

                if (cliOptions.commandOptions.watch) {
                    webpackCompiler.watch({}, callback);
                } else {
                    webpackCompiler.run(callback);
                }
            });
        })
        .then(() => { return 0; });
}