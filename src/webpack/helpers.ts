import * as path from 'path';
import * as fs from 'fs';

import { DllEntry } from './models';

// Dlls
// TODO: move to loader

interface DllSingleEntryParsedResult {
    entry: string[];
    fileDependency?: string;
}

export interface DllEntryParsedResult {
    entries: DllEntry[];
    fileDependencies?: string[];
}

export function parseDllEntries(baseDir: string, dlls: string | (string | DllEntry)[], isProd: boolean): DllEntryParsedResult {
    if (!dlls || !dlls.length) {
        return null;
    }

    const envLong = getEnvName(isProd, true);

    let normalizedDlls: (string | DllEntry)[];
    if (Array.isArray(dlls)) {
        normalizedDlls = dlls;
    } else {
        normalizedDlls = [dlls];
    }

    const dllEntries: DllEntry[] = [];
    const fileDependencies: string[] = [];
    normalizedDlls.map((e: string | DllEntry) => {
        if (typeof e === 'string') {
            return {
                entry: e
            };
        }
        return e;
    }).filter((e: DllEntry) =>
        e &&
        e.entry &&
        e.entry.length)
        .forEach((e: DllEntry) => {
            const entries = Array.isArray(e.entry) ? e.entry : [e.entry];
            entries.forEach((entryStr: string) => {
                const parsedEntry = parseDllEntryValue(baseDir, entryStr, envLong);
                if (parsedEntry.fileDependency) {
                    fileDependencies.push(parsedEntry.fileDependency);
                }
                dllEntries.push(Object.assign(e, { entry: parsedEntry.entry }));
            });
        });
    return {
        entries: dllEntries,
        fileDependencies: fileDependencies
    };
}

function parseDllEntryValue(baseDir: string, entryValue: string, env: string): DllSingleEntryParsedResult {
    const dllPath = path.resolve(baseDir, entryValue);
    if (fs.existsSync(dllPath) && fs.statSync(dllPath).isFile()) {
        if (dllPath.match(/\.(js|ts)$/i)) {
            const data = require(dllPath);
            if (data && data.default && typeof data.default === 'function') {
                const dataArray = data.default(env);
                if (Array.isArray(dataArray)) {
                    return {
                        entry: dataArray,
                        fileDependency: dllPath
                    };
                } else {
                    throw new Error(`Invalid value in dlls, file: ${dllPath}.`);
                }
            }
            if (data && typeof data === 'function') {
                const dataArray = data(env);
                if (Array.isArray(dataArray)) {
                    return {
                        entry: dataArray,
                        fileDependency: dllPath
                    };
                } else {
                    throw new Error(`Invalid value in dlls, file: ${dllPath}.`);
                }
            }
            if (Array.isArray(data)) {
                return {
                    entry: data,
                    fileDependency: dllPath
                };
            } else {
                // For
                // import 'core-js' etc..
                return {
                    entry: [entryValue]
                };
            }
        }

    } else {
        // For
        // import 'core-js' etc..
        return {
            entry: [entryValue]
        };
    }
    throw new Error(`Invalid value in dlls.`);
}

// Ref: https://github.com/angular/angular-cli
export function packageChunkSort(packages: string[]) {
    return (left: any, right: any) => {
        const leftIndex = packages.indexOf(left.names[0]);
        const rightindex = packages.indexOf(right.names[0]);

        if (leftIndex < 0 || rightindex < 0) {
            // Unknown packages are loaded last
            return 1;
        }

        if (leftIndex > rightindex) {
            return 1;
        }

        return -1;
    };
}

export function isWebpackDevServer(): boolean {
    return process.argv[1] && !!(/webpack-dev-server/.exec(process.argv[1]));
}

export function hasProdArg(): boolean {
    return (process.env.ASPNETCORE_ENVIRONMENT && process.env.ASPNETCORE_ENVIRONMENT.toLowerCase() === 'production') ||
        process.argv.indexOf('--env.prod') > -1 ||
        process.argv.indexOf('--env.production') > -1 ||
        process.argv.indexOf('--env.Production') > -1 ||
        (process.env.NODE_ENV &&
            (process.env.NODE_ENV.toLowerCase() === 'prod' ||
                process.env.NODE_ENV.toLowerCase() === 'production'));
}

export function getEnvName(isProd: boolean, longName?: boolean): string {
    return longName ? isProd ? 'production' : 'development' : isProd ? 'prod' : 'dev';
}

export function isDllBuildFromNpmEvent(eventName?: string): boolean {
    const lcEvent = process.env.npm_lifecycle_event;
    if (!lcEvent) {
        return false;
    }

    if (eventName) {
        return lcEvent.includes(eventName);
    } else {
        return lcEvent.includes(':dll') ||
            lcEvent.includes('-dll') ||
            lcEvent === 'dll';
    }
}

