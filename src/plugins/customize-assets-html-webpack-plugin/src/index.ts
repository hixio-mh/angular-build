import * as minimatch from 'minimatch';
import * as webpack from 'webpack';

import { Logger, LoggerOptions } from '../../../utils';

export class CustomizeAssetsHtmlWebpackPluginOptions {
    targetHtmlWebpackPluginIds?: string[];

    customLinkAttributes?: { [key: string]: string | boolean };
    customScriptAttributes?: { [key: string]: string | boolean };
    customLinkAttributeExcludes?: string[];
    customScriptAttributeExcludes?: string[];

    moveHeadAssetsToBody?: boolean;
    moveBodyAssetsToHead?: boolean;

    clearHeadAssets?: boolean;
    clearBodyAssets?: boolean;

    // filter
    assetTagsFilterFunc?: (tag: any) => boolean;

    removeStartingSlash?: boolean;

    loggerOptions?: LoggerOptions;
}

export class CustomizeAssetsHtmlWebpackPlugin {
    private readonly logger: Logger;

    get name(): string {
        return 'CustomizeAssetsHtmlWebpackPlugin';
    }

    constructor(private readonly options: CustomizeAssetsHtmlWebpackPluginOptions) {
        const loggerOptions =
            Object.assign({ name: `[${this.name}]` }, this.options.loggerOptions || {}) as LoggerOptions;
        this.logger = new Logger(loggerOptions);
    }

    apply(compiler: webpack.Compiler): void {
        compiler.plugin('compilation',
            (compilation: any) => {
                compilation.plugin('html-webpack-plugin-alter-asset-tags',
                    (htmlPluginArgs: any, cb: any) => {
                        const targetHtmlWebpackPluginIds = this.options.targetHtmlWebpackPluginIds || [];

                        let isTargetHtmlWebpackPlugin = false;
                        if (!targetHtmlWebpackPluginIds.length ||
                            (targetHtmlWebpackPluginIds.length &&
                                targetHtmlWebpackPluginIds.indexOf(htmlPluginArgs.plugin.options.id) >
                                -1)) {
                            isTargetHtmlWebpackPlugin = true;
                        }

                        if (!isTargetHtmlWebpackPlugin) {
                            return cb(null, htmlPluginArgs);
                        }

                        const customLinkAttributes = this.options.customLinkAttributes || {};
                        const customScriptAttributes = this.options.customScriptAttributes || {};
                        const customLinkAttributeExcludes = this.options.customLinkAttributeExcludes || [];
                        const customScriptAttributeExcludes = this.options.customScriptAttributeExcludes || [];

                        htmlPluginArgs.head = htmlPluginArgs.head || [];
                        htmlPluginArgs.body = htmlPluginArgs.body || [];
                        let hasClearHeadAssets = false;
                        let hasClearBodyAssets = false;

                        // apply custom attrributes
                        const updateAttributesFn = (tags: any[],
                            targetTagName: string,
                            attributes: { [key: string]: string | boolean }, exclude: string[]) => {
                            return tags.map((tag: any) => {
                                const url = tag.attributes.src || tag.attributes.href;
                                if (tag.tagName === targetTagName && url) {
                                    let shouldSkip = false;
                                    if (exclude && exclude.length) {
                                        exclude.forEach(p => {
                                            if (minimatch(url, p)) {
                                                shouldSkip = true;
                                            }
                                        });
                                    }
                                    if (!shouldSkip) {
                                        tag.attributes = Object.assign({}, tag.attributes, attributes);
                                    }
                                }
                                return tag;
                            });
                        };

                        if (customLinkAttributes && Object.keys(customLinkAttributes).length) {
                            this.logger.debug('Applying custom link attributes');
                            htmlPluginArgs.head =
                                updateAttributesFn(htmlPluginArgs.head,
                                    'link',
                                    customLinkAttributes,
                                    customLinkAttributeExcludes);
                            htmlPluginArgs.body =
                                updateAttributesFn(htmlPluginArgs.body,
                                    'link',
                                    customLinkAttributes,
                                    customLinkAttributeExcludes);
                        }

                        if (customScriptAttributes && Object.keys(customScriptAttributes).length) {
                            this.logger.debug('Applying custom script attributes');
                            htmlPluginArgs.head =
                                updateAttributesFn(htmlPluginArgs.head,
                                    'script',
                                    customScriptAttributes,
                                    customScriptAttributeExcludes);
                            htmlPluginArgs.body =
                                updateAttributesFn(htmlPluginArgs.body,
                                    'script',
                                    customScriptAttributes,
                                    customScriptAttributeExcludes);
                        }

                        // filter
                        if (this.options.assetTagsFilterFunc) {
                            this.logger.debug('Filtering asset tags');
                            const filterFn = this.options.assetTagsFilterFunc;
                            htmlPluginArgs.head = htmlPluginArgs.head.filter(filterFn);
                            htmlPluginArgs.body = htmlPluginArgs.body.filter(filterFn);
                        }

                        // move
                        if (this.options.moveHeadAssetsToBody) {
                            this.logger.debug('Moving head assets to body');
                            htmlPluginArgs.body = htmlPluginArgs.head.concat(htmlPluginArgs.body);
                            htmlPluginArgs.head = [];
                        }
                        if (this.options.moveBodyAssetsToHead) {
                            this.logger.debug('Moving body assets to head');
                            htmlPluginArgs.head = htmlPluginArgs.head.concat(htmlPluginArgs.body);
                            htmlPluginArgs.body = [];
                        }

                        // remove starting slash
                        const removeStartingSlashFn = (tags: any[]) =>
                            tags.map((tag: any) => {
                                if ((tag.tagName === 'link' || tag.tagName === 'script') &&
                                    tag.attributes &&
                                    (tag.attributes.href || tag.attributes.src)) {
                                    if (tag.attributes.href &&
                                        tag.attributes.href.length > 1 &&
                                        tag.attributes.href[0] === '/' &&
                                        tag.attributes.href[1].match(/\w/i)) {
                                        tag.attributes.href = tag.attributes.href.substr(1);
                                    } else if (tag.attributes.src &&
                                        tag.attributes.src.length > 1 &&
                                        tag.attributes.src[0] === '/' &&
                                        tag.attributes.src[1].match(/\w/i)) {
                                        tag.attributes.src = tag.attributes.src.substr(1);
                                    }
                                }
                                return tag;
                            });
                        if (this.options.removeStartingSlash) {
                            this.logger.debug('Removing starting slash');
                            htmlPluginArgs.head = removeStartingSlashFn(htmlPluginArgs.head);
                            htmlPluginArgs.body = removeStartingSlashFn(htmlPluginArgs.body);
                        }

                        // clear
                        if (this.options.clearHeadAssets && !hasClearHeadAssets) {
                            this.logger.debug('Clearing haead assets');
                            htmlPluginArgs.head = [];
                        }
                        if (this.options.clearBodyAssets && !hasClearBodyAssets) {
                            this.logger.debug('Clearing body assets');
                            htmlPluginArgs.body = [];
                        }

                        return cb(null, htmlPluginArgs);
                    });
            });
    }
}
