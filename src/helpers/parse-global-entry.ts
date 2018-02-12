import * as path from 'path';

import { GlobalEntry, GlobalParsedEntry } from '../models';

export function parseGlobalEntries(extraEntries: string | (string | GlobalEntry)[],
    baseDir: string, defaultEntry: string): GlobalParsedEntry[] {
    if (!extraEntries || !extraEntries.length) {
        return [];
    }

    const entries = Array.isArray(extraEntries) ? extraEntries : [extraEntries];
    const clonedEntries = entries.map((entry: any) =>
        typeof entry === 'object' ? Object.assign({}, entry) : entry
    );

    return clonedEntries
        .map((extraEntry: string | GlobalEntry) =>
            typeof extraEntry === 'object' ? extraEntry : { input: extraEntry })
        .map((extraEntry: GlobalEntry) => {
            const parsedEntry: GlobalParsedEntry = {
                paths: [],
                entry: '',
                lazy: extraEntry.lazy
            };

            const inputs = Array.isArray(extraEntry.input) ? extraEntry.input : [extraEntry.input];
            parsedEntry.paths = inputs.map(input => path.resolve(baseDir, input));

            if (extraEntry.to) {
                if (/(\\|\/)$/.test(extraEntry.to) &&
                    !Array.isArray(extraEntry.input) &&
                    typeof extraEntry.input === 'string') {
                    parsedEntry.entry = extraEntry.to +
                        path.basename(extraEntry.input as string).replace(/\.(ts|js|less|sass|scss|styl|css)$/i, '');
                } else {
                    parsedEntry.entry = extraEntry.to.replace(/\.(js|css)$/i, '');
                }
            } else if (extraEntry.lazy && !Array.isArray(extraEntry.input) &&
                typeof extraEntry.input === 'string') {
                parsedEntry.entry = path.basename(extraEntry.input as string)
                    .replace(/\.(js|ts|css|scss|sass|less|styl)$/i, '');
            } else {
                parsedEntry.entry = defaultEntry;
            }

            return parsedEntry;
        });
}
