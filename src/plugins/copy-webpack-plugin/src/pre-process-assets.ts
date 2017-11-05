import * as path from 'path';

import { InternalError } from '../../../models';
import { isGlob, normalizeRelativePath } from '../../../utils';

export type PreProcessedAssetEntry = {
    context: string;
    from: {
        glob: string;
        dot?: boolean;
    } | string;
    to?: string;
    exclude?: string[];

    fromIsDir: boolean;
    fromDir?: string;
    fromIsAbsolute?: boolean;
    toIsDir?: boolean;
    toIsTemplate?: boolean;
    flatten?: boolean;
};

// https://www.debuggex.com/r/VH2yS2mvJOitiyr3
const isTemplateLike = /(\[ext\])|(\[name\])|(\[path\])|(\[folder\])|(\[emoji(:\d+)?\])|(\[(\w+:)?hash(:\w+)?(:\d+)?\])|(\[\d+\])/;

export async function preProcessAssets(baseDir: string,
    assetEntries: string | (string | { from: string; to?: string; flatten?: boolean; })[],
    inputFileSystem: any = require('fs')):
    Promise<PreProcessedAssetEntry[]> {
    if (!assetEntries || !assetEntries.length) {
        return [];
    }

    const entries = Array.isArray(assetEntries) ? assetEntries : [assetEntries];
    const clonedEntries = entries.map((entry: any) =>
        typeof entry === 'object' ? JSON.parse(JSON.stringify(entry)) : entry
    );

    const isDirectory = (p: string): Promise<boolean> => {
        if (typeof inputFileSystem.exists === 'function') {
            return new Promise<boolean>((resolve) => {
                inputFileSystem.exists(p,
                    (exists: boolean) => {
                        if (!exists) {
                            return resolve(false);
                        }

                        inputFileSystem.stat(p,
                            (statError: Error, statResult: any) => {
                                return resolve(statError ? false : statResult.isDirectory());
                            });
                    });
            });
        }

        return new Promise<boolean>((resolve) => {
            inputFileSystem.stat(p,
                (statError: Error, statResult: any) => {
                    return resolve(statError ? false : statResult.isDirectory());
                });
        });
    };
    return Promise.all(clonedEntries.map(async (asset: string | { from: string; to?: string }) => {
        if (typeof asset === 'string') {
            const isGlobPattern = asset.lastIndexOf('*') > -1 || isGlob(asset);
            let isDir = false;
            if (!isGlobPattern) {
                const tempFromPath = path.isAbsolute(asset) ? asset : path.resolve(baseDir, asset);
                isDir = /\\|\/$/.test(asset) || await isDirectory(tempFromPath);
            }

            if (!isGlobPattern && !isDir && path.isAbsolute(asset)) {
                return {
                    from: path.resolve(asset),
                    fromIsAbsolute: true,
                    fromIsDir: false,
                    context: baseDir
                };
            } else {
                const fromGlob = isDir ? normalizeRelativePath(path.join(asset, '**/*')) : asset;
                return {
                    from: {
                        glob: fromGlob,
                        dot: true
                    },
                    fromIsDir: isDir,
                    fromDir: isDir
                        ? path.isAbsolute(asset)
                            ? path.resolve(asset)
                            : path.resolve(baseDir, asset)
                        : undefined,
                    context: baseDir
                };
            }
        } else if (typeof asset === 'object' &&
            (asset as {
                from: string |
                {
                    glob: string;
                    dot?: boolean;
                };
                to?: string;
            }).from) {

            const assetParsedEntry: PreProcessedAssetEntry =
                Object.assign({}, asset, { context: baseDir, fromIsDir: false });

            if (assetParsedEntry.to) {
                if (isTemplateLike.test(assetParsedEntry.to)) {
                    assetParsedEntry.toIsTemplate = true;
                } else if (/\\|\/$/.test(assetParsedEntry.to)) {
                    assetParsedEntry.toIsDir = true;
                }
            }

            const from = (asset as { from: string; to?: string }).from;
            if (typeof from === 'string') {
                const isGlobPattern = from.lastIndexOf('*') > -1 || isGlob(from);
                let isDir = false;
                if (!isGlobPattern) {
                    const tempFromPath = path.isAbsolute(from) ? from : path.resolve(baseDir, from);
                    isDir = /\\|\/$/.test(from) || await isDirectory(tempFromPath);
                }


                if (!isGlobPattern && !isDir && path.isAbsolute(from)) {
                    assetParsedEntry.from = path.resolve(from);
                    assetParsedEntry.fromIsAbsolute = true;
                    assetParsedEntry.fromIsDir = false;
                } else {
                    const fromGlob = isDir ? normalizeRelativePath(path.join(from, '**/*')) : from;
                    assetParsedEntry.from = {
                        glob: fromGlob,
                        dot: true
                    };

                    if (isDir) {
                        assetParsedEntry.fromIsDir = true;
                        assetParsedEntry.fromDir =
                            path.isAbsolute(from) ? path.resolve(from) : path.resolve(baseDir, from);
                    }
                }
            }
            return assetParsedEntry;
        } else {
            throw new InternalError('Invalid assets entry.');
        }
    }));
}
