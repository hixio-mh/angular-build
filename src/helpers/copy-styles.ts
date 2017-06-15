import * as fs from 'fs-extra';
import * as less from 'less';
import * as path from 'path';

import { StyleEntry } from '../models';
import { sassPromise } from '../utils';

import { parseStyleEntry, StyleParsedEntry } from './parse-style-entry';

export async function copyStyles(baseDir: string,
    outDir: string,
    styleEntries: string | (string | StyleEntry)[],
    includePaths: string[],
    name: string,
    sourceMap?: boolean): Promise<any> {
    const parsedStyleEntries = parseStyleEntry(styleEntries, baseDir, 'styles');

    await Promise.all(parsedStyleEntries.map(async (styleParsedEntry: StyleParsedEntry) => {
        if (styleParsedEntry.to && name) {
            styleParsedEntry.to = styleParsedEntry.to.replace(/\[name\]/g, name);
        }

        const dest = path.resolve(outDir, styleParsedEntry.to || '');

        if (/\.scss$|\.sass$/i.test(styleParsedEntry.path) && !/\.scss$|\.sass$/i.test(dest)) {
            const result = await sassPromise({
                file: styleParsedEntry.path,
                sourceMap: sourceMap,
                outFile: dest,
                includePaths: includePaths,
                // bootstrap-sass requires a minimum precision of 8
                precision: 8
            });
            await fs.ensureDir(path.dirname(dest));
            await fs.writeFile(dest, result.css, 'utf-8');
            if (result.map) {
                await fs.writeFile(dest + '.map', result.map, 'utf-8');
            }
        } else if (/\.less$/i.test(styleParsedEntry.path) && !/\.less$/i.test(dest)) {
            const styleContent = await fs.readFile(styleParsedEntry.path, 'utf-8');
            const result = await less.render(styleContent,
                {
                    filename: styleParsedEntry.path,
                    sourceMap: sourceMap
                        ? {
                            outputSourceFiles: true
                        }
                        : undefined
                });
            await fs.ensureDir(path.dirname(dest));
            await fs.writeFile(dest, result.css, 'utf-8');
            if (result.map) {
                await fs.writeFile(dest + '.map', result.map, 'utf-8');
            }
        } else {
            await fs.copy(styleParsedEntry.path, dest);
        }
    }));
}
