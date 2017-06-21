import * as fs from 'fs-extra';
import * as less from 'less';
import * as path from 'path';

// ReSharper disable CommonJsExternalModule
const autoprefixer = require('autoprefixer');
const cssnano = require('cssnano');
const postcss = require('postcss');
// ReSharper restore CommonJsExternalModule

import { StyleEntry } from '../models';
import { sassPromise } from '../utils';

import { parseStyleEntry, StyleParsedEntry } from './parse-style-entry';

export async function copyStyles(baseDir: string,
    outDir: string,
    styleEntries: string | (string | StyleEntry)[],
    includePaths: string[],
    sourceMap?: boolean): Promise<any> {
    const parsedStyleEntries = parseStyleEntry(styleEntries, baseDir, 'styles');

    await Promise.all(parsedStyleEntries.map(async (styleParsedEntry: StyleParsedEntry) => {
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
            if (sourceMap && result.map) {
                await fs.writeFile(dest + '.map', result.map, 'utf-8');
            }
        } else if (/\.less$/i.test(styleParsedEntry.path) && !/\.less$/i.test(dest)) {
            const content = await fs.readFile(styleParsedEntry.path, 'utf-8');
            const result = await less.render(content,
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
            if (sourceMap && result.map) {
                await fs.writeFile(dest + '.map', result.map, 'utf-8');
            }
        } else {
            await fs.copy(styleParsedEntry.path, dest);
        }

        // minify
        const styleContent = await fs.readFile(dest, 'utf-8');
        const minifiedResult = await processPostCss(styleContent, dest);
        const minDest = path.resolve(path.dirname(dest), path.parse(dest).name + '.min.css');
        await fs.writeFile(minDest, minifiedResult.css, 'utf-8');
        if (minifiedResult.map) {
            await fs.writeFile(minDest + '.map', minifiedResult.map, 'utf-8');
        }
    }));
}

async function processPostCss(css: string, from: string): Promise<any> {
    // safe settings based on: https://github.com/ben-eb/cssnano/issues/358#issuecomment-283696193
    const importantCommentRegex = /@preserve|@license|[@#]\s*source(?:Mapping)?URL|^!/i;

    return await postcss([
        autoprefixer,
        cssnano({
            safe: true,
            discardComments: { remove: (comment: string) => !importantCommentRegex.test(comment) }
        })
    ]).process(css,
        {
            from: from
        });
}
