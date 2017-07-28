import * as minimatch from 'minimatch';

export class CustomizeAssetsHtmlPluginOptions {
    targetHtmlWebpackPluginIds?: string[];
    clearHeadAssets?: boolean;
    clearBodyAssets?: boolean;
    moveHeadAssetsToBody?: boolean;
    moveBodyAssetsToHead?: boolean;

    cssLinkAssets?: string[];
    scriptAssets?: string[];

    linksPosition?: 'head' | 'body';
    scriptsPosition?: 'head' | 'body';

    customLinkAttributes?: { [key: string]: string | boolean };
    customScriptAttributes?: { [key: string]: string | boolean };
    customLinkAttributeExcludes?: string[];
    customScriptAttributeExcludes?: string[];

    // filter
    assetTagsFilterFunc?: (tag: any) => boolean;

    removeStartingSlash?: boolean;

    preloads?: string[];
    prefetches?: string[];
}

export class CustomizeAssetsHtmlWebpackPlugin {
    private publicPath = '';

    constructor(private readonly options: CustomizeAssetsHtmlPluginOptions) { }

    apply(compiler: any): void {
        compiler.plugin('compilation',
            (compilation: any) => {
                compilation.plugin('html-webpack-plugin-before-html-generation',
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

                        let publicPath = '';
                        if (htmlPluginArgs.assets &&
                            htmlPluginArgs.assets.publicPath &&
                            htmlPluginArgs.assets.publicPath !== '/') {
                            publicPath = htmlPluginArgs.assets.publicPath;
                            const endsWithSlashRegex = /\/$/;
                            const startWithSlashRegex = /^\/\w/;
                            publicPath = endsWithSlashRegex.test(publicPath) ? publicPath : publicPath + '/';
                            publicPath = startWithSlashRegex.test(publicPath) ? publicPath.substr(1) : publicPath;
                        }
                        this.publicPath = publicPath;

                        if (!this.options.scriptAssets && !this.options.cssLinkAssets) {
                            return cb(null, htmlPluginArgs);
                        }

                        if (this.options.cssLinkAssets) {
                            const customLinks: string[] = [];
                            const links = this.options.cssLinkAssets as string[];
                            links.forEach((l: string) => {
                                l = this.publicPath ? this.publicPath + l : l;
                                customLinks.push(l);
                            });

                            htmlPluginArgs.plugin.options.customLinks = htmlPluginArgs.plugin.options.customLinks || [];
                            htmlPluginArgs.plugin.options.customLinks.push(...customLinks);
                        }

                        if (this.options.scriptAssets) {
                            const customScripts: string[] = [];
                            const scripts = this.options.scriptAssets as string[];
                            scripts.forEach((s: string) => {
                                s = this.publicPath ? this.publicPath + s : s;
                                customScripts.push(s);
                            });

                            htmlPluginArgs.plugin.options.customScripts = htmlPluginArgs.plugin.options.customScripts || [];
                            htmlPluginArgs.plugin.options.customScripts.push(...customScripts);
                        }

                        return cb(null, htmlPluginArgs);
                    });

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
                            htmlPluginArgs.head =
                                updateAttributesFn(htmlPluginArgs.head, 'link', customLinkAttributes, customLinkAttributeExcludes);
                            htmlPluginArgs.body =
                                updateAttributesFn(htmlPluginArgs.body, 'link', customLinkAttributes, customLinkAttributeExcludes);
                        }
                        if (customScriptAttributes && Object.keys(customScriptAttributes).length) {
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

                        // custom links and scripts
                        const customLinks = this.options.cssLinkAssets || [];
                        const customScripts = this.options.scriptAssets || [];
                        const customHeadEntries: any[] = [];
                        const customBodyEntries: any[] = [];
                        customLinks.forEach((url: string) => {
                            url = this.publicPath ? this.publicPath + url : url;
                            const selectedEntries = this.options.linksPosition === 'body' ? customBodyEntries : customHeadEntries;
                            const tag = {
                                tagName: 'link',
                                selfClosingTag: true,
                                attributes: {
                                    rel: 'stylesheet',
                                    href: url
                                }
                            };
                            let assignCustomAttributes = true;
                            if (customLinkAttributeExcludes && customLinkAttributeExcludes.length) {
                                customLinkAttributeExcludes.forEach(p => {
                                    if (minimatch(url, p)) {
                                        assignCustomAttributes = false;
                                    }
                                });
                            }
                            if (assignCustomAttributes) {
                                tag.attributes = Object.assign({}, tag.attributes, customLinkAttributes);
                            }
                            selectedEntries.push(tag);
                        });
                        customScripts.forEach((url: string) => {
                            url = this.publicPath ? this.publicPath + url : url;
                            const selectedEntries = this.options.scriptsPosition === 'head' ? customHeadEntries : customBodyEntries;
                            const tag = {
                                tagName: 'script',
                                closeTag: true,
                                attributes: {
                                    type: 'text/javascript',
                                    src: url
                                }
                            };

                            let assignCustomAttributes = true;
                            if (customScriptAttributeExcludes && customScriptAttributeExcludes.length) {
                                customScriptAttributeExcludes.forEach(p => {
                                    if (minimatch(url, p)) {
                                        assignCustomAttributes = false;
                                    }
                                });
                            }
                            if (assignCustomAttributes) {
                                tag.attributes = Object.assign({}, tag.attributes, customScriptAttributes);
                            }
                            selectedEntries.push(tag);
                        });
                        if (customHeadEntries.length) {
                            htmlPluginArgs.head = customHeadEntries.concat(htmlPluginArgs.head);
                        }
                        if (customBodyEntries.length) {
                            htmlPluginArgs.body = customBodyEntries.concat(htmlPluginArgs.body);
                        }

                        // resource hints
                        // See - https://w3c.github.io/preload/#link-type-preload
                        // See - https://hackernoon.com/10-things-i-learned-making-the-fastest-site-in-the-world-18a0e1cdf4a7
                        const createResourceHintTagFn = (href: string, rel: string): any => {
                            const tag = {
                                tagName: 'link',
                                selfClosingTag: true,
                                attributes: {
                                    rel: rel,
                                    href: href
                                }
                            };

                            let assignCustomAttributes = true;
                            if (customLinkAttributeExcludes && customLinkAttributeExcludes.length) {
                                customLinkAttributeExcludes.forEach(p => {
                                    if (minimatch(href, p)) {
                                        assignCustomAttributes = false;
                                    }
                                });
                            }
                            if (assignCustomAttributes) {
                                tag.attributes = Object.assign({}, tag.attributes, customLinkAttributes);
                            }

                            if (/\.js$/i.test(href)) {
                                (tag.attributes as any).as = 'script';
                            } else if (/\.css$/i.test(href)) {
                                (tag.attributes as any).as = 'style';
                            } else if (/\.(otf|ttf|woff|woff2|eot)(\?v=\d+\.\d+\.\d+)?$/i.test(href)) {
                                (tag.attributes as any).as = 'font';
                            } else if (/\.(jpe?g|png|webp|gif|cur|ani|svg)$/i.test(href)) {
                                (tag.attributes as any).as = 'image';
                            }
                            return tag;
                        };
                        const preloads = this.options.preloads || [];
                        const prefetches = this.options.prefetches || [];
                        if (preloads.length || prefetches.length) {
                            const preloadTags: any[] = [];
                            preloads.forEach(p => {
                                if (p.indexOf('*') === -1) {
                                    const tag = createResourceHintTagFn(p, 'preload');
                                    preloadTags.push(tag);
                                } else {
                                    const tags = htmlPluginArgs.body
                                        .map((tag: any) => tag.attributes.src || tag.attributes.href)
                                        .filter((url: string) => !!url && minimatch(url, p))
                                        .map((url: string) => createResourceHintTagFn(url, 'preload'));
                                    preloadTags.push(...tags);
                                }
                            });

                            const prefetchTags: any[] = [];
                            prefetches.forEach(p => {
                                if (p.indexOf('*') === -1) {
                                    const tag = createResourceHintTagFn(p, 'prefetch');
                                    prefetchTags.push(tag);
                                } else {
                                    const tags = htmlPluginArgs.body
                                        .map((tag: any) => tag.attributes.src || tag.attributes.href)
                                        .filter((url: string) => !!url && minimatch(url, p))
                                        .map((url: string) => createResourceHintTagFn(url, 'prefetch'));
                                    prefetchTags.push(...tags);
                                }
                            });

                            if (this.options.clearHeadAssets) {
                                htmlPluginArgs.head = [];
                                hasClearHeadAssets = true;
                            }
                            if (this.options.clearBodyAssets) {
                                htmlPluginArgs.body = [];
                                hasClearBodyAssets = true;
                            }

                            if (prefetchTags.length) {
                                htmlPluginArgs.head = prefetchTags.concat(htmlPluginArgs.head);
                            }
                            if (preloadTags.length) {
                                htmlPluginArgs.head = preloadTags.concat(htmlPluginArgs.head);
                            }
                        }

                        // filter
                        if (this.options.assetTagsFilterFunc) {
                            const filterFn = this.options.assetTagsFilterFunc;
                            htmlPluginArgs.head = htmlPluginArgs.head.filter(filterFn);
                            htmlPluginArgs.body = htmlPluginArgs.body.filter(filterFn);
                        }

                        // move
                        if (this.options.moveHeadAssetsToBody) {
                            htmlPluginArgs.body = htmlPluginArgs.head.concat(htmlPluginArgs.body);
                            htmlPluginArgs.head = [];
                        }
                        if (this.options.moveBodyAssetsToHead) {
                            htmlPluginArgs.head = htmlPluginArgs.head.concat(htmlPluginArgs.body);
                            htmlPluginArgs.body = [];
                        }

                        // clear
                        if (this.options.clearHeadAssets && !hasClearHeadAssets) {
                            htmlPluginArgs.head = [];
                        }
                        if (this.options.clearBodyAssets && !hasClearBodyAssets) {
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
                            htmlPluginArgs.head = removeStartingSlashFn(htmlPluginArgs.head);
                            htmlPluginArgs.body = removeStartingSlashFn(htmlPluginArgs.body);
                        }

                        return cb(null, htmlPluginArgs);
                    });
            });
    }
}
