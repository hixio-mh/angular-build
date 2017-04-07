import * as path from 'path';
import * as fs from 'fs';
import * as resolve from 'resolve';
//import * as vm from 'vm';
//import * as ts from 'typescript';
//const requireLike = require('require-like');

import { DllEntry, GlobalScopedEntry, AssetEntry, AppConfig } from './models';
import {IconPluginOptions} from './plugins/icon-webpack-plugin';

// Utils
import { readJsonSync } from './utils';

// Dlls
//
export type DllTsEntry = {
    tsPath?: string;
}

export function parseDllEntries(projectRoot: string, appRootName: string, dlls: string | (string | DllEntry)[], env: { [key: string]: string }): (DllEntry & DllTsEntry)[] {
    const resultEntries: (DllEntry & DllTsEntry)[] = [];

    if (!dlls || !dlls.length) {
        return resultEntries;
    }

    let clonedDlls: (string | DllEntry)[];
    if (Array.isArray(dlls)) {
        clonedDlls = dlls.map((entry: any) => {
            return typeof entry === 'object' ? Object.assign({ entry: null }, entry) : entry;
        });

    } else {
        clonedDlls = typeof dlls === 'object' ? [Object.assign({ entry: null }, dlls)] : [dlls];
    }

    const filteredDllEntries = clonedDlls.map((e: string | DllEntry) => {
        if (typeof e === 'string') {
            return {
                entry: e
            };
        }
        return e;
    }).filter((e: DllEntry) =>
        e &&
        e.entry &&
        e.entry.length);

    if (!filteredDllEntries || filteredDllEntries.length === 0) {
        return resultEntries;
    }

    const parsedModules: string[] = [];
    const appRoot = path.resolve(projectRoot, appRootName);

    filteredDllEntries
        .filter((dllEntry: DllEntry) => dllEntry.entry && dllEntry.entry.length)
        .forEach((dllEntry: DllEntry) => {
            const entries = Array.isArray(dllEntry.entry) ? dllEntry.entry.slice() : [dllEntry.entry];
            entries.filter((entryName: string) => !entryName.match(/package\.json/i)).forEach((entryName: string) => {
                const appDllPath = path.resolve(appRoot, entryName);
                if (entryName.match(/\.(ts|js)$/i) && fs.existsSync(appDllPath) && fs.statSync(appDllPath).isFile()) {
                    //const source = fs.readFileSync(dllPath).toString();
                    //const result = ts
                    //    .transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } });
                    //const dataArray = evalContent(result.outputText, env, dllPath);

                    let dllModule: any;
                    try {
                        dllModule = require(appDllPath);
                    } catch (err) {
                        if (entryName.match(/\.ts$/i)) {
                            resultEntries.push(Object.assign({}, dllEntry, { entry: null, tsPath: appDllPath }));
                            return;
                        } else {
                            console.error(`Error in parsing dll entry. Invalid entry: ${entryName}\n`);
                            throw err;
                        }
                    }

                    // appDllPath
                    const entryArray = getArrayFromDllModule(dllModule, env);
                    if (!entryArray || !entryArray.length) {
                        if (entryName.match(/\.ts$/i)) {
                            resultEntries.push(Object.assign({}, dllEntry, { entry: null, tsPath: appDllPath }));
                            return;
                        } else {
                            throw new Error(`Error in parsing dll entry. Invalid entry: ${entryName}\n`);
                        }
                    }

                    entryArray.forEach((name: string) => {
                        const moduleName = getRootModuleName(projectRoot, name, parsedModules);
                        if (parsedModules.indexOf(moduleName) === -1) {
                            parsedModules.push(moduleName);
                        }
                    });

                    resultEntries.push(Object.assign({}, dllEntry, { entry: entryArray }));
                } else {
                    resultEntries.push(Object.assign({}, dllEntry, { entry: entryName }));

                    const moduleName = getRootModuleName(projectRoot, entryName, parsedModules);
                    if (parsedModules.indexOf(moduleName) === -1) {
                        parsedModules.push(moduleName);
                    }
                }
            });
        });


    filteredDllEntries
        .filter((dllEntry: DllEntry) => dllEntry.entry && dllEntry.entry.length)
        .forEach((dllEntry: DllEntry) => {
            const entries = Array.isArray(dllEntry.entry) ? dllEntry.entry.slice() : [dllEntry.entry];
            entries.filter((entryName: string) => entryName.match(/package\.json/i)).forEach((entryName: string) => {
                const packagePath = path.resolve(appRoot, entryName);
                if (fs.existsSync(packagePath) && fs.statSync(packagePath).isFile()) {
                    const pkgConfig: any = require(packagePath);
                    const deps: any = pkgConfig.dependencies || {};
                    const excludes = dllEntry.excludes || [];
                    const entryArray: string[] = [];
                    Object.keys(deps)
                        .filter((key: string) => excludes
                            .indexOf(key) ===
                            -1 &&
                            parsedModules.indexOf(key) === -1)
                        .forEach((key: string) => {
                            entryArray.push(key);
                        });
                    if (entryArray.length > 0) {
                        resultEntries.push(Object.assign({}, dllEntry, { entry: entryArray }));
                    } else {
                        throw new Error(`Error in parsing dll entry. No entry parsed. file: ${packagePath}`);
                    }
                } else {
                    throw new Error(`Error in parsing dll entry. Invalid entry: ${entryName}`);
                }
            });
        });

    return resultEntries;
}

