import * as fs from 'fs-extra';
import * as path from 'path';
import * as resolve from 'resolve';

import { DllEntry } from '../models';

export type DllParsedEntry = {
    tsPath?: string;
} & DllEntry;

export function parseDllEntry(projectRoot: string,
    appRootName: string,
    dlls: string | (string | DllEntry)[],
    env: { [key: string]: any }): DllParsedEntry[] {
    const resultEntries: DllParsedEntry[] = [];

    if (!dlls || !dlls.length) {
        return resultEntries;
    }

    let clonedDlls: (string | DllEntry)[];
    if (Array.isArray(dlls)) {
        clonedDlls = JSON.parse(JSON.stringify(dlls));

    } else {
        clonedDlls = [JSON.parse(JSON.stringify(dlls))];
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
                    // const source = fs.readFileSync(dllPath).toString();
                    // const result = ts
                    //    .transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } });
                    // const dataArray = evalContent(result.outputText, env, dllPath);

                    let dllModule: any;
                    try {
                        dllModule = require(appDllPath);
                    } catch (err) {
                        if (entryName.match(/\.ts$/i)) {
                            resultEntries.push(Object.assign({}, dllEntry, { entry: null, tsPath: appDllPath }));
                            return;
                        } else {
                            throw new Error(`Error in parsing dll entry. Invalid entry: ${entryName}.`);
                        }
                    }

                    // appDllPath
                    const entryArray = getArrayFromDllModule(dllModule, env);
                    if (!entryArray || !entryArray.length) {
                        if (entryName.match(/\.ts$/i)) {
                            resultEntries.push(Object.assign({}, dllEntry, { entry: null, tsPath: appDllPath }));
                            return;
                        } else {
                            throw new Error(`Error in parsing dll entry. Invalid entry: ${entryName}.`);
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
                        throw new Error(`Error in parsing dll entry. No entry parsed. file: ${packagePath}.`);
                    }
                } else {
                    throw new Error(`Error in parsing dll entry. Invalid entry: ${entryName}.`);
                }
            });
        });

    return resultEntries;
}

function getRootModuleName(projectRoot: string, name: string, existingArray: string[]): string {
    if (name.indexOf('/') > 0 && !name.startsWith('@')) {
        const moduleName = name.substr(0, name.indexOf('/'));
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

function getArrayFromDllModule(dllModule: any, env: { [key: string]: any }): string[] {
    if (!dllModule) {
        return [];
    }

    if (dllModule && dllModule.default && typeof dllModule.default === 'function') {
        const dataArray = dllModule.default(env);
        if (Array.isArray(dataArray) && dataArray.length > 0) {
            return dataArray;
        } else {
            return [];
        }
    }
    if (dllModule && typeof dllModule === 'function') {
        const dataArray = dllModule(env);
        if (Array.isArray(dataArray) && dataArray.length > 0) {
            return dataArray;
        } else {
            return [];
        }
    }
    if (Array.isArray(dllModule) && dllModule.length > 0) {
        return dllModule;
    } else {
        return [];
    }
}
