import * as minimatch from 'minimatch';
import * as webpack from 'webpack';

import { Logger, LoggerOptions } from '../../../utils/logger';

export interface ResourceHintsHtmlWebpackPluginOptions {
    preloads: string[];
    prefetches: string[];
    isSeparateOutFunc?: (htmlOptionsId?: string) => boolean;
    targetHtmlWebpackPluginIds?: string[];
    customAttributes?: { [key: string]: string | boolean };
    loggerOptions?: LoggerOptions;
}

export class ResourceHintsHtmlWebpackPlugin {
    private readonly logger: Logger;

    get name(): string {
        return 'ResourceHintsHtmlWebpackPlugin';
    }

    constructor(private readonly options: ResourceHintsHtmlWebpackPluginOptions) {
        const loggerOptions =
            Object.assign({ name: `[${this.name}]` }, this.options.loggerOptions || {}) as LoggerOptions;
        this.logger = new Logger(loggerOptions);
    }

    apply(compiler: webpack.Compiler): void {
        compiler.plugin('compilation', (compilation: any) => {
            compilation.plugin('html-webpack-plugin-before-html-processing',
                (htmlPluginArgs: any, cb: (err?: Error, htmlPluginArgs?: any) => void) => {
                    const targetHtmlWebpackPluginIds = this.options.targetHtmlWebpackPluginIds || [];
                    if (!targetHtmlWebpackPluginIds.length ||
                        (targetHtmlWebpackPluginIds.length &&
                            targetHtmlWebpackPluginIds.indexOf(htmlPluginArgs.plugin.options.id) > -1)) {
                        const isSeparateOut = typeof this.options.isSeparateOutFunc === 'function' &&
                            this.options.isSeparateOutFunc(htmlPluginArgs.plugin.options.id);
                        if (isSeparateOut) {
                            htmlPluginArgs.html = '';
                        }
                    }

                    cb(undefined, htmlPluginArgs);
                }
            );

            compilation.plugin('html-webpack-plugin-alter-asset-tags',
                (htmlPluginArgs: any, cb: (err?: Error, htmlPluginArgs?: any) => void) => {
                    const targetHtmlWebpackPluginIds = this.options.targetHtmlWebpackPluginIds || [];
                    if (!targetHtmlWebpackPluginIds.length ||
                        (targetHtmlWebpackPluginIds.length &&
                            targetHtmlWebpackPluginIds.indexOf(htmlPluginArgs.plugin.options.id) > -1)) {
                        const isSeparateOut = typeof this.options.isSeparateOutFunc === 'function' &&
                            this.options.isSeparateOutFunc(htmlPluginArgs.plugin.options.id);
                        const htmlOutFileName = htmlPluginArgs.outputName;
                        const customAttributes = this.options.customAttributes;

                        // resource hints
                        // See - https://w3c.github.io/preload/#link-type-preload
                        // See - https://hackernoon.com/10-things-i-learned-making-the-fastest-site-in-the-world-18a0e1cdf4a7
                        const createResourceHintTagFn = (href: string, rel: string): any | null => {
                            const tag = {
                                tagName: 'link',
                                selfClosingTag: true,
                                attributes: {
                                    rel: rel,
                                    href: href
                                }
                            };

                            if (customAttributes) {
                                tag.attributes = Object.assign({}, tag.attributes, customAttributes);
                            }

                            if (/\.js$/i.test(href)) {
                                (tag.attributes as any).as = 'script';
                            } else if (/\.css$/i.test(href)) {
                                (tag.attributes as any).as = 'style';
                            } else {
                                return null;
                            }

                            // else if (/\.(otf|ttf|woff|woff2|eot)(\?v=\d+\.\d+\.\d+)?$/i.test(href)) {
                            //    (tag.attributes as any).as = 'font';
                            // } else if (/\.(jpe?g|png|webp|gif|cur|ani|svg)$/i.test(href)) {
                            //    (tag.attributes as any).as = 'image';
                            // }
                            return tag;
                        };

                        const preloads = this.options.preloads || [];
                        const prefetches = this.options.prefetches || [];
                        if (preloads.length > 0 || prefetches.length > 0) {
                            this.logger.debug(`Injecting resource hint tag${htmlOutFileName ? ` to ${htmlOutFileName}` : ''}`);
                            const preloadTags: any[] = [];
                            preloads.forEach(p => {
                                const headTags = htmlPluginArgs.head
                                    .map((tag: any) => tag.attributes.src || tag.attributes.href)
                                    .filter((url: string) => !!url && minimatch(url, p))
                                    .map((url: string) => createResourceHintTagFn(url, 'preload'))
                                    .filter((tag: any) => tag !== null);
                                preloadTags.push(...headTags);
                                const bodyTags = htmlPluginArgs.body
                                    .map((tag: any) => tag.attributes.src || tag.attributes.href)
                                    .filter((url: string) => !!url && minimatch(url, p))
                                    .map((url: string) => createResourceHintTagFn(url, 'preload'))
                                    .filter((tag: any) => tag !== null);
                                preloadTags.push(...bodyTags);
                            });

                            const prefetchTags: any[] = [];
                            prefetches.forEach(p => {
                                const headTags = htmlPluginArgs.head
                                    .map((tag: any) => tag.attributes.src || tag.attributes.href)
                                    .filter((url: string) => !!url && minimatch(url, p))
                                    .map((url: string) => createResourceHintTagFn(url, 'prefetch'))
                                    .filter((tag: any) => tag !== null);
                                prefetchTags.push(...headTags);
                                const bodyTags = htmlPluginArgs.body
                                    .map((tag: any) => tag.attributes.src || tag.attributes.href)
                                    .filter((url: string) => !!url && minimatch(url, p))
                                    .map((url: string) => createResourceHintTagFn(url, 'prefetch'))
                                    .filter((tag: any) => tag !== null);
                                prefetchTags.push(...bodyTags);
                            });

                            if (isSeparateOut) {
                                if (htmlPluginArgs.head) {
                                    htmlPluginArgs.head = [];
                                }
                                htmlPluginArgs.body = [];

                                if (prefetchTags.length) {
                                    htmlPluginArgs.body.push(...prefetchTags);
                                }
                                if (preloadTags.length) {
                                    htmlPluginArgs.body.push(...preloadTags);
                                }
                            } else {
                                if (prefetchTags.length) {
                                    htmlPluginArgs.head = prefetchTags.concat(htmlPluginArgs.head);
                                }
                                if (preloadTags.length) {
                                    htmlPluginArgs.head = preloadTags.concat(htmlPluginArgs.head);
                                }
                            }
                        }
                    }

                    return cb(undefined, htmlPluginArgs);
                });
        });
    }
}