function getRootModuleName(projectRoot: string, name: string, existingArray: string[]): string {
    if (name.indexOf('/') > 0 && !name.startsWith('@')) {
        const moduleName = name.substring(0, name.indexOf('/'));
        if (existingArray.indexOf(moduleName) === -1) {
            try {
                resolve.sync(moduleName, { basedir: projectRoot });
                return moduleName;

            } catch (err) {
                return name;
            }
        } else {
            return moduleName;
        }
    }
    return name;
}

function getArrayFromDllModule(dllModule: any, env: { [key: string]: string }): string[] {
    if (!dllModule) {
        return null;
    }

    if (dllModule && dllModule.default && typeof dllModule.default === 'function') {
        const dataArray = dllModule.default(env);
        if (Array.isArray(dataArray) && dataArray.length > 0) {
            return dataArray;
        } else {
            return null;
        }
    }
    if (dllModule && typeof dllModule === 'function') {
        const dataArray = dllModule(env);
        if (Array.isArray(dataArray) && dataArray.length > 0) {
            return dataArray;
        } else {
            return null;
        }
    }
    if (Array.isArray(dllModule) && dllModule.length > 0) {
        return dllModule;
    } else {
        return null;
    }
}

export function getWebpackStatsConfig(verbose = false) {
    return {
        //modules: true,
        colors: true,
        hash: true,
        timings: true,
        errors: true,
        errorDetails: true,
        warnings: true,
        assets: true, //buildOptions.debug,

        version: verbose,
        publicPath: verbose,
        reasons: verbose,
        chunkModules: verbose,
        modules: verbose,
        // listing all children is very noisy in AOT and hides warnings/errors
        children: verbose,
        // make sure 'chunks' is false or it will add 5-10 seconds to your build and incremental build time, due to excessive output.
        chunks: verbose
    };
}

//function evalContent(content: string){
//    const sandbox: any = {};
//    const exports = {};
//    sandbox.require = requireLike(module.parent.filename);
//    sandbox.exports = exports;
//    sandbox.module = {
//        exports: exports,
//        filename: module.parent.filename,
//        id: module.parent.filename,
//        parent: module.parent,
//        require: sandbox.require || requireLike(module.parent.filename)
//    };
//    sandbox.global = sandbox;
//    const options: any = {
//        filename: null,
//        displayErrors: true
//    }

//    const script = new vm.Script(content, options);
//    script.runInNewContext(sandbox, options);
//    const data = sandbox.module.exports;
//    return data;
//}

