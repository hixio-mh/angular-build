// tslint:disable:no-any
// tslint:disable:no-unsafe-any
// tslint:disable:no-var-requires
// tslint:disable:no-require-imports

import * as path from 'path';

import * as autoprefixer from 'autoprefixer';
import { copy, ensureDir, readFile, writeFile } from 'fs-extra';
import * as sass from 'node-sass';

import { AngularBuildContext } from '../../../build-context';
import { InternalError, UnsupportedStyleExtError } from '../../../models/errors';
import { GlobalScriptStyleParsedEntry, LibProjectConfigInternal } from '../../../models/internals';

const cssnano = require('cssnano');
const postcss = require('postcss');

export async function processStyles(angularBuildContext: AngularBuildContext<LibProjectConfigInternal>): Promise<void> {
    const libConfig = angularBuildContext.projectConfig;
    if (!libConfig.styles || !Array.isArray(libConfig.styles) || !libConfig.styles.length) {
        return;
    }

    if (!libConfig._projectRoot) {
        throw new InternalError("The 'libConfig._projectRoot' is not set.");
    }

    if (!libConfig._outputPath) {
        throw new InternalError("The 'libConfig._outputPath' is not set.");
    }

    if (!libConfig._styleParsedEntries) {
        throw new InternalError("The 'libConfig._styleParsedEntries' is not set.");
    }

    const logger = AngularBuildContext.logger;

    const projectRoot = libConfig._projectRoot;
    const outputPath = libConfig._outputPath;
    const sourceMap = libConfig.sourceMap;

    const includePaths: string[] = [];
    if (libConfig.stylePreprocessorOptions &&
        libConfig.stylePreprocessorOptions.includePaths &&
        libConfig.stylePreprocessorOptions.includePaths.length > 0
    ) {
        libConfig.stylePreprocessorOptions.includePaths.forEach((includePath: string) => {
            const includePathAbs = path.resolve(projectRoot, includePath);
            includePaths.push(includePathAbs);
        });
    }

    logger.info('Processing global styles');

    await Promise.all(libConfig._styleParsedEntries.map(async (styleParsedEntry: GlobalScriptStyleParsedEntry) => {
        const input = styleParsedEntry.paths[0];
        const dest = path.resolve(outputPath, styleParsedEntry.entry);

        if (/\.scss$|\.sass$/i.test(input) && !/\.scss$|\.sass$/i.test(dest)) {
            const result = await new Promise<{
                css: Buffer;
                map: Buffer;
            }>((resolve, reject) => {
                sass.render({
                    file: input,
                    sourceMap: sourceMap,
                    outFile: dest,
                    includePaths: includePaths,
                    // bootstrap-sass requires a minimum precision of 8
                    precision: 8
                },
                    (err: Error, sassResult: any) => {
                        if (err) {
                            reject(err);

                            return;
                        }

                        resolve(sassResult);
                    });
            });

            await ensureDir(path.dirname(dest));
            await writeFile(dest, result.css);
            if (sourceMap && result.map) {
                await writeFile(`${dest}.map`, result.map);
            }
        } else if (/\.css$/i.test(input)) {
            await copy(input, dest);
        } else {
            throw new UnsupportedStyleExtError(`The ${input} is not supported style format.`);
        }

        // minify
        const styleContent = await readFile(dest, 'utf-8');
        const minifiedResult = await processPostCss(styleContent, dest);
        const minDest = path.resolve(path.dirname(dest), `${path.parse(dest).name}.min.css`);
        await writeFile(minDest, minifiedResult.css);
        if (minifiedResult.map) {
            await writeFile(`${minDest}.map`, minifiedResult.map);
        }
    }));
}

// tslint:disable-next-line:no-reserved-keywords
async function processPostCss(css: string, from: string): Promise<any> {
    // safe settings based on: https://github.com/ben-eb/cssnano/issues/358#issuecomment-283696193
    const importantCommentRegex = /@preserve|@license|[@#]\s*source(?:Mapping)?URL|^!/i;

    return postcss([
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
