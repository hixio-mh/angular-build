// tslint:disable:no-any
// tslint:disable:no-unsafe-any
// tslint:disable:no-var-requires
// tslint:disable:no-require-imports

import * as path from 'path';

import * as minimatch from 'minimatch';
import { RawSource } from 'webpack-sources';

import * as htmlMinifier from 'html-minifier';
import * as parse5 from 'parse5';
import * as webpack from 'webpack';

import { HtmlInjectOptions } from '../../../interfaces';
import { Logger, LoggerOptions, normalizeRelativePath } from '../../../utils';

const sourceMapUrl = require('source-map-url');

const { createElement, appendChild, insertText } = require('parse5/lib/tree-adapters/default');

interface TagDefinition {
    tagName: string;
    attributes: { [key: string]: string | boolean };
    innerHtml?: string;
    voidTag?: boolean;
    closeTag?: boolean;
    selfClosingTag?: boolean;
}

export interface HtmlInjectWebpackPluginOptions extends HtmlInjectOptions {
    baseDir: string;
    outDir: string;
    entrypoints: string[];

    baseHref?: string;
    publicPath?: string;
    dllAssetsFile?: string;

    loggerOptions?: LoggerOptions;
}

async function readFile(filename: string, compilation: webpack.compilation.Compilation): Promise<string> {
    return new Promise<string>((resolve, reject) => {
        compilation.inputFileSystem.readFile(filename,
            (err: Error, data: Buffer) => {
                if (err) {
                    reject(err);

                    return;
                }

                let content: string;
                if (data.length >= 3 && data[0] === 0xEF && data[1] === 0xBB && data[2] === 0xBF) {
                    // Strip UTF-8 BOM
                    content = data.toString('utf8', 3);
                } else if (data.length >= 2 && data[0] === 0xFF && data[1] === 0xFE) {
                    // Strip UTF-16 LE BOM
                    content = data.toString('utf16le', 2);
                } else {
                    content = data.toString();
                }

                resolve(content);
            });
    });
}

export class HtmlInjectWebpackPlugin {
    private readonly _logger: Logger;

    get name(): string {
        return 'html-inject-webpack-plugin';
    }

    constructor(private readonly _options: HtmlInjectWebpackPluginOptions) {
        this._logger = new Logger({ name: `[${this.name}]`, ...this._options.loggerOptions });
    }

