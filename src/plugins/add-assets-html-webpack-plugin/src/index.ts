import * as webpack from 'webpack';

import { InternalError } from '../../../models';
import { Logger, LoggerOptions } from '../../../utils';

export interface AddAssetsHtmlWebpckPluginOptions {
    source: 'json' | 'linksAndScripts' | 'linksAndScriptsOptionsKey' | 'rawOptionsKey';
    isSeparateOutFunc?: (htmlOptionsId?: string) => boolean;

    assetJsonPath?: string;

    cssLinks?: string[];
    scripts?: string[];


    linksHtmlPluginOptionsKey?: string;
    scriptsHtmlPluginOptionsKey?: string;

    rawTagsHtmlPluginOptionsKey?: string;

    targetHtmlWebpackPluginIdsForLinks?: string[];
    targetHtmlWebpackPluginIdsForScripts?: string[];
    targetHtmlWebpackPluginIdsForRawTags?: string[];

    customLinkAttributes?: { [key: string]: string | boolean };
    customScriptAttributes?: { [key: string]: string | boolean };
    scriptsInjectPosition?: 'head' | 'body';

    loggerOptions?: LoggerOptions;
}

export class AddAssetsHtmlWebpckPlugin {
    private readonly logger: Logger;

    protected assetJsonCssLinks: string[] = [];
    protected assetJsonScripts: string[] = [];
    protected assetJson: { [key: string]: string[] } | null = null;

    private lastBeforeCompileTimeStamp?: number;

    private readonly builtInHtmlPluginOptionKeys = ['id', 'title', 'filename', 'template', 'inject', 'favicon',
        'minify', 'hash', 'cache', 'showErrors', 'chunks', 'chunksSortMode', 'excludeChunks', 'xhtml'];

    get name(): string {
        return 'AddAssetsHtmlWebpckPlugin';
    }

    constructor(readonly options: AddAssetsHtmlWebpckPluginOptions) {
        if (this.options.source === 'json' && !this.options.rawTagsHtmlPluginOptionsKey) {
            throw new InternalError(`${this.name} The 'rawTagsHtmlPluginOptionsKey' option is required.`);
        }
        if (this.options.linksHtmlPluginOptionsKey &&
            this.builtInHtmlPluginOptionKeys.indexOf(this.options.linksHtmlPluginOptionsKey) > -1) {
            throw new InternalError(
                `${this.name} The 'linksHtmlPluginOptionsKey': '${this.options.linksHtmlPluginOptionsKey
                }' is not supported.`);
        }
        if (this.options.scriptsHtmlPluginOptionsKey &&
            this.builtInHtmlPluginOptionKeys.indexOf(this.options.scriptsHtmlPluginOptionsKey) > -1) {
            throw new InternalError(
                `${this.name} The 'scriptsHtmlPluginOptionsKey': '${this.options.scriptsHtmlPluginOptionsKey
                }' is not supported.`);
        }
        if (this.options.rawTagsHtmlPluginOptionsKey &&
            this.builtInHtmlPluginOptionKeys.indexOf(this.options.rawTagsHtmlPluginOptionsKey) > -1) {
            throw new InternalError(
                `${this.name} The 'scriptsHtmlPluginOptionsKey': '${this.options.rawTagsHtmlPluginOptionsKey
                }' is not supported.`);
        }

        const loggerOptions = this.options.loggerOptions || {} as LoggerOptions;
        loggerOptions.name = `[${this.name}]`;
        this.logger = new Logger(loggerOptions);
    }

