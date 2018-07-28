import * as path from 'path';

import * as autoprefixer from 'autoprefixer';
import { existsSync, readFile, readJson, writeFile } from 'fs-extra';
import * as denodeify from 'denodeify';
import * as glob from 'glob';
import { minify as minifyHtml } from 'html-minifier';
import * as sass from 'node-sass';

import { UnSupportedStyleExtError } from '../../../error-models';

const cssnano = require('cssnano');
const postcss = require('postcss');
const postcssUrl = require('postcss-url');

const MagicString = require('magic-string');

const globPromise = denodeify(glob) as (pattern: string, options?: glob.IOptions) => Promise<string[]>;

const moduleIdRegex = /moduleId:\s*module\.id\s*,?\s*/g;
const templateUrlRegex = /templateUrl:\s*['"`]([^'"`]+?\.[a-zA-Z]+)['"`]/g;
const styleUrlsRegex = /styleUrls:\s*(\[[^\]]*?\])/gm;

interface FoundTemplateUrlInfo {
    url: string;
    start: number;
    end: number;
}

interface FoundStyleUrlInfo {
    urls: string[];
    start: number;
    end: number;
}

export async function processNgResources(srcDir: string,
    searchRootDir: string,
    searchPatterns: string | string[],
    stylePreprocessorIncludePaths: string[],
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

        let files = await globPromise(pattern, { cwd: searchRootDir, nodir: true, dot: true });
        files = files.filter(name => /\.js$/i.test(name)); // Matches only javaScript/typescript files.
        // Generate all files content with inlined templates.
        await Promise.all(files.map(async (resourceId: string) => {
            const content = await readFile(resourceId, 'utf-8');
            const magicString = new MagicString(content);
            let hasReplacements: boolean;

            const hasTemplateReplacement = await inlineTemplateUrls(content,
                magicString,
                resourceId,
                srcDir,
                searchRootDir,
                componentResources);
            hasReplacements = hasTemplateReplacement;

            const hasStyleReplacement = await inlineStyleUrls(content,
                magicString,
                resourceId,
                srcDir,
                searchRootDir,
                stylePreprocessorIncludePaths,
                componentResources);
            hasReplacements = hasReplacements || hasStyleReplacement;

            const hasModuleIdMatched = await replaceModuleId(content, magicString);
            hasReplacements = hasReplacements || hasModuleIdMatched;

            if (hasReplacements) {
                await writeFile(resourceId, magicString.toString());

                if (!flatModuleOutFile) {
                    // metadata inline
                    const metaDataRelativeOutPath = path.relative(searchRootDir, path.dirname(resourceId));
                    const metaDataFilePath = path.resolve(searchRootDir,
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
            }
        }));

        if (flatModuleOutFile) {
            const metaDataFilePath = path.resolve(searchRootDir, flatModuleOutFile);
            const metaDataJson = await readJson(metaDataFilePath);
            const inlinedMetaDataJson = inlineFlattenMetaDataResources(metaDataJson, componentResources);
            await writeFile(metaDataFilePath, JSON.stringify(inlinedMetaDataJson));
        }
    }));
}

async function inlineTemplateUrls(source: string,
    magicString: any,
    resourceId: string,
    srcDir: string,
    outDir: string, componentResources: Map<string, string>): Promise<boolean> {
    let hasReplacement = false;
    let templateUrlMatch: RegExpExecArray | null;
    const foundTemplateUrls: FoundTemplateUrlInfo[] = [];

    while ((templateUrlMatch = templateUrlRegex.exec(source)) != null) {
        const start = templateUrlMatch.index;
        const end = start + templateUrlMatch[0].length;
        const url = templateUrlMatch[1];
        foundTemplateUrls.push({ start: start, end: end, url: url });
    }

    for (const foundUrlInfo of foundTemplateUrls) {
        const templateSourceFilePath = await findResourcePath(foundUrlInfo.url, resourceId, srcDir, outDir);
        const templateDestFilePath = path.resolve(path.dirname(resourceId), foundUrlInfo.url);

        const componentKey = path.relative(outDir, templateDestFilePath).replace(/\\/g, '/').replace(/^(\.\/|\/)/, '')
            .replace(/\/$/, '');
        let templateContent = await readFile(templateSourceFilePath, 'utf-8');

        // templateContent = templateContent
        //    .replace(/([\n\r]\s*)+/gm, ' ').trim();
        // Or
        templateContent = minifyHtml(templateContent,
            {
                caseSensitive: true,
                collapseWhitespace: true,
                removeComments: true,
                keepClosingSlash: true,
                removeAttributeQuotes: false
            });

        componentResources.set(componentKey, templateContent);

        const templateContentToReplace = `template: \`${templateContent}\``;
        magicString.overwrite(foundUrlInfo.start, foundUrlInfo.end, templateContentToReplace);

        hasReplacement = true;
    }

    return hasReplacement;
}

async function inlineStyleUrls(source: string,
    magicString: any,
    resourceId: string,
    srcDir: string,
    outDir: string,
    includePaths: string[],
    componentResources: Map<string, string>): Promise<boolean> {
    let hasReplacement = false;
    const foundStyleUrls: FoundStyleUrlInfo[] = [];
    let styleUrlsMatch: RegExpExecArray | null;

    while ((styleUrlsMatch = styleUrlsRegex.exec(source)) != null) {
        const start = styleUrlsMatch.index;
        const end = start + styleUrlsMatch[0].length;
        const rawStr = styleUrlsMatch[1];

        // tslint:disable-next-line:no-eval
        const urls: string[] = eval(rawStr);
        foundStyleUrls.push({ start: start, end: end, urls: urls });
    }

    for (const foundUrlInfo of foundStyleUrls) {
        const styleUrls = foundUrlInfo.urls;

        const stylesContents = await Promise.all(styleUrls.map(async (styleUrl: string) => {
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

            const componentKey = path.relative(outDir, styleDestFilePath).replace(/\\/g, '/').replace(/^(\.\/|\/)/, '')
                .replace(/\/$/, '');

            let minifiedStyleContent = styleContent.toString();
            // minifiedStyleContent = `${minifiedStyleContent}`
            //    .replace(/([\n\r]\s*)+/gm, ' ');
            // Or
            minifiedStyleContent = await processPostCss(minifiedStyleContent, styleSourceFilePath);
            componentResources.set(componentKey, minifiedStyleContent);

            hasReplacement = true;

            return styleContent;
        }));

        const stylesContentsToReplace = `styles: [${stylesContents.join(',')}]`;
        magicString.overwrite(foundUrlInfo.start, foundUrlInfo.end, stylesContentsToReplace);
    }

    return hasReplacement;
}

async function replaceModuleId(source: string, magicString: any): Promise<boolean> {
    let hasReplacement = false;
    let moduleIdMatch: RegExpExecArray | null;

    while ((moduleIdMatch = moduleIdRegex.exec(source)) != null) {
        const start = moduleIdMatch.index;
        const end = start + moduleIdMatch[0].length;
        hasReplacement = true;
        magicString.overwrite(start, end, '');
    }

    return hasReplacement;
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

    for (const dcObj of metaDataObj.decorators) {
        if (!dcObj.arguments) {
            continue;
        }

        for (const argObj of dcObj.arguments) {
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
        for (const ext of failbackExts) {
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