// Assets
//
export function parseCopyAssetEntry(baseDir: string, assetEntries: string | (string | AssetEntry)[]) {

    if (!assetEntries || !assetEntries.length) {
        return <any>[];
    }

    let clonedEntries: (string | AssetEntry)[];
    if (Array.isArray(assetEntries)) {
        clonedEntries = assetEntries.map((entry: any) => {
            return typeof entry === 'object' ? Object.assign({}, entry) : entry;
        });

    } else {
        clonedEntries = typeof assetEntries === 'object'
            ? [Object.assign({ from: null }, assetEntries)]
            : [assetEntries];
    }

    const prepareFormGlobFn = (p: string) => {
        if (!p) {
            return '';
        }

        if (p.lastIndexOf('*') === -1 && !path.isAbsolute(p) &&
            fs.existsSync(path.resolve(baseDir, p)) &&
            fs.statSync(path.resolve(baseDir, p)).isDirectory()) {
            if (p.lastIndexOf('/') > -1) {
                p = p.substring(0, p.length - 1);
            }
            p += '/**/*';
        }
        return p;
    };

    return clonedEntries.map((asset: string | AssetEntry) => {
        if (typeof asset === 'string') {
            const fromGlob = prepareFormGlobFn(asset);
            return {
                from: {
                    glob: fromGlob,
                    dot: true
                },
                context: baseDir
            };
        } else if (typeof asset === 'object' && (<any>asset).from) {
            if (!(<any>asset).context) {
                (<any>asset).context = baseDir;
            }
            if (typeof (<any>asset).from === 'string') {
                const fromGlob = prepareFormGlobFn((<any>asset).from);
                (<any>asset).from = {
                    glob: fromGlob,
                    dot: true
                };
            }
            //if (!asset.to && (<any>asset).output) {
            //    asset.to = (<any>asset).output;
            //}
            return asset;
        }
        //else if (typeof asset === 'object' && (<any>asset).input) {
        //    if (!(<any>asset).context) {
        //        (<any>asset).context = baseDir;
        //    }
        //    const fromGlob = prepareFormGlobFn((<any>asset).input);
        //    asset.from = {
        //        glob: fromGlob,
        //        dot: true
        //    };
        //    if (!asset.to && (<any>asset).output) {
        //        asset.to = (<any>asset).output;
        //    }
        //    return asset;
        //}
        //else if (typeof asset === 'object' && (<any>asset).glob) {
        //    if (!(<any>asset).context) {
        //        (<any>asset).context = baseDir;
        //    }
        //    asset.from = {
        //        glob: (<any>asset).glob,
        //        dot: true
        //    };
        //    if (!asset.to && (<any>asset).output) {
        //        asset.to = (<any>asset).output;
        //    }
        //    return asset;
        //}
        else {
            throw new Error(`Invalid 'assets' value in appConfig.`);
        }
    });
}

// Styles/scripts
// convert all extra entries into the object representation, fill in defaults
// Ref: https://github.com/angular/angular-cli
export function parseGlobalScopedEntry(
    extraEntries: string | (string | GlobalScopedEntry)[],
    appRoot: string,
    defaultEntry: string
): (GlobalScopedEntry & { path?: string; entry?: string; })[] {
    if (!extraEntries || !extraEntries.length) {
        return [];
    }
    //const arrayEntries = Array.isArray(extraEntries) ? extraEntries : [extraEntries];
    let clonedEntries: (string | GlobalScopedEntry)[];
    if (Array.isArray(extraEntries)) {
        clonedEntries = extraEntries.map((entry: any) => {
            return typeof entry === 'object' ? Object.assign({}, entry) : entry;
        });

    } else {
        clonedEntries = typeof extraEntries === 'object' ? [Object.assign({ input: null }, extraEntries)] : [extraEntries];
    }

    return clonedEntries
        .map((extraEntry: string | GlobalScopedEntry) =>
            typeof extraEntry === 'string' ? { input: extraEntry } : extraEntry)
        .map((extraEntry: GlobalScopedEntry & {path?:string;entry?:string;}) => {
            extraEntry.path = path.resolve(appRoot, extraEntry.input);
            if (extraEntry.output) {
                extraEntry.entry = extraEntry.output.replace(/\.(js|css)$/i, '');
            } else if (extraEntry.lazy) {
                extraEntry.entry = extraEntry.input.replace(/\.(js|css|scss|sass|less|styl)$/i, '');
            } else {
                extraEntry.entry = defaultEntry;
            }
            return extraEntry;
        });
}

// Filter extra entries out of a arran of extraEntries
export function lazyChunksFilter(extraEntries: (GlobalScopedEntry & { path?: string; entry?: string; })[]) {
    return extraEntries
        .filter(extraEntry => extraEntry.lazy)
        .map(extraEntry => extraEntry.entry);
}

// Package sort
//
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

// Misc.
export function isWebpackDevServer(): boolean {
    return process.argv[1] && !!(/webpack-dev-server/.exec(process.argv[1]));
}