export function isAoTBuildFromNpmEvent(eventName?: string): boolean {
    const lcEvent = process.env.npm_lifecycle_event;
    if (!lcEvent) {
        return false;
    }

    if (eventName) {
        return lcEvent.includes(eventName);
    } else {
        return lcEvent.includes(':aot') ||
            lcEvent.includes('-aot') ||
            lcEvent === 'aot';
    }
}


//export function findNpmScriptCommandName(baseDir: string, keyFilter: RegExp, valueFilter?: RegExp): string {
//  let pkgConfigPath = path.resolve(baseDir, 'package.json');
//  if (!fs.existsSync(pkgConfigPath)) {
//    pkgConfigPath = path.resolve(baseDir, '../package.json');
//  }
//  if (!fs.existsSync(pkgConfigPath)) {
//    return null;
//  }

//  const pkgConfig = readJsonSync(pkgConfigPath);
//  if (!pkgConfig.scripts) {
//    return null;
//  }
//  const foundKey = Object.keys(pkgConfig.scripts).find((key: string) => {
//    return keyFilter.test(key) && (!valueFilter || (valueFilter && valueFilter.test(pkgConfig.scripts[key])));
//  });

//  return foundKey;
//}

//export function tryBuildDll(manifestFiles: string[], debug: boolean, baseDir: string, command?: string, commandArgs?: string[]): void {
//  try {
//    manifestFiles
//      .forEach((manifestFile: string) => {
//        fs.accessSync(manifestFile);
//      });
//  } catch (err) {

//    if (!command) {
//      const npmScriptName = findNpmScriptCommandName(baseDir, /(dll([:\-]build)?)|((build[:\-])?dll)/i, /\s*webpack\s*/i);
//      if (npmScriptName) {
//        // 'npm', ['run', 'build:dll']
//        command = 'npm';
//        commandArgs = ['run', npmScriptName];
//      } else {
//        let webpackConfigFile = null;
//        if (fs.existsSync(path.resolve(baseDir, 'webpack.config.dll.js'))) {
//          webpackConfigFile = 'webpack.config.dll.js';
//        } else if (fs.existsSync(path.resolve(baseDir, 'webpack.dll.js'))) {
//          webpackConfigFile = 'webpack.dll.js';
//        } else if (fs.existsSync(path.resolve(baseDir, 'webpackfile.dll.js'))) {
//          webpackConfigFile = 'webpackfile.dll.js';
//        } else if (fs.existsSync(path.resolve(baseDir, 'webpack.config.vendor.js'))) {
//          webpackConfigFile = 'webpack.config.vendor.js';
//        } else if (fs.existsSync(path.resolve(baseDir, 'webpack.vendor.js'))) {
//          webpackConfigFile = 'webpack.vendor.js';
//        } else if (fs.existsSync(path.resolve(baseDir, 'webpackfile.vendor.js'))) {
//          webpackConfigFile = 'webpackfile.vendor.js';
//        } else if (fs.existsSync(path.resolve(baseDir, 'webpack.config.dll.ts'))) {
//          webpackConfigFile = 'webpack.config.dll.ts';
//        } else if (fs.existsSync(path.resolve(baseDir, 'webpack.dll.ts'))) {
//          webpackConfigFile = 'webpack.dll.ts';
//        } else if (fs.existsSync(path.resolve(baseDir, 'webpackfile.dll.ts'))) {
//          webpackConfigFile = 'webpackfile.dll.ts';
//        } else if (fs.existsSync(path.resolve(baseDir, 'webpack.config.vendor.ts'))) {
//          webpackConfigFile = 'webpack.config.vendor.ts';
//        } else if (fs.existsSync(path.resolve(baseDir, 'webpack.vendor.ts'))) {
//          webpackConfigFile = 'webpack.vendor.ts';
//        } else if (fs.existsSync(path.resolve(baseDir, 'webpackfile.vendor.ts'))) {
//          webpackConfigFile = 'webpackfile.vendor.ts';
//        }

//        if (webpackConfigFile) {
//          command = 'node';
//          const env = debug ? '--env.dev' : '--env.prod';
//          commandArgs = ['node_modules/webpack/bin/webpack.js', '--config', webpackConfigFile, env];
//        }

//      }
//    }

//    tryToSpawn(command, commandArgs);
//  }
//}

//export function tryToSpawn(command: string, commandArgs: string[]) {
//  const spawn: any = require('cross-spawn');
//  spawn.sync(command, commandArgs, { stdio: 'inherit' });
//  return;
//}

// Ref: https://github.com/AngularClass/angular2-webpack-starter