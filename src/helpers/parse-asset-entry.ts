const fs = require('fs-extra');
import * as path from 'path';

import { AssetEntry } from '../models';

export type AssetParsedEntry = {
    from: {
        glob: string;
        dot?: boolean;
    } | string;
    context?: string;
    to?: string;
};

export function parseAssetEntry(baseDir: string, assetEntries: string | (string | AssetEntry)[]): AssetParsedEntry[] {
    if (!assetEntries || !assetEntries.length) {
        return [] as any;
    }

    const entries = Array.isArray(assetEntries) ? assetEntries : [assetEntries];
    const clonedEntries = entries.map((entry: any) =>
        typeof entry === 'object' ? JSON.parse(JSON.stringify(entry)) : entry
    );

    const prepareFromGlobFn = (p: string) => {
        if (!p) {
            return '';
        }

        if (p.lastIndexOf('*') === -1 &&
            !path.isAbsolute(p) &&
            fs.existsSync(path.resolve(baseDir, p)) &&
            fs.statSync(path.resolve(baseDir, p)).isDirectory()) {
            p = path.join(p, '**/*');
        }
        return p;
    };

    return clonedEntries.map((asset: string | AssetEntry) => {
        if (typeof asset === 'string') {
            if (path.isAbsolute(asset)) {
                return {
                    from: asset,
                    context: baseDir
                };
            }

            const fromGlob: string = prepareFromGlobFn(asset);
            return {
                from: {
                    glob: fromGlob,
                    dot: true
                },
                context: baseDir
            };
        } else if (typeof asset === 'object' && (asset as AssetEntry).from) {
            const assetParsedEntry: AssetParsedEntry = Object.assign({}, asset);
            if (!assetParsedEntry.context) {
                assetParsedEntry.context = baseDir;
            }
            const from = (asset as AssetEntry).from;
            if (typeof from === 'string') {
                if (path.isAbsolute(from)) {
                    assetParsedEntry.from = from;
                } else {
                    const fromGlob = prepareFromGlobFn(from);
                    assetParsedEntry.from = {
                        glob: fromGlob,
                        dot: true
                    };
                }
            }
            return assetParsedEntry;
        } else {
            throw new Error(`Invalid 'assets' value in config.`);
        }
    });
}
