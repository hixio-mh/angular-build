import * as path from 'path';

import { existsSync, readFile, writeFile } from 'fs-extra';
import * as uglify from 'uglify-js';

import { UglifyError } from '../../../error-models';
import { Logger } from '../../../utils';

export async function minifyFile(inputPath: string,
    outputPath: string,
    sourceMap: boolean,
    verbose: boolean,
    logger: Logger): Promise<any> {
    const content = await readFile(inputPath, 'utf-8');
    let sourceMapContent: string | null = null;
    if (sourceMap && existsSync(inputPath + '.map')) {
        sourceMapContent = await readFile(inputPath + '.map', 'utf-8');
    }
    const outputFileName = path.parse(outputPath).base;
    const sourceObj: any = {};
    sourceObj[outputFileName] = content;

    const result: uglify.MinifyOutput = uglify.minify(sourceObj,
        {
            warnings: verbose, // default false,
            ie8: true, // default false
            sourceMap: sourceMap
                ? {
                    // filename: outputFileName,
                    content: sourceMapContent,
                    url: outputFileName + '.map'
                }
                : null,
            compress: {
                passes: 3, // default 1
                negate_iife: false // default true, we need this for lazy v8
            },
            output: {
                comments: /^\**!|@preserve|@license/,
                beautify: false // default true
            }
        } as any);

    if ((result as any).error) {
        throw new UglifyError((result as any).error);
    }
    if ((result as any).warnings && verbose) {
        const warnings = (result as any).warnings;
        if (Array.isArray(warnings)) {
            (warnings as string[]).forEach(msg => {
                logger.warn(msg);
            });
        } else if (typeof warnings === 'string') {
            logger.warn(warnings);
        }
    }

    await writeFile(outputPath, result.code);
    if (sourceMap && result.map) {
        const sourcemapPath = outputPath + '.map';
        await writeFile(sourcemapPath, result.map);
    }
}
