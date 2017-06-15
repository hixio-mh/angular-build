import * as fs from 'fs-extra';
import * as uglify from 'uglify-js';

// TODO: to review
export async function uglifyJsFile(inputPath: string, outputPath: string): Promise<any> {
    const content = await fs.readFile(inputPath, 'utf-8');
    const result = uglify.minify(content);
    if ((result as any).error) {
        throw new Error((result as any).error);
    }

    await fs.writeFile(outputPath, result.code);
    // await fs.writeFile(sourcemapOut, result.map);
}
