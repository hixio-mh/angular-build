import * as path from 'path';
import * as fs from 'fs';
import * as del from 'del';
import * as chalk from 'chalk';
import * as yargs from 'yargs';
import * as webpack from 'webpack';

import { CliOptions } from './models';

import { getAppConfigs, getWebpackConfig, getWebpackStatsConfig } from '../webpack-configs';
import { AppConfig } from '../models/index';
import { chageDashCase, mapToYargsType, readJsonSync } from '../utils';

const cliVersion = require('../../package.json').version;

// ReSharper disable once CommonJsExternalModule
const schema: any = require('../../configs/schema.json');

export const buildCommandUsage = `\n${chalk.green(`angular-build ${cliVersion}`)}\n
Usage:
  ngb build [options...]`;

export function getBuildCommandModule() {
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
    if (cliOptions.commandOptions.project) {
        cliOptions.cwd = path.isAbsolute(cliOptions.commandOptions.project)
            ? cliOptions.commandOptions.project
            : path.resolve(cliOptions.cwd, cliOptions.commandOptions.project);
    }

    const projectRoot = cliOptions.cwd;
    const buildOptions: any = {};
    if (cliOptions.commandOptions && typeof cliOptions.commandOptions === 'object') {
        const buildOptionsSchema = schema.definitions.BuildOptions.properties;
        Object.keys(cliOptions.commandOptions).filter((key: string) => buildOptionsSchema[key] && typeof cliOptions.commandOptions[key] !== 'undefined' && cliOptions.commandOptions[key] !== null && cliOptions.commandOptions[key] !== '')
            .forEach((key: string) => {
                buildOptions[key] = cliOptions.commandOptions[key];
            });
    }
    buildOptions.webpackIsGlobal = true;

    const appConfigs = getAppConfigs(projectRoot, null, buildOptions);
    if (!appConfigs || appConfigs.length === 0) {
        throw new Error(`Error in getting webpack configs. Received empty config.`);
    }

    const webpackConfigs = appConfigs
        .map((appConfig: AppConfig) => {
            return getWebpackConfig(projectRoot, appConfig, buildOptions, true);
        });
    if (!webpackConfigs || webpackConfigs.length === 0) {
        throw new Error(`Error in getting webpack configs. Received empty config.`);
    }

    const statsConfig = getWebpackStatsConfig();
    statsConfig.children = true;

    const webpackCompiler = webpack(webpackConfigs);

    // Cleaning
    if (buildOptions.dll) {
        // delete dlls
        const outDirs = appConfigs.map((appConfig: AppConfig) => path.resolve(projectRoot, appConfig.outDir));
        outDirs.forEach((p: string) => del.sync(p, { cwd: projectRoot }));
    } else {
        if (buildOptions.aot) {
            const parsedTsConfigPaths: string[] = [];
            const aotGenDirs = appConfigs.map((appConfig: AppConfig) => {
                if (appConfig.root && appConfig.tsconfig) {
                    const tsConfigPath = path.resolve(projectRoot, appConfig.root, appConfig.tsconfig);
                    if (parsedTsConfigPaths.indexOf(tsConfigPath) === -1 && fs.existsSync(tsConfigPath)) {
                        parsedTsConfigPaths.push(tsConfigPath);
                        const tsConfig = readJsonSync(tsConfigPath);
                        if (tsConfig.angularCompilerOptions &&
                            tsConfig.angularCompilerOptions.genDir &&
                            fs.existsSync(path.resolve(path.dirname(tsConfigPath), tsConfig.angularCompilerOptions.genDir))) {
                            return path.resolve(path.dirname(tsConfigPath), tsConfig.angularCompilerOptions.genDir);
                        }
                    }
                }
                return null;
            });
            aotGenDirs.filter((p: string) => p !== null).forEach((p: string) => {
                del.sync(p, { cwd: projectRoot });
            });
        }
        if (!appConfigs.find((appConfig: AppConfig) => appConfig.referenceDll)) {
            const outDirs = appConfigs.map((appConfig: AppConfig) => path.resolve(projectRoot, appConfig.outDir));
            outDirs.forEach((p: string) => del.sync(p, { cwd: projectRoot }));
        }
    }

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
    }).then(() => 0);
}