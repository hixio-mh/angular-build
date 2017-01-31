import * as path from 'path';
import * as fs from 'fs';
import * as vm from 'vm';
import * as ts from 'typescript';

//var requireLike = require('require-like');

import { DllEntry } from './models';

// Dlls
export interface DllEntryParsedResult {
    entries: DllEntry[];
    fileDependencies?: string[];
}

export function parseDllEntries(baseDir: string, dlls: string | (string | DllEntry)[], isProd?: boolean): DllEntryParsedResult {
    if (!dlls || !dlls.length) {
        return null;
    }
    const env = getEnvName(isProd, true);
    let clonedDlls: (string | DllEntry)[];
    if (Array.isArray(dlls)) {
        clonedDlls = dlls.map((entry: any) => {
            return typeof entry === 'object' ? Object.assign({ entry: null }, entry) : entry;
        });

    } else {
        clonedDlls = typeof dlls === 'object' ? [Object.assign({entry: null}, dlls)] : [dlls];
    }

    const dllEntries: DllEntry[] = [];
    const fileDependencies: string[] = [];

    clonedDlls.map((e: string | DllEntry) => {
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
            entries.forEach((dllFileName: string) => {
                if (dllFileName.match(/\.ts$/i)) {
                    const dllPath = path.resolve(baseDir, dllFileName);
                    if (fs.existsSync(dllPath) && fs.statSync(dllPath).isFile()) {
                        const source = fs.readFileSync(dllPath).toString();
                        const result = ts
                            .transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } });
                        const dataArray = evalDllContent(result.outputText, env, dllPath);
                        dllEntries.push(Object.assign(e, { entry: dataArray ? dataArray : dllFileName }));
                    } else {
                        throw new Error(`Invalid value in dlls.`);
                    }
                } else if (dllFileName.match(/\.js$/i)) {
                    const dllPath = path.resolve(baseDir, dllFileName);
                    if (fs.existsSync(dllPath) && fs.statSync(dllPath).isFile()) {
                        const source = fs.readFileSync(dllPath).toString();
                        const dataArray = evalDllContent(source, env, dllPath);
                        dllEntries.push(Object.assign(e, { entry: dataArray ? dataArray : dllFileName }));
                    } else {
                        throw new Error(`Invalid value in dlls.`);
                    }
                } else {
                    const dllPath = path.resolve(baseDir, dllFileName);
                    if (fs.existsSync(dllPath) && fs.statSync(dllPath).isFile()) {
                        throw new Error(`Invalid value in dlls.`);
                    }
                    dllEntries.push(Object.assign(e, { entry: dllFileName }));
                }
            });
        });
    return {
      entries: dllEntries,
      fileDependencies: fileDependencies
    };
}

function evalDllContent(content: string, env: string, fileName: string) : string[] {
    const sandbox: any = {};
    const exports = {};
    //sandbox.require = requireLike(_filename);
    sandbox.exports = exports;
    sandbox.module = {
        exports: exports,
        filename: module.parent.filename,
        id: module.parent.filename,
        parent: module.parent
        //require: sandbox.require || requireLike(_filename)
    };
    sandbox.global = sandbox;
    const options: any = {
        filename: null,
        displayErrors: true
    }

    const script = new vm.Script(content, options);
    script.runInNewContext(sandbox, options);

    const data = sandbox.module.exports;
    if (data && data.default && typeof data.default === 'function') {
        const dataArray = data.default(env);
        if (Array.isArray(dataArray)) {
            return dataArray;
        } else {
            throw new Error(`Error in parsing dll entry, file: ${fileName}.`);
        }
    }
    if (data && typeof data === 'function') {
        const dataArray = data(env);
        if (Array.isArray(dataArray)) {
            return dataArray;
        } else {
            throw new Error(`Error in parsing dll entry, file: ${fileName}.`);
        }
    }
    if (Array.isArray(data)) {
        return data;
    } else {
        return null;
        //throw new Error(`Error in parsing dll entry, file: ${fileName}.`);
    }
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