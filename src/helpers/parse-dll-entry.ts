import { existsSync, statSync } from 'fs';
import * as path from 'path';

import { DllOptions, DllParsedResult, InvalidConfigError } from '../models';
import { readJsonSync } from '../utils/read-json';

export function parseDllEntries(srcDir: string,
    inputs: string | DllOptions | string[], checkFileExists?: boolean): DllParsedResult {
    const result: DllParsedResult = {
        tsEntries: [],
        scriptEntries: [],
        styleEntries: []
    };

    if (!inputs ||
        (Array.isArray(inputs) && !inputs.length) ||
        (typeof inputs === 'object' && !Object.keys(inputs).length)) {
        return result;
    }

    const dllEntries: string[] = [];
    const packageJsonEntries: string[] = [];
    const excludes: string[] = [];
    if (Array.isArray(inputs)) {
        (inputs as string[]).forEach(e => {
            if (/(\/|\\)?package\.json$/i.test(e)) {
                if (!packageJsonEntries.includes(e)) {
                    packageJsonEntries.push(e);
                }
            } else {
                if (!dllEntries.includes(e)) {
                    dllEntries.push(e);
                }
            }
        });
    } else if (typeof inputs === 'string') {
        const e = inputs as string;
        if (/(\/|\\)?package\.json$/i.test(e)) {
            if (e && e.length && !packageJsonEntries.includes(e)) {
                packageJsonEntries.push(e);
            }
        } else {
            if (e && e.length && !dllEntries.includes(e)) {
                dllEntries.push(e);
            }
        }
    } else if (typeof inputs === 'object') {
        const dllOptions = inputs as DllOptions;
        if (dllOptions.exclude) {
            dllOptions.exclude.forEach(e => {
                if (e && e.length && !excludes.includes(e)) {
                    excludes.push(e);
                }
            });
        }
        if (dllOptions.entry && dllOptions.entry.length) {
            if (Array.isArray(dllOptions.entry)) {
                (dllOptions.entry as string[]).forEach(e => {
                    if (/(\/|\\)?package\.json$/i.test(e)) {
                        if (e && e.length && !packageJsonEntries.includes(e)) {
                            packageJsonEntries.push(e);
                        }
                    } else {
                        if (e && e.length && !dllEntries.includes(e) && !excludes.includes(e)) {
                            dllEntries.push(e);
                        }
                    }
                });
            } else if (typeof dllOptions.entry === 'string') {
                const e = dllOptions.entry as string;
                if (/(\/|\\)?package\.json$/i.test(e)) {
                    if (e && e.length && !packageJsonEntries.includes(e)) {
                        packageJsonEntries.push(e);
                    }
                } else {
                    if (e && e.length && !dllEntries.includes(e) && !excludes.includes(e)) {
                        dllEntries.push(e);
                    }
                }
            }
        }
    }

    if (!dllEntries.length && !packageJsonEntries.length) {
        return result;
    }

    dllEntries
        .forEach((e: string) => {
            const dllPathInSrcDir = path.resolve(srcDir, e);
            if (checkFileExists && !existsSync(dllPathInSrcDir)) {
                throw new InvalidConfigError(`Couldn't resolve dll entry, path: ${dllPathInSrcDir}.`);
            }

            if (e.match(/\.ts$/i) &&
                existsSync(dllPathInSrcDir) &&
                statSync(dllPathInSrcDir).isFile()) {
                if (!result.tsEntries.includes(dllPathInSrcDir)) {
                    result.tsEntries.push(dllPathInSrcDir);
                }
            } else {
                if (e.match(/\.(css|sass|scss|less|styl)$/i)) {
                    if (!result.styleEntries.includes(e)) {
                        result.styleEntries.push(e);
                    }
                } else {
                    if (!result.scriptEntries.includes(e)) {
                        result.scriptEntries.push(e);
                    }
                }
            }
        });
    packageJsonEntries
        .forEach((e: string) => {
            const packagePath = path.resolve(srcDir, e);
            if (existsSync(packagePath) && statSync(packagePath).isFile()) {
                const pkgConfig: any = readJsonSync(packagePath);
                const deps: any = pkgConfig.dependencies || {};
                const packageEntries: string[] = [];
                Object.keys(deps)
                    .filter((key: string) => !excludes.includes(key) &&
                        !key.startsWith('@types/') &&
                        !dllEntries.includes(key) &&
                        !packageEntries.includes(key))
                    .forEach((key: string) => {
                        packageEntries.push(key);
                    });
                if (packageEntries.length > 0) {
                    packageEntries.forEach((name: string) => {
                        if (!result.scriptEntries.includes(name)) {
                            result.scriptEntries.push(name);
                        }
                    });
                }
            } else {
                throw new InvalidConfigError(`Error in parsing dll entry, path doesn't exists, path: ${packagePath}.`);
            }
        });

    return result;
}