    apply(compiler: webpack.Compiler): void {
        compiler.plugin('before-compile', (params: any, cb: (err?: Error) => void) => {
            if (!this.options.assetJsonPath || this.options.source !== 'json') {
                return cb();
            }

            if (this.lastBeforeCompileTimeStamp &&
                this.lastBeforeCompileTimeStamp > 0 &&
                Date.now() - this.lastBeforeCompileTimeStamp < 500 &&
                this.assetJson) {
                this.lastBeforeCompileTimeStamp = Date.now();
                return cb();
            }

            const assetJsonPath = this.options.assetJsonPath;
            params.compilationDependencies.push(assetJsonPath);
            (compiler as any).inputFileSystem.readFile(assetJsonPath,
                (err: Error, result: any) => {
                    if (err) {
                        this.lastBeforeCompileTimeStamp = 0;
                        this.assetJson = null;
                        return cb(err);
                    }

                    this.assetJson = JSON.parse(result.toString('utf8'));
                    if (this.assetJson) {
                        const assetJson = this.assetJson as { [key: string]: string[]; };
                        const cssAssets: string[] = [];
                        const scriptAssets: string[] = [];
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

                        this.assetJsonCssLinks = cssAssets;
                        this.assetJsonScripts = scriptAssets;
                    }

                    this.lastBeforeCompileTimeStamp = Date.now();
                    return cb();
                });
        });

        compiler.plugin('compilation', (compilation: any) => {
            compilation.plugin('html-webpack-plugin-before-html-generation',
                (htmlPluginArgs: any, cb: (err?: Error, htmlPluginArgs?: any) => void) => {
                    if (!this.options.assetJsonPath || this.options.source !== 'json') {
                        return cb(undefined, htmlPluginArgs);
                    }

                    this.assetJsonCssLinks = this.assetJsonCssLinks || [];
                    this.assetJsonScripts = this.assetJsonScripts || [];

                    if (this.assetJsonCssLinks.length === 0 && this.assetJsonScripts.length === 0) {
                        return cb(undefined, htmlPluginArgs);
                    }

                    let publicPath = '';
                    if (htmlPluginArgs.assets &&
                        htmlPluginArgs.assets.publicPath &&
                        htmlPluginArgs.assets.publicPath !== '/') {
                        publicPath = htmlPluginArgs.assets.publicPath;
                        const endsWithBsRegex = /\/$/;
                        const startWithBsRegex = /^\/\w/;
                        publicPath = endsWithBsRegex.test(publicPath) ? publicPath : publicPath + '/';
                        publicPath = startWithBsRegex.test(publicPath) ? publicPath.substr(1) : publicPath;
                    }

                    this.assetJsonCssLinks = this.assetJsonCssLinks.map((l: string) => {
                        return publicPath ? publicPath + l : l;
                    });
                    this.assetJsonScripts = this.assetJsonScripts.map((l: string) => {
                        return publicPath ? publicPath + l : l;
                    });

                    if (this.assetJsonCssLinks.length > 0 && this.options.linksHtmlPluginOptionsKey) {
                        const linksHtmlPluginOptionsKey = this.options.linksHtmlPluginOptionsKey;
                        htmlPluginArgs.plugin.options[linksHtmlPluginOptionsKey] = this.assetJsonCssLinks;
                    }
                    if (this.assetJsonScripts.length > 0 && this.options.scriptsHtmlPluginOptionsKey) {
                        const scriptsHtmlPluginOptionsKey = this.options.scriptsHtmlPluginOptionsKey;
                        htmlPluginArgs.plugin.options[scriptsHtmlPluginOptionsKey] = this.assetJsonScripts;
                    }

                    return cb(undefined, htmlPluginArgs);
                });

            compilation.plugin('html-webpack-plugin-before-html-processing',
                (htmlPluginArgs: any, cb: (err?: Error, htmlPluginArgs?: any) => void) => {
                    if (!this.options.rawTagsHtmlPluginOptionsKey || this.options.source !== 'rawOptionsKey') {
                        return cb(undefined, htmlPluginArgs);
                    }

                    const htmlOutFileName = htmlPluginArgs.outputName;
                    const targetHtmlWebpackPluginIdsForRawTags = this.options.targetHtmlWebpackPluginIdsForRawTags || [];
                    if (!targetHtmlWebpackPluginIdsForRawTags.length ||
                        (targetHtmlWebpackPluginIdsForRawTags.length &&
                            targetHtmlWebpackPluginIdsForRawTags.indexOf(htmlPluginArgs.plugin.options.id) > -1)) {
                        if (this.options.rawTagsHtmlPluginOptionsKey &&
                            htmlPluginArgs.plugin.options[this.options.rawTagsHtmlPluginOptionsKey]) {
                            const rawHtml = htmlPluginArgs.plugin.options[this.options.rawTagsHtmlPluginOptionsKey];
                            const isSeparateOut = typeof this.options.isSeparateOutFunc === 'function' &&
                                this.options.isSeparateOutFunc(htmlPluginArgs.plugin.options.id);
                            this.logger.debug(
                                `Injecting '${this.options.rawTagsHtmlPluginOptionsKey}' asset tags${htmlOutFileName
                                    ? ` to ${htmlOutFileName}`
                                    : ''}`);
                            if (isSeparateOut) {
                                htmlPluginArgs.html = `${Array.isArray(rawHtml) ? rawHtml.join('\n') : rawHtml}`;
                            } else {
                                htmlPluginArgs.html = htmlPluginArgs.html || '';
                                if (Array.isArray(rawHtml)) {
                                    if (htmlPluginArgs.html.match(/(<\/head>)/i)) {
                                        htmlPluginArgs.html = htmlPluginArgs.html.replace(
                                            /(<\/head>)/i,
                                            `    ${rawHtml.join('\n    ')}\n$&`);
                                    } else {
                                        htmlPluginArgs.html = `${htmlPluginArgs.html.trim()}\n${rawHtml.join('\n')}\n`;
                                    }
                                } else {
                                    if (htmlPluginArgs.html.match(/(<\/head>)/i)) {
                                        htmlPluginArgs.html = htmlPluginArgs.html.replace(
                                            /(<\/head>)/i,
                                            `    ${rawHtml}\n$&`);
                                    } else {
                                        htmlPluginArgs.html = `${htmlPluginArgs.html.trim()}\n${rawHtml}\n`;
                                    }
                                }
                            }
                        }
                    }

                    return cb(undefined, htmlPluginArgs);
                });

            compilation.plugin('html-webpack-plugin-alter-asset-tags',
                (htmlPluginArgs: any, cb: (err?: Error, htmlPluginArgs?: any) => void) => {
                    const htmlOutFileName = htmlPluginArgs.outputName;
                    const customLinkAttributes = this.options.customLinkAttributes || {};
                    const customScriptAttributes = this.options.customScriptAttributes || {};
                    const targetHtmlWebpackPluginIdsForLinks = this.options.targetHtmlWebpackPluginIdsForLinks || [];

                    if (!targetHtmlWebpackPluginIdsForLinks.length ||
                        (targetHtmlWebpackPluginIdsForLinks.length &&
                            targetHtmlWebpackPluginIdsForLinks.indexOf(htmlPluginArgs.plugin.options.id) > -1)) {
                        let cssLinks: string[] = [];
                        if (this.options.source === 'json') {
                            if (this.assetJsonCssLinks && this.assetJsonCssLinks.length) {
                                this.logger.debug(
                                    `Injecting css tags${htmlOutFileName
                                        ? ` to ${htmlOutFileName}`
                                        : ''}`);
                                cssLinks = this.assetJsonCssLinks;
                            }
                        } else if (this.options.source === 'linksAndScripts') {
                            if (this.options.cssLinks && this.options.cssLinks.length) {
                                this.logger.debug(
                                    `Injecting css tags${htmlOutFileName
                                        ? ` to ${htmlOutFileName}`
                                        : ''}`);
                                cssLinks = this.options.cssLinks;
                            }
                        } else if (this.options.source === 'linksAndScriptsOptionsKey') {
                            if (this.options.linksHtmlPluginOptionsKey &&
                                htmlPluginArgs.plugin.options[this.options.linksHtmlPluginOptionsKey] &&
                                Array.isArray(htmlPluginArgs.plugin.options[this.options.linksHtmlPluginOptionsKey])) {
                                this.logger.debug(
                                    `Injecting '${this.options.linksHtmlPluginOptionsKey}' css tags${htmlOutFileName
                                        ? ` to ${htmlOutFileName}`
                                        : ''}`);
                                cssLinks = htmlPluginArgs.plugin.options[this.options.linksHtmlPluginOptionsKey];
                            }
                        }

                        const linkEntries = cssLinks.map((l: string) => {
                            return {
                                tagName: 'link',
                                selfClosingTag: true,
                                attributes: Object.assign({
                                    rel: 'stylesheet',
                                    href: l
                                },
                                    customLinkAttributes)
                            };
                        });

                        const isSeparateOut = typeof this.options.isSeparateOutFunc === 'function' &&
                            this.options.isSeparateOutFunc(htmlPluginArgs.plugin.options.id);
                        if (isSeparateOut) {
                            htmlPluginArgs.head = [];
                            htmlPluginArgs.body = linkEntries;
                        } else {
                            htmlPluginArgs.head = linkEntries.concat(htmlPluginArgs.head);
                        }
                    }

                    const targetHtmlWebpackPluginIdsForScripts = this.options.targetHtmlWebpackPluginIdsForScripts || [];
                    if (!targetHtmlWebpackPluginIdsForScripts.length ||
                        (targetHtmlWebpackPluginIdsForScripts.length &&
                            targetHtmlWebpackPluginIdsForScripts.indexOf(htmlPluginArgs.plugin.options.id) > -1)) {
                        let scripts: string[] = [];
                        if (this.options.source === 'json') {
                            if (this.assetJsonScripts && this.assetJsonScripts.length) {
                                this.logger.debug(
                                    `Injecting script tags${htmlOutFileName
                                        ? ` to ${htmlOutFileName}`
                                        : ''}`);
                                scripts = this.assetJsonScripts;
                            }
                        } else if (this.options.source === 'linksAndScripts') {
                            if (this.options.scripts && this.options.scripts.length) {
                                this.logger.debug(
                                    `Injecting script tags${htmlOutFileName
                                        ? ` to ${htmlOutFileName}`
                                        : ''}`);
                                scripts = this.options.scripts;
                            }
                        } else if (this.options.source === 'linksAndScriptsOptionsKey') {
                            if (this.options.scriptsHtmlPluginOptionsKey &&
                                htmlPluginArgs.plugin.options[this.options.scriptsHtmlPluginOptionsKey] &&
                                Array.isArray(htmlPluginArgs.plugin.options[this.options.scriptsHtmlPluginOptionsKey])) {
                                this.logger.debug(
                                    `Injecting '${this.options.scriptsHtmlPluginOptionsKey}' script tags${htmlOutFileName
                                        ? ` to ${htmlOutFileName}`
                                        : ''}`);
                                scripts = htmlPluginArgs.plugin.options[this.options.scriptsHtmlPluginOptionsKey];
                            }
                        }

                        const scriptEntries = scripts.map((s: string) => {
                            return {
                                tagName: 'script',
                                closeTag: true,
                                attributes: Object.assign({
                                        type: 'text/javascript',
                                        src: s
                                    },
                                    customScriptAttributes)
                            };
                        });

                        const isSeparateOut = typeof this.options.isSeparateOutFunc === 'function' &&
                            this.options.isSeparateOutFunc(htmlPluginArgs.plugin.options.id);
                        if (isSeparateOut) {
                            htmlPluginArgs.head = [];
                            htmlPluginArgs.body = scriptEntries;
                        } else {
                            if (this.options.scriptsInjectPosition === 'head') {
                                htmlPluginArgs.head = scriptEntries.concat(htmlPluginArgs.head);
                            } else {
                                htmlPluginArgs.body = scriptEntries.concat(htmlPluginArgs.body);
                            }

                        }
                    }

                    return cb(undefined, htmlPluginArgs);
                });
        });
    }
}
