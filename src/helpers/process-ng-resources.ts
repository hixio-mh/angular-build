import * as path from 'path';

import * as autoprefixer from 'autoprefixer';
import { copy, existsSync, readFile, readJson, writeFile } from 'fs-extra';
import * as denodeify from 'denodeify';
import * as glob from 'glob';
import { minify as minifyHtml } from 'html-minifier';
import * as sass from 'node-sass';

import { UnSupportedStyleExtError } from '../models';

const cssnano = require('cssnano');
const postcss = require('postcss');
const postcssUrl = require('postcss-url');

const globPromise = denodeify(glob) as (pattern: string, options?: glob.IOptions) => Promise<string[]>;

const templateUrlRegex = /templateUrl:\s*['"`]([^'"`]+?\.[a-zA-Z]+)['"`]/g;
const styleUrlsRegex = /styleUrls:\s*(\[[^\]]*?\])/gm;

export async function processNgResources(srcDir: string,
    outDir: string,
    searchPatterns: string | string[],
    stylePreprocessorIncludePaths: string[],
    copyResources?: boolean,
    inlineMetaDataResources?: boolean,
    flatModuleOutFile?: string
): Promise<void> {
    if (typeof searchPatterns === 'string') {
        searchPatterns = [searchPatterns as string];
    }

    const componentResources = new Map<string, string>();

    await Promise.all((searchPatterns as string[]).map(async (pattern) => {
        if (pattern.indexOf('*') < 0) {
            // Argument is a directory target, add glob patterns to include every files.
            pattern = path.join(pattern, '**', '*');
        }

        let files = await globPromise(pattern, { cwd: outDir, nodir: true, dot: true });
        files = files.filter(name => /\.js$/i.test(name)); // Matches only javaScript/typescript files.
        // Generate all files content with inlined templates.
        await Promise.all(files.map(async (resourceId: string) => {
            const content = await readFile(resourceId, 'utf-8');
            let hasMatched: boolean;
            const hasTemplateMatched = await copyTemplateUrl(content,
                resourceId,
                srcDir,
                outDir,
                copyResources as boolean,
                componentResources);
            hasMatched = hasTemplateMatched;

            const hasStyleMatched = await copyStyleUrls(content,
                resourceId,
                srcDir,
                outDir,
                stylePreprocessorIncludePaths,
                copyResources as boolean,
                componentResources);
            hasMatched = hasMatched || hasStyleMatched;

            if (inlineMetaDataResources && !flatModuleOutFile && hasMatched) {
                const metaDataRelativeOutPath = path.relative(outDir, path.dirname(resourceId));
                const metaDataFilePath = path.resolve(outDir,
                    metaDataRelativeOutPath,
                    path.parse(resourceId).name + '.metadata.json');
                const metaJson = await readJson(metaDataFilePath);

                metaJson.forEach((obj: any) => {
                    if (!obj.metadata) {
                        return;
                    }

                    Object.keys(obj.metadata).forEach((key: string) => {
                        const metaDataObj = obj.metadata[key];
                        processMetaDataResources(metaDataObj,
                            metaDataRelativeOutPath,
                            componentResources);
                    });
                });
                await writeFile(metaDataFilePath, JSON.stringify(metaJson));
            }

        }));

        if (inlineMetaDataResources && flatModuleOutFile) {
            const metaDataFilePath = path.resolve(outDir, flatModuleOutFile);
            const metaDataJson = await readJson(metaDataFilePath);
            const inlinedMetaDataJson = inlineFlattenMetaDataResources(metaDataJson, componentResources);
            await writeFile(metaDataFilePath, JSON.stringify(inlinedMetaDataJson));
        }

    }));
}

async function copyTemplateUrl(source: string,
    resourceId: string,
    srcDir: string,
    outDir: string, copyResources: boolean, componentResources: Map<string, string>): Promise<boolean> {
    let templateUrlMatch: RegExpExecArray | null;
    const foundUrls: string[] = [];
    while ((templateUrlMatch = templateUrlRegex.exec(source)) != null) {
        const url = templateUrlMatch[1];
        if (foundUrls.indexOf(url) === -1) {
            foundUrls.push(url);
        }
    }

    for (let templateUrl of foundUrls) {
        const templateSourceFilePath = await findResourcePath(templateUrl, resourceId, srcDir, outDir);
        const templateDestFilePath = path.resolve(path.dirname(resourceId), templateUrl);
        if (copyResources) {
            await copy(templateSourceFilePath, templateDestFilePath);
        }

        const componentKey = path.relative(outDir, templateDestFilePath).replace(/\\/g, '/').replace(/^(\.\/|\/)/, '')
            .replace(/\/$/, '');
        let componentContent = await readFile(templateSourceFilePath, 'utf-8');
        componentContent = minifyHtml(componentContent,
            {
                caseSensitive: true,
                collapseWhitespace: true,
                removeComments: true,
                keepClosingSlash: true,
                removeAttributeQuotes: false
            });
        componentResources.set(componentKey, componentContent);
    }

    return foundUrls.length > 0;
}

async function copyStyleUrls(source: string,
    resourceId: string,
    srcDir: string,
    outDir: string,
    includePaths: string[],
    copyResources: boolean,
    componentResources: Map<string, string>): Promise<boolean> {
    const foundUrls: string[] = [];
    let styleUrlsMatch: RegExpExecArray | null;
    while ((styleUrlsMatch = styleUrlsRegex.exec(source)) != null) {
        const rawStr = styleUrlsMatch[1];
        // tslint:disable-next-line:no-eval
        const urls: string[] = eval(rawStr);
        urls.forEach(url => {
            if (foundUrls.indexOf(url) === -1) {
                foundUrls.push(url);
            }
        });
    }

    for (let styleUrl of foundUrls) {
        const styleSourceFilePath = await findResourcePath(styleUrl, resourceId, srcDir, outDir);
        const styleDestFilePath = path.resolve(path.dirname(resourceId), styleUrl);

        let styleContent: string | Buffer;
        if (/\.scss$|\.sass$/i.test(styleSourceFilePath)) {
            const result = await new Promise<{
                css: Buffer;
            }>((resolve, reject) => {
                sass.render({ file: styleSourceFilePath, includePaths: includePaths },
                    (err: Error, sassResult: any) => {
                        if (err) {
                            return reject(err);
                        }
                        return resolve(sassResult);
                    });
            });
            styleContent = result.css;
        } else if (/\.css$/i.test(styleSourceFilePath)) {
            styleContent = await readFile(styleSourceFilePath, 'utf-8');
        } else {
            throw new UnSupportedStyleExtError(`The ${styleSourceFilePath} is not supported style format.`);
        }

        if (copyResources) {
            await writeFile(styleDestFilePath, styleContent);
        }

        const componentKey = path.relative(outDir, styleDestFilePath).replace(/\\/g, '/').replace(/^(\.\/|\/)/, '')
            .replace(/\/$/, '');
        let componentContent = styleContent.toString();
        componentContent = await processPostCss(componentContent, styleSourceFilePath);
        componentResources.set(componentKey, componentContent);
    }

    return foundUrls.length > 0;
}

function inlineFlattenMetaDataResources(json: any, componentResources: Map<string, string>): any {
    if (!json.importAs || !json.origins || !json.metadata) {
        return json;
    }

    Object.keys(json.origins).forEach((originKey: string) => {
        const metaDataObj = json.metadata[originKey];
        const basePath = path.dirname(json.origins[originKey]);
        if (metaDataObj) {
            processMetaDataResources(metaDataObj, basePath, componentResources);
        }
    });

    return json;
}

function processMetaDataResources(metaDataObj: any, basePath: string, componentResources: Map<string, string>): void {
    if (!metaDataObj.decorators || !metaDataObj.decorators.length) {
        return;
    }

    for (let dcObj of metaDataObj.decorators) {
        if (!dcObj.arguments) {
            continue;
        }

        for (let argObj of dcObj.arguments) {
            if (argObj.templateUrl) {
                const templateFullUrl = path.join(basePath, argObj.templateUrl).replace(/\\/g, '/')
                    .replace(/^(\.\/|\/)/, '')
                    .replace(/\/$/, '');
                const template = componentResources.get(templateFullUrl);
                if (template !== null) {
                    argObj.template = template;
                    delete argObj.templateUrl;
                }
            }
            if (argObj.styleUrls) {
                let styleInlined = false;
                const styles =
                    argObj.styleUrls.map((styleUrl: string) => {
                        const styleFullUrl = path.join(basePath, styleUrl).replace(/\\/g, '/')
                            .replace(/^(\.\/|\/)/, '')
                            .replace(/\/$/, '');
                        const content = componentResources.get(styleFullUrl);
                        if (content !== null) {
                            styleInlined = true;
                        }
                        return content;
                    });
                if (styleInlined) {
                    argObj.styles = styles;
                    delete argObj.styleUrls;
                }
            }
        }
    }
}

async function findResourcePath(url: string, resourceId: string, srcDir: string, rootOutDir: string):
    Promise<string> {
    const dir = path.parse(resourceId).dir;
    const relOutPath = path.relative(rootOutDir, dir);
    const filePath = path.resolve(srcDir, relOutPath, url);
    if (existsSync(filePath)) {
        return filePath;
    } else if (/\.(css|scss|sass|less)$/i.test(filePath)) {
        const failbackExts = ['.css', '.scss', '.sass', '.less'];
        const curExt = path.parse(filePath).ext;
        for (let ext of failbackExts) {
            if (ext === curExt) {
                continue;
            }
            const tempNewFilePath = filePath.substr(0, filePath.length - curExt.length) + ext;
            if (existsSync(tempNewFilePath)) {
                return tempNewFilePath;
            }
        }
    }

    return filePath;
}

async function processPostCss(css: string, from: string): Promise<string> {
    const result = await postcss([
        postcssUrl({
            url: 'inline'
        }),

        autoprefixer,
        cssnano({
            safe: true,
            mergeLonghand: false,
            discardComments: {
                removeAll: true
            }
        })
    ]).process(css,
        {
            from: from

        });
    return result.css;
}
