import * as fs from 'fs-extra';
import * as path from 'path';
import * as uglify from 'uglify-js';
import { Logger } from '../utils';

export async function writeMinifyFile(inputPath: string,
    outputPath: string,
    sourceMap?: boolean,
    preserveLicenseComments?: boolean,
    verbose?: boolean,
    logger: Logger = new Logger()): Promise<any> {
    const content = await fs.readFile(inputPath, 'utf-8');
    let sourceMapContent: string | null = null;
    if (sourceMap && await fs.exists(inputPath + '.map')) {
        sourceMapContent = await fs.readFile(inputPath + '.map', 'utf-8');
    }
    const outputFileName = path.parse(outputPath).base;
    const sourceObj: any = {};
    sourceObj[outputFileName] = content;

    const result = uglify.minify(sourceObj,
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
                comments: preserveLicenseComments !== false ? /^\**!|@preserve|@license/ : false,
                beautify: false // default true
            }
        } as any);
    if ((result as any).error) {
        throw new Error((result as any).error);
    }
    if ((result as any).warnings) {
        logger.warnLine((result as any).warnings);
    }

    await fs.writeFile(outputPath, result.code);
    if (sourceMap && !!result.map) {
        const sourcemapPath = outputPath + '.map';
        await fs.writeFile(sourcemapPath, result.map);
    }
}
