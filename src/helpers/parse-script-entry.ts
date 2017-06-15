import * as path from 'path';

import { ScriptEntry } from '../models';
export type ScriptParsedEntry = {
    path: string;
    entry: string;
} & ScriptEntry;

export function parseScriptEntry(scriptEntries: string | (string | ScriptEntry)[],
    appRoot: string,
    defaultEntry: string): ScriptParsedEntry[] {
    if (!scriptEntries || !scriptEntries.length) {
        return [];
    }

    const entries = Array.isArray(scriptEntries) ? scriptEntries : [scriptEntries];
    const clonedEntries = entries.map((entry: any) =>
        typeof entry === 'object' ? Object.assign({ from: null }, entry) : entry
    );

    return clonedEntries
        .map((scriptEntry: string | ScriptEntry) =>
            typeof scriptEntry === 'string' ? { from: scriptEntry } : scriptEntry)
        .map((scriptEntry: ScriptEntry) => {
            const scriptParsedEntry: ScriptParsedEntry = Object.assign({ path: '', entry: defaultEntry }, scriptEntry);
            scriptParsedEntry.path = path.resolve(appRoot, scriptParsedEntry.from);
            if (scriptEntry.to) {
                const to = scriptEntry.to;
                scriptParsedEntry.entry = to.replace(/\.(js|css)$/i, '');
            } else if (scriptEntry.lazy) {
                scriptParsedEntry.entry = (scriptEntry.from as string).replace(/\.(js|css|scss|sass|less|styl)$/i, '');
            } else {
                scriptParsedEntry.entry = defaultEntry;
            }
            return scriptParsedEntry;
        });
}
