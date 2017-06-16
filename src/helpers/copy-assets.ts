import * as fs from 'fs-extra';
import * as path from 'path';

import { AssetEntry } from '../models';
import { globPromise } from '../utils';

import { parseAssetEntry, AssetParsedEntry } from './parse-asset-entry';

export async function copyAssets(baseDir: string, outDir: string, assetEntries: string | (string | AssetEntry)[]): Promise<void> {
    const parsedAssetEntries = parseAssetEntry(baseDir, assetEntries);

    await Promise.all(parsedAssetEntries.map(async (assetEntry: AssetParsedEntry) => {
        if (typeof assetEntry.from === 'string') {
            const absoluteFrom = path.resolve(assetEntry.from);
            const relativeFrom = path.relative(baseDir, absoluteFrom);
            const dest = path.resolve(outDir, assetEntry.to || relativeFrom);
            await fs.copy(absoluteFrom, dest);

        } else {
            const relativePaths = await globPromise((assetEntry.from as {
                    glob: string;
                    dot?: boolean;
                }).glob,
                { cwd: baseDir, nodir: true, dot: true });

            await Promise.all(relativePaths.map(async (relativeFrom) => {
                const absoluteFrom = path.resolve(baseDir, relativeFrom);
                const dest = path.resolve(outDir, assetEntry.to || relativeFrom);
                await fs.copy(absoluteFrom, dest);
            }));
        }
    }));
}