export function hasProdFlag(): boolean {
    const hasFlag = (process.env.ASPNETCORE_ENVIRONMENT &&
            process.env.ASPNETCORE_ENVIRONMENT.toLowerCase() === 'production') ||
        process.argv.indexOf('--env.prod') > -1 ||
        process.argv.indexOf('--env.production') > -1 ||
        process.argv.indexOf('--env.Production') > -1 ||
        (process.argv.indexOf('--prod') > -1 && process.argv[process.argv.indexOf('--prod')] !== 'false') ||
        (process.argv.indexOf('--production') > -1 && process.argv[process.argv.indexOf('--production')] !== 'false') ||
        (process.argv.indexOf('--Production') > -1 && process.argv[process.argv.indexOf('--Production')] !== 'false') ||
        (process.env.NODE_ENV &&
        (process.env.NODE_ENV.toLowerCase() === 'prod' ||
            process.env.NODE_ENV.toLowerCase() === 'production'));
    return typeof hasFlag === 'undefined' ? false : hasFlag;
}

export function hasDevFlag(): boolean {
    const hasFlag = (process.env.ASPNETCORE_ENVIRONMENT &&
        process.env.ASPNETCORE_ENVIRONMENT.toLowerCase() === 'development') ||
        process.argv.indexOf('--env.dev') > -1 ||
        process.argv.indexOf('--env.development') > -1 ||
        process.argv.indexOf('--env.Development') > -1 ||
        (process.argv.indexOf('--dev') > -1 && process.argv[process.argv.indexOf('--dev')] === 'true') ||
        (process.argv.indexOf('--development') > -1 && process.argv[process.argv.indexOf('--development')] === 'true') ||
        (process.argv.indexOf('--Development') > -1 && process.argv[process.argv.indexOf('--Development')] === 'true') ||
        (process.env.NODE_ENV &&
            (process.env.NODE_ENV.toLowerCase() === 'dev' ||
                process.env.NODE_ENV.toLowerCase() === 'development'));
    return typeof hasFlag === 'undefined' ? false : hasFlag;
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

export function isUniversalBuildFromNpmEvent(eventName?: string): boolean {
    const lcEvent = process.env.npm_lifecycle_event;
    if (!lcEvent) {
        return false;
    }

    if (eventName) {
        return lcEvent.includes(eventName);
    } else {
        return lcEvent.includes(':universal') ||
            lcEvent.includes('-universal') ||
            lcEvent === 'universal';
    }
}

export function isTestBuildFromNpmEvent(eventName?: string): boolean {
    const lcEvent = process.env.npm_lifecycle_event;
    if (!lcEvent) {
        return false;
    }

    if (eventName) {
        return lcEvent.includes(eventName);
    } else {
        return lcEvent.includes(':test') ||
            lcEvent.includes('-test') ||
            lcEvent === 'test';
    }
}

export function getIconOptions(projectRoot: string, appConfig: AppConfig) {
    const appRoot = path.resolve(projectRoot, appConfig.root);
    const hashFormat = appConfig.appendOutputHash ? `-[hash` : '';

    let iconOptions: IconPluginOptions = null;

    if (typeof appConfig.faviconConfig === 'string' && appConfig.faviconConfig.match(/\.json$/i)) {
        let iconConfigPath = path.resolve(appRoot, appConfig.faviconConfig);
        if (!fs.existsSync(iconConfigPath)) {
            iconConfigPath = path.resolve(projectRoot, appConfig.faviconConfig);
        }
        if (fs.existsSync(iconConfigPath)) {
            iconOptions = readJsonSync(iconConfigPath);
        }
    }

    if (!iconOptions || !iconOptions.masterPicture) {
        return iconOptions;
    }

    iconOptions.masterPicture = path.resolve(appRoot, iconOptions.masterPicture);
    if (!fs.existsSync(iconOptions.masterPicture) && fs.existsSync(path.resolve(projectRoot, iconOptions.masterPicture))) {
        iconOptions.masterPicture = path.resolve(projectRoot, iconOptions.masterPicture);
    }

    if (!fs.existsSync(iconOptions.masterPicture)) {
        throw new Error(`Icon not found at ${iconOptions.masterPicture}`);
    }

    if (!iconOptions.iconsPath) {
        iconOptions.iconsPath = `icons${hashFormat}/`;
    }
    if (!iconOptions.statsFilename) {
        iconOptions.statsFilename = 'iconstats.json';
    }
    if (typeof iconOptions.emitStats === 'undefined') {
        iconOptions.emitStats = false;
    }

    return iconOptions;
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
