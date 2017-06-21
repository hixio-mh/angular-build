import * as path from 'path';

import { StyleEntry } from '../models';

export type StyleParsedEntry = {
    path: string;
    entry: string;
} & StyleEntry;

export function parseStyleEntry(styleEntries: string | (string | StyleEntry)[],
    baseDir: string,
    defaultEntry: string): StyleParsedEntry[] {
    if (!styleEntries || !styleEntries.length) {
        return [];
    }

    const entries = Array.isArray(styleEntries) ? styleEntries : [styleEntries];
    const clonedEntries = entries.map((entry: any) =>
        typeof entry === 'object' ? Object.assign({ from: null }, entry) : entry
    );

    return clonedEntries
        .map((styleEntry: string | StyleEntry) =>
            typeof styleEntry === 'string' ? { from: styleEntry } : styleEntry)
        .map((styleEntry: StyleEntry) => {
            const styleParsedEntry: StyleParsedEntry = Object.assign({
                    path: '',
                    entry: ''
                },
                styleEntry);
            styleParsedEntry.path = path.resolve(baseDir, styleParsedEntry.from);
            styleParsedEntry.entry = styleParsedEntry.to
                ? styleParsedEntry.to.replace(/\.(js|css)$/i, '').replace(/(\\|\/)$/, '')
                : defaultEntry;
            if (styleParsedEntry.to && /(\\|\/)$/.test(styleParsedEntry.to)) {
                styleParsedEntry.to = styleParsedEntry.to +
                    path.basename(styleParsedEntry.path).replace(/\.(less|sass|scss|styl|css)$/i, '.css');
            }
            return styleParsedEntry;
        });
}