    // tslint:disable:max-func-body-length
    apply(compiler: webpack.Compiler): void {
        compiler.hooks.emit.tapPromise(this.name, async (compilation: any) => {
            let document: parse5.DefaultTreeDocument | null = null;
            let headElement: parse5.DefaultTreeElement | null = null;
            let bodyElement: parse5.DefaultTreeElement | null = null;

            const additionalAssetsEntry: { [key: string]: RawSource } = {};
            const styleTags: string[] = [];
            const scriptTags: string[] = [];

            let indexRelative: string | null = null;
            let indexInputFilePath: string | null = null;
            let indexOutFilePath: string | null = null;

            const customLinkAttributes = this._options.customLinkAttributes || this._options.customAttributes || {};
            const customScriptAttributes = this._options.customScriptAttributes || this._options.customAttributes || {};
            const customResourceHintAttributes =
                this._options.customResourceHintAttributes || this._options.customAttributes || {};

            let separateRuntimeInlineOut = false;
            let runtimeInlineRelative: string | null = null;
            if (this._options.runtimeInlineOut) {
                const filePath = path.isAbsolute(this._options.runtimeInlineOut)
                    ? path.resolve(this._options.runtimeInlineOut)
                    : path.resolve(this._options.outDir, this._options.runtimeInlineOut);
                if (filePath !== indexInputFilePath && filePath !== indexOutFilePath) {
                    separateRuntimeInlineOut = true;
                    runtimeInlineRelative = normalizeRelativePath(path.relative(this._options.outDir, filePath));
                }
            }

            let separateStylesOut = false;
            let stylesOutRelative: string | null = null;
            if (this._options.stylesOut) {
                const filePath = path.isAbsolute(this._options.stylesOut)
                    ? path.resolve(this._options.stylesOut)
                    : path.resolve(this._options.outDir, this._options.stylesOut);
                if (filePath !== indexInputFilePath && filePath !== indexOutFilePath) {
                    separateStylesOut = true;
                    stylesOutRelative = normalizeRelativePath(path.relative(this._options.outDir, filePath));
                }
            }

            let separateScriptsOut = false;
            let scriptsOutRelative: string | null = null;
            if (this._options.scriptsOut) {
                const filePath = path.isAbsolute(this._options.scriptsOut)
                    ? path.resolve(this._options.scriptsOut)
                    : path.resolve(this._options.outDir, this._options.scriptsOut);
                if (filePath !== indexInputFilePath && filePath !== indexOutFilePath) {
                    separateScriptsOut = true;
                    scriptsOutRelative = normalizeRelativePath(path.relative(this._options.outDir, filePath));
                }
            }

            // link tag definition
            const createLinkTagDefinition = (url: string): TagDefinition => {
                return {
                    tagName: 'link',
                    attributes: {
                        rel: 'stylesheet',
                        href: (this._options.publicPath || '') + url,
                        ...customLinkAttributes
                    },
                    selfClosingTag: true
                };
            };

            // script tag definition
            const createScriptTagDefinition = (url: string): TagDefinition => {
                return {
                    tagName: 'script',
                    attributes: {
                        type: 'text/javascript',
                        src: (this._options.publicPath || '') + url,
                        ...customScriptAttributes
                    },
                    closeTag: true
                };
            };

            // Get input html file
            if (this._options.index) {
                indexInputFilePath = path.isAbsolute(this._options.index)
                    ? path.resolve(this._options.index)
                    : path.resolve(this._options.baseDir, this._options.index);
                const indexOut = this._options.indexOut || path.basename(indexInputFilePath);
                indexOutFilePath = path.isAbsolute(indexOut)
                    ? path.resolve(indexOut)
                    : path.resolve(this._options.outDir, indexOut);
                indexRelative = normalizeRelativePath(path.relative(this._options.outDir, indexOutFilePath));

                const inputContent = await readFile(indexInputFilePath, compilation);
                compilation.fileDependencies.add(indexInputFilePath);

                // Find the head and body elements
                document = parse5.parse(inputContent) as parse5.DefaultTreeDocument;
                for (const topNode of document.childNodes) {
                    if ((topNode as parse5.DefaultTreeElement).tagName === 'html') {
                        for (const htmlNode of (topNode as parse5.DefaultTreeElement).childNodes) {
                            if ((htmlNode as parse5.DefaultTreeElement).tagName === 'head') {
                                headElement = htmlNode as parse5.DefaultTreeElement;
                            }
                            if ((htmlNode as parse5.DefaultTreeElement).tagName === 'body') {
                                bodyElement = htmlNode as parse5.DefaultTreeElement;
                            }
                        }
                    }
                }

                if (!headElement || !bodyElement) {
                    compilation.errors.push(new Error('Missing head and/or body elements.'));

                    return;
                }
            }

            // Get all files for selected entrypoints
            const unfilteredSortedFiles: string[] = [];
            for (const entryName of this._options.entrypoints) {
                const entrypoint = compilation.entrypoints.get(entryName);
                if (entrypoint) {
                    unfilteredSortedFiles.push(...entrypoint.getFiles());
                }
            }

            // Filter files
            const existingFiles = new Set<string>();
            const stylesheets: string[] = [];
            const scripts: string[] = [];
            let runtimeFileName: string | null = null;
            for (const file of unfilteredSortedFiles) {
                if (existingFiles.has(file)) {
                    continue;
                }

                existingFiles.add(file);

                if (runtimeFileName == null &&
                    this._options.runtimeChunkInline &&
                    /^runtime([\.\-][0-9a-fA-F]+)?\.js$/.test(file)) {
                    runtimeFileName = file;
                    continue;
                }

                if (file.endsWith('.js')) {
                    scripts.push(file);
                } else if (file.endsWith('.css')) {
                    stylesheets.push(file);
                }
            }

            // BaseHref
            let separateBaseHrefOut = false;
            let baseHrefOutRelative: string | null = null;
            if (this._options.baseHrefOut && this._options.baseHref != null) {
                const filePath = path.isAbsolute(this._options.baseHrefOut)
                    ? path.resolve(this._options.baseHrefOut)
                    : path.resolve(this._options.outDir, this._options.baseHrefOut);
                if (filePath !== indexInputFilePath && filePath !== indexOutFilePath) {
                    separateBaseHrefOut = true;
                    baseHrefOutRelative = normalizeRelativePath(path.relative(this._options.outDir, filePath));
                }
            }
            if (this._options.baseHref != null) {
                const tagDefinition: TagDefinition = {
                    tagName: 'base',
                    attributes: {
                        href: this._options.baseHref
                    },
                    selfClosingTag: true
                };

                if (headElement) {
                    let baseElement: parse5.DefaultTreeElement | null = null;
                    for (const node of headElement.childNodes) {
                        if ((node as parse5.DefaultTreeElement).tagName === 'base') {
                            baseElement = node as parse5.DefaultTreeElement;
                            break;
                        }
                    }

                    this._logger.debug(`Injecting base href: '${this._options.baseHref}'`);

                    const attributes = Object.keys(tagDefinition.attributes).map(key => {
                        return {
                            name: key,
                            value: tagDefinition.attributes[key] as string
                        };
                    });

                    if (!baseElement) {
                        const element = createElement(
                            tagDefinition.tagName,
                            undefined as any,
                            attributes
                        );

                        appendChild(headElement, element);
                    } else {
                        let hrefAttribute: parse5.Attribute | null = null;
                        for (const attribute of baseElement.attrs) {
                            if (attribute.name === 'href') {
                                hrefAttribute = attribute;
                            }
                        }
                        if (hrefAttribute) {
                            hrefAttribute.value = this._options.baseHref;
                        } else {
                            baseElement.attrs.push({ name: 'href', value: this._options.baseHref });
                        }
                    }
                }

                if (separateBaseHrefOut && baseHrefOutRelative) {
                    this._logger.debug(`Injecting base href: '${this._options.baseHref}' to ${baseHrefOutRelative}`);

                    const content = HtmlInjectWebpackPlugin.createHtmlTag(tagDefinition);
                    additionalAssetsEntry[baseHrefOutRelative] = new RawSource(content);
                }
            }

            // ResourceHints
            let separateResourceHintsOut = false;
            let resourceHintsOutRelative: string | null = null;
            if (this._options.resourceHintsOut && this._options.resourceHints !== false) {
                const filePath = path.isAbsolute(this._options.resourceHintsOut)
                    ? path.resolve(this._options.resourceHintsOut)
                    : path.resolve(this._options.outDir, this._options.resourceHintsOut);
                if (filePath !== indexInputFilePath && filePath !== indexOutFilePath) {
                    separateResourceHintsOut = true;
                    resourceHintsOutRelative = normalizeRelativePath(path.relative(this._options.outDir, filePath));
                }
            }
            if (this._options.resourceHints || separateResourceHintsOut) {
                const preloads = this._options.preloads || ['**/*.js'];
                const prefetches = this._options.prefetches || [];
                const resourceHintTags: string[] = [];

                // resource hints
                // See - https://w3c.github.io/preload/#link-type-preload
                // See - https://hackernoon.com/10-things-i-learned-making-the-fastest-site-in-the-world-18a0e1cdf4a7
                const createResourceHintTag = (href: string, rel: string): TagDefinition | null => {
                    const tag: TagDefinition = {
                        tagName: 'link',
                        selfClosingTag: true,
                        attributes: {
                            rel: rel,
                            href: href,
                            ...customResourceHintAttributes
                        }
                    };

                    if (/\.js$/i.test(href)) {
                        tag.attributes.as = 'script';
                    } else if (/\.css$/i.test(href)) {
                        tag.attributes.as = 'style';
                    } else if (/\.(otf|ttf|woff|woff2|eot)(\?v=\d+\.\d+\.\d+)?$/i.test(href)) {
                        tag.attributes.as = 'font';
                    } else if (/\.(jpe?g|png|webp|gif|cur|ani|svg)$/i.test(href)) {
                        tag.attributes.as = 'image';
                    } else {
                        return null;
                    }

                    return tag;
                };

                const createReourceHints = (category: string, url: string, f: string): void => {
                    if (!minimatch(url, f)) {
                        return;
                    }

                    const tagDefinition = createResourceHintTag((this._options.publicPath || '') + url, category);
                    if (tagDefinition == null) {
                        return;
                    }

                    if (headElement) {
                        this._logger.debug(`Injecting ${category}: '${url}'`);

                        const attributes = Object.keys(tagDefinition.attributes).map(key => {
                            return { name: key, value: tagDefinition.attributes[key] as string };
                        });

                        const element = createElement(
                            tagDefinition.tagName,
                            undefined as any,
                            attributes
                        );

                        appendChild(headElement, element);
                    }

                    if (separateResourceHintsOut && resourceHintsOutRelative) {
                        this._logger.debug(`Injecting ${category}: '${url}' to ${resourceHintsOutRelative}`);

                        const content = HtmlInjectWebpackPlugin.createHtmlTag(tagDefinition);
                        resourceHintTags.push(content);
                    }
                };

                preloads.forEach(f => {
                    for (const url of stylesheets) {
                        createReourceHints('preload', url, f);
                    }
                    for (const url of scripts) {
                        createReourceHints('preload', url, f);
                    }
                });

                prefetches.forEach(f => {
                    for (const url of stylesheets) {
                        createReourceHints('prefetch', url, f);
                    }
                    for (const url of scripts) {
                        createReourceHints('prefetch', url, f);
                    }
                });

                if (separateResourceHintsOut && resourceHintsOutRelative) {
                    const content = resourceHintTags.join('\n');
                    additionalAssetsEntry[resourceHintsOutRelative] = new RawSource(content);
                }
            }

            // Dll assets
            if (this._options.dlls && this._options.dllAssetsFile) {
                const cssAssets: string[] = [];
                const scriptAssets: string[] = [];
                let assetJsonPath = this._options.dllAssetsFile;
                assetJsonPath = path.isAbsolute(assetJsonPath)
                    ? path.resolve(assetJsonPath)
                    : path.resolve(this._options.outDir, assetJsonPath);
                const rawContent = await readFile(assetJsonPath, compilation);
                const assetJson = JSON.parse(rawContent);
                Object.keys(assetJson).forEach(key => {
                    const assets = assetJson[key];
                    if (Array.isArray(assets)) {
                        assets.filter(asset => asset && /\.(js|css)$/i.test(asset)).forEach(asset => {
                            if (/\.js$/i.test(asset)) {
                                scriptAssets.push(asset);
                            } else {
                                cssAssets.push(asset);
                            }
                        });
                    }
                });

                for (const stylesheet of cssAssets) {
                    const tagDefinition = createLinkTagDefinition(stylesheet);

                    if (headElement) {
                        this._logger.debug(`Injecting dll stylesheet: '${stylesheet}'`);

                        const attributes = Object.keys(tagDefinition.attributes).map(key => {
                            return { name: key, value: tagDefinition.attributes[key] as string };
                        });

                        const element = createElement(
                            tagDefinition.tagName,
                            undefined as any,
                            attributes
                        );

                        appendChild(headElement, element);
                    }

                    if (separateStylesOut && stylesOutRelative) {
                        this._logger.debug(`Injecting dll stylesheet: '${stylesheet}' to ${stylesOutRelative}`);

                        const content = HtmlInjectWebpackPlugin.createHtmlTag(tagDefinition);
                        styleTags.push(content);
                    }
                }

                for (const script of scriptAssets) {
                    const tagDefinition = createScriptTagDefinition(script);

                    if (bodyElement) {
                        this._logger.debug(`Injecting dll script: '${script}'`);

                        const attributes = Object.keys(tagDefinition.attributes).map(key => {
                            return { name: key, value: tagDefinition.attributes[key] as string };
                        });

                        const element = createElement(
                            tagDefinition.tagName,
                            undefined as any,
                            attributes
                        );

                        appendChild(bodyElement, element);
                    }

                    if (separateScriptsOut && scriptsOutRelative) {
                        this._logger.debug(`Injecting dll script: '${script}' to ${scriptsOutRelative}`);

                        const content = HtmlInjectWebpackPlugin.createHtmlTag(tagDefinition);
                        scriptTags.push(content);
                    }
                }
            }

            // Runtime chunk
            let runtimeTagRawContent = '';
            if (this._options.runtimeChunkInline && runtimeFileName &&
                compilation.assets[runtimeFileName]) {
                const asset = compilation.assets[runtimeFileName];
                let source = asset.source();
                if (typeof source !== 'string') {
                    source = source.toString();
                }
                source = `\n${sourceMapUrl.removeFrom(source)}\n`;

                const tagDefinition: TagDefinition = {
                    tagName: 'script',
                    attributes: {
                        type: 'text/javascript'
                    },
                    innerHtml: source,
                    closeTag: true
                };

                runtimeTagRawContent = HtmlInjectWebpackPlugin.createHtmlTag(tagDefinition);

                if (headElement) {
                    const attributes = Object.keys(tagDefinition.attributes).map(key => {
                        return {
                            name: key,
                            value: tagDefinition.attributes[key] as string
                        };
                    });

                    const element = createElement(
                        tagDefinition.tagName,
                        undefined as any,
                        attributes
                    );
                    appendChild(headElement, element);
                    insertText(element, tagDefinition.innerHtml || '');
                }

                delete compilation.assets[runtimeFileName];
            }
            if (separateRuntimeInlineOut && runtimeInlineRelative) {
                this._logger.debug(`Injecting runtime to ${runtimeInlineRelative}`);

                additionalAssetsEntry[runtimeInlineRelative] = new RawSource(runtimeTagRawContent);
            }

            // Styles
            for (const stylesheet of stylesheets) {
                const tagDefinition = createLinkTagDefinition(stylesheet);

                if (headElement) {
                    this._logger.debug(`Injecting stylesheet: '${stylesheet}'`);

                    const attributes = Object.keys(tagDefinition.attributes).map(key => {
                        return { name: key, value: tagDefinition.attributes[key] as string };
                    });

                    const element = createElement(
                        tagDefinition.tagName,
                        undefined as any,
                        attributes
                    );

                    appendChild(headElement, element);
                }

                if (separateStylesOut && stylesOutRelative) {
                    this._logger.debug(`Injecting stylesheet: '${stylesheet}' to ${stylesOutRelative}`);

                    const content = HtmlInjectWebpackPlugin.createHtmlTag(tagDefinition);
                    styleTags.push(content);
                }
            }

            // Scripts
            for (const script of scripts) {
                const tagDefinition = createScriptTagDefinition(script);

                if (bodyElement) {
                    this._logger.debug(`Injecting script: '${script}'`);

                    const attributes = Object.keys(tagDefinition.attributes).map(key => {
                        return { name: key, value: tagDefinition.attributes[key] as string };
                    });

                    const element = createElement(
                        tagDefinition.tagName,
                        undefined as any,
                        attributes
                    );

                    appendChild(bodyElement, element);
                }

                if (separateScriptsOut && scriptsOutRelative) {
                    this._logger.debug(`Injecting script: '${script}' to ${scriptsOutRelative}`);

                    const content = HtmlInjectWebpackPlugin.createHtmlTag(tagDefinition);
                    scriptTags.push(content);
                }
            }

            if (separateStylesOut && stylesOutRelative) {
                const content = styleTags.join('\n');
                additionalAssetsEntry[stylesOutRelative] = new RawSource(content);
            }
            if (separateScriptsOut && scriptsOutRelative) {
                const content = scriptTags.join('\n');
                additionalAssetsEntry[scriptsOutRelative] = new RawSource(content);
            }
            if (document && indexRelative) {
                let indexContent = parse5.serialize(document);

                if (this._options.minify) {
                    const minifyOptions = {
                        caseSensitive: true,
                        collapseWhitespace: true,
                        keepClosingSlash: true
                    };

                    this._logger.debug(`Minifying '${indexRelative}'`);
                    indexContent = htmlMinifier.minify(indexContent, minifyOptions);
                }

                this._logger.debug(`Injecting '${indexRelative}'`);
                compilation.assets[indexRelative] = new RawSource(indexContent);
            }

            Object.keys(additionalAssetsEntry).forEach(key => {
                compilation.assets[key] = additionalAssetsEntry[key];
            });

        });
    }

    private static createHtmlTag(tagDefinition: TagDefinition): string {
        const attributes = Object.keys(tagDefinition.attributes || {})
            .filter(attributeName => tagDefinition.attributes[attributeName] !== false)
            .map(attributeName => {
                if (tagDefinition.attributes[attributeName] === true) {
                    return attributeName;
                }

                return `${attributeName}="${tagDefinition.attributes[attributeName]}"`;
            });
        // Backport of 3.x void tag definition
        const voidTag = tagDefinition.voidTag !== undefined ? tagDefinition.voidTag : !tagDefinition.closeTag;
        const selfClosingTag =
            tagDefinition.voidTag !== undefined ? tagDefinition.voidTag : tagDefinition.selfClosingTag;

        return `<${[tagDefinition.tagName].concat(attributes).join(' ')}${selfClosingTag ? '/' : ''}>${
            tagDefinition.innerHtml || (tagDefinition as any).innerHTML || ''}${voidTag
                ? ''
                : `</${tagDefinition.tagName}>`}`;
    }
}
