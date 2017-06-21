import * as fs from 'fs-extra';
import * as path from 'path';

import { AssetEntry } from '../models';
import { globPromise } from '../utils';

import { parseAssetEntry, AssetParsedEntry } from './parse-asset-entry';

export async function copyAssets(baseDir: string,
    outDir: string,
    assetEntries: string | (string | AssetEntry)[]): Promise<void> {
    const parsedAssetEntries = parseAssetEntry(baseDir, assetEntries);

    await Promise.all(parsedAssetEntries.map(async (assetEntry: AssetParsedEntry) => {
        if (typeof assetEntry.from === 'string') {
            // copy absolute file or directory
            const absoluteFromDir = path.resolve(assetEntry.from);
            let dest = path.resolve(outDir, path.basename(absoluteFromDir));
            if (assetEntry.to) {
                dest = path.isAbsolute(assetEntry.to) ? assetEntry.to : path.resolve(outDir, assetEntry.to);
            }
            await fs.copy(absoluteFromDir, dest);

        } else {
            const relativeFromPaths = await globPromise((assetEntry.from as {
                glob: string;
                dot?: boolean;
            }).glob,
                { cwd: baseDir, nodir: true, dot: true });

            await Promise.all(relativeFromPaths.map(async (relativeFrom) => {
                const absoluteFrom = path.resolve(baseDir, relativeFrom);

                let dest: string;
                // copy single file/dir
                if (relativeFromPaths.length === 1) {
                    if (assetEntry.to) {
                        if (path.isAbsolute(assetEntry.to)) {
                            dest = assetEntry.to;
                            if (/(\\|\/)$/.test(assetEntry.to) &&
                                await fs.exists(absoluteFrom) &&
                                (await fs.stat(absoluteFrom)).isFile()) {
                                dest = path.resolve(assetEntry.to, path.basename(absoluteFrom));
                            }
                        } else {
                            dest = path.resolve(outDir, assetEntry.to);
                            if (/(\\|\/)$/.test(assetEntry.to) &&
                                await fs.exists(absoluteFrom) &&
                                (await fs.stat(absoluteFrom)).isFile()) {
                                dest = path.resolve(outDir, assetEntry.to, path.basename(absoluteFrom));
                            }
                        }
                    } else {
                        dest = path.resolve(outDir, path.basename(absoluteFrom));
                    }
                } else {
                    if (assetEntry.to) {
                        if (path.isAbsolute(assetEntry.to)) {
                            dest = path.resolve(assetEntry.to, path.basename(absoluteFrom));
                        } else {
                            dest = path.resolve(outDir, assetEntry.to, path.basename(absoluteFrom));
                        }
                    } else {
                        dest = path.resolve(outDir, path.basename(absoluteFrom));
                    }
                }
                await fs.copy(absoluteFrom, dest);
            }));
        }
    }));
}
