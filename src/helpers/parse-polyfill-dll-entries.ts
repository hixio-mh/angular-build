import { existsSync } from 'fs';
import * as path from 'path';

import { PolyfillDllParsedEntry } from '../models/internals';

export function parsePolyfillDllEntries(inputs: string | string[], forDll: boolean, projectRoot: string): PolyfillDllParsedEntry {
    const result: PolyfillDllParsedEntry = {
        tsEntries: [],
        scriptEntries: [],
        styleEntries: []
    };

    if (!inputs || (Array.isArray(inputs) && !inputs.length)) {
        return result;
    }

    const dllEntries: string[] = [];

    if (Array.isArray(inputs)) {
        (inputs).forEach(e => {
            if (!dllEntries.includes(e)) {
                dllEntries.push(e);
            }
        });
    } else if (typeof inputs === 'string') {
        const e = inputs;
        if (e && e.length && !dllEntries.includes(e)) {
            dllEntries.push(e);
        }
    }

    if (!dllEntries.length) {
        return result;
    }

    dllEntries
        .forEach((e: string) => {
            if (!forDll) {
                const tempPath = path.resolve(projectRoot, e);
                if (existsSync(tempPath)) {
                    if (e.match(/\.ts$/i)) {
                        if (!result.tsEntries.includes(tempPath)) {
                            result.tsEntries.push(tempPath);
                        }
                    } else {
                        if (!result.scriptEntries.includes(tempPath)) {
                            result.scriptEntries.push(tempPath);
                        }
                    }
                } else {
                    if (!result.scriptEntries.includes(e)) {
                        result.scriptEntries.push(e);
                    }
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

    return result;
}
