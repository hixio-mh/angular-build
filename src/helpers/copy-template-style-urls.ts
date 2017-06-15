import * as fs from 'fs-extra';
import * as glob from 'glob';
import * as less from 'less';
import * as path from 'path';

import { sassPromise } from '../utils';

const templateUrlRegex = /templateUrl:\s*['"`]([^'"`]+?\.[a-zA-Z]+)['"`]/gm;
const styleUrlsRegex = /styleUrls:\s*(\[[^\]]*?\])/gm;

export async function copyTemplateAndStyleUrls(srcDir: string,
    rootOutDir: string,
    searchPatterns: string | string[],
    stylePreprocessorIncludePaths: string[]): Promise<void> {
    if (typeof searchPatterns === 'string') {
        searchPatterns = [searchPatterns as string];
    }

    await Promise.all((searchPatterns as string[]).map(async (pattern) => {
        if (pattern.indexOf('*') < 0) {
            // Argument is a directory target, add glob patterns to include every files.
            pattern = path.join(pattern, '**', '*');
        }

        let files = await globPromise(pattern, { cwd: rootOutDir, nodir: true, dot: true });
        files = files.filter(name => /\.(js|ts)$/i.test(name)); // Matches only javaScript/typescript files.

        // Generate all files content with inlined templates.
        await Promise.all(files.map(async (resourceId: string) => {
            const content = await fs.readFile(resourceId, 'utf-8');
            await copyTemplateUrl(content, resourceId, srcDir, rootOutDir);
            await copyStyleUrls(content, resourceId, srcDir, rootOutDir, stylePreprocessorIncludePaths);

        }));
    }));
}

async function findResourcePath(url: string, resourceId: string, srcDir: string, rootOutDir: string):
    Promise<string> {
    const dir = path.parse(resourceId).dir;
    const relOutPath = path.relative(rootOutDir, dir);
    const filePath = path.resolve(srcDir, relOutPath, url);
    if (await fs.exists(filePath)) {
        return filePath;
    } else if (/\.(css|scss|sass|less)$/i.test(filePath)) {
        const failbackExts = ['.css', '.scss', '.sass', '.less'];
        const curExt = path.parse(filePath).ext;
        for (let ext of failbackExts) {
            if (ext === curExt) {
                continue;
            }
            const tempNewFilePath = filePath.substr(0, filePath.length - curExt.length) + ext;
            if (await fs.exists(tempNewFilePath)) {
                return tempNewFilePath;
            }
        }
    }

    return filePath;
}

async function copyTemplateUrl(source: string,
    resourceId: string, srcDir: string, rootOutDir: string): Promise<void> {
    let templateUrlMatch: RegExpExecArray | null;
    while ((templateUrlMatch = templateUrlRegex.exec(source)) != null) {
        const templateUrl = templateUrlMatch[1];
        const templateSourceFilePath = await findResourcePath(templateUrl, resourceId, srcDir, rootOutDir);
        const templateDestFilePath = path.resolve(path.dirname(resourceId), templateUrl);
        await fs.copy(templateSourceFilePath, templateDestFilePath);
    }
}

async function copyStyleUrls(source: string,
    resourceId: string,
    srcDir: string,
    rootOutDir: string,
    includePaths: string[], ): Promise<void> {
    let styleUrlsMatch: RegExpExecArray | null;
    while ((styleUrlsMatch = styleUrlsRegex.exec(source)) != null) {
        const rawStr = styleUrlsMatch[1];
        // tslint:disable-next-line:no-eval
        const urls: string[] = eval(rawStr);
        await Promise.all(urls.map(async (styleUrl: string) => {
            const styleSourceFilePath = await findResourcePath(styleUrl, resourceId, srcDir, rootOutDir);
            const styleDestFilePath = path.resolve(path.dirname(resourceId), styleUrl);

            if (/\.scss$|\.sass$/i.test(styleSourceFilePath)) {
                const result = await sassPromise({ file: styleSourceFilePath, includePaths: includePaths });
                await fs.writeFile(styleDestFilePath, result.css);
            } else if (/\.less$/i.test(styleSourceFilePath)) {
                const styleContent = await fs.readFile(styleSourceFilePath, 'utf-8');
                const result = await less.render(styleContent, { filename: styleSourceFilePath });
                await fs.writeFile(styleDestFilePath, result.css);
            } else {
                await fs.copy(styleSourceFilePath, styleDestFilePath);
            }
        }));
    }
}

function globPromise(pattern: string, options: glob.IOptions): Promise<string[]> {
    return new Promise((resolve, reject) => {
        glob(pattern,
            options,
            (err, matches) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve(matches);
            });
    });
}
