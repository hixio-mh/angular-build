export class CustomizeAssetsHtmlPluginOptions {
    targetHtmlWebpackPluginId?: string;

    clearHeadAssets?: boolean;
    clearBodyAssets?: boolean;
    moveHeadAssetsToBody?: boolean;
    moveBodyAssetsToHead?: boolean;

    cssSrcToHeadAssets?: string[];
    scriptSrcToHeadAssets?: string[];

    cssSrcToBodyAssets?: string[];
    scriptSrcToBodyAssets?: string[];

    addPublicPath?: boolean;

    // filter
    assetTagsFilterFunc?: (tag: any) => boolean;

    // attributes
    customAttributes?: {
        tagName: string;
        attribute: { [key: string]: string | boolean };
    }[];

    removeStartingSlash?: boolean;
}

export class CustomizeAssetsHtmlWebpackPlugin {
    private publicPath = '';
    private isTargetHtmlWebpackPlugin = false;

    constructor(private readonly options: CustomizeAssetsHtmlPluginOptions) { }

    apply(compiler: any): void {
        compiler.plugin('compilation',
            (compilation: any) => {

                compilation.plugin('html-webpack-plugin-before-html-generation',
                    (htmlPluginArgs: any, callback: any) => {

                        if (!this.options.targetHtmlWebpackPluginId ||
                            (this.options.targetHtmlWebpackPluginId &&
                                this.options.targetHtmlWebpackPluginId === htmlPluginArgs.plugin.options.id)) {
                            this.isTargetHtmlWebpackPlugin = true;
                        } else {
                            this.isTargetHtmlWebpackPlugin = false;
                        }
                        if (!this.isTargetHtmlWebpackPlugin) {
                            return callback(null, htmlPluginArgs);
                        }

                        let publicPath = '';
                        if (htmlPluginArgs.assets && htmlPluginArgs.assets.publicPath && htmlPluginArgs.assets.publicPath !== '/') {
                            publicPath = htmlPluginArgs.assets.publicPath;
                            const endsWithBsRegex = /\/$/;
                            const startWithBsRegex = /^\/\w/;
                            publicPath = endsWithBsRegex.test(publicPath) ? publicPath : publicPath + '/';
                            publicPath = startWithBsRegex.test(publicPath) ? publicPath.substring(1) : publicPath;
                        }
                        this.publicPath = publicPath;

                        const customCss: string[] = [];
                        const customScripts: string[] = [];

                        if (this.options.cssSrcToHeadAssets && this.options.cssSrcToHeadAssets.length) {
                            this.options.cssSrcToHeadAssets.forEach((css: string) => {
                                css = (this.options.addPublicPath && this.publicPath) ? this.publicPath + css : css;
                                customCss.push(css);
                            });
                        }
                        if (this.options.scriptSrcToHeadAssets && this.options.scriptSrcToHeadAssets.length) {
                            this.options.scriptSrcToHeadAssets.forEach((script: string) => {
                                script = (this.options.addPublicPath && this.publicPath) ? this.publicPath + script : script;
                                customScripts.push(script);
                            });
                        }

                        // body
                        if (this.options.cssSrcToBodyAssets && this.options.cssSrcToBodyAssets.length) {
                            this.options.cssSrcToBodyAssets.forEach((css: string) => {
                                css = (this.options.addPublicPath && this.publicPath) ? this.publicPath + css : css;
                                customCss.push(css);
                            });
                        }
                        if (this.options.scriptSrcToBodyAssets && this.options.scriptSrcToBodyAssets.length) {
                            this.options.scriptSrcToBodyAssets.forEach((script: string) => {
                                script = (this.options.addPublicPath && this.publicPath) ? this.publicPath + script : script;
                                customScripts.push(script);
                            });
                        }
                        htmlPluginArgs.plugin.options.customCss = htmlPluginArgs.plugin.options.customCss || [];
                        htmlPluginArgs.plugin.options.customScripts = htmlPluginArgs.plugin.options.customScripts || [];
                        htmlPluginArgs.plugin.options.customCss.push(...customCss);
                        htmlPluginArgs.plugin.options.customScripts.push(...customScripts);

                        return callback(null, htmlPluginArgs);
                    });

                compilation.plugin('html-webpack-plugin-alter-asset-tags',
                    (htmlPluginArgs: any, callback: any) => {

                        if (!this.isTargetHtmlWebpackPlugin) {
                            return callback(null, htmlPluginArgs);
                        }
                        // add
                        //if (this.options.customHeadTags) {
                        //  htmlPluginArgs.head = this.options.customHeadTagsUnshift
                        //    ? this.options.customHeadTags.concat(htmlPluginArgs.head)
                        //    : htmlPluginArgs.head.concat(this.options.customHeadTags);
                        //}
                        //if (this.options.customBodyTags) {
                        //  htmlPluginArgs.body = this.options.customBodyTagsUnshift
                        //    ? this.options.customBodyTags.concat(htmlPluginArgs.body)
                        //    : htmlPluginArgs.body.concat(this.options.customBodyTags);
                        //}
                        // head
                        const headEntries: any[] = [];
                        if (this.options.cssSrcToHeadAssets && this.options.cssSrcToHeadAssets.length) {
                            this.options.cssSrcToHeadAssets.forEach((css: string) => {
                                css = (this.options.addPublicPath && this.publicPath) ? this.publicPath + css : css;
                                headEntries.push({
                                    tagName: 'link',
                                    closeTag: true,
                                    attributes: { href: css }
                                });
                            });
                        }
                        if (this.options.scriptSrcToHeadAssets && this.options.scriptSrcToHeadAssets.length) {
                            this.options.scriptSrcToHeadAssets.forEach((script: string) => {
                                script = (this.options.addPublicPath && this.publicPath) ? this.publicPath + script : script;
                                headEntries.push({
                                    tagName: 'script',
                                    closeTag: true,
                                    attributes: {
                                        type: 'text/javascript',
                                        src: script
                                    }
                                });
                            });
                        }
                        if (headEntries.length) {
                            htmlPluginArgs.head = headEntries.concat(htmlPluginArgs.head);
                        }
                        // body
                        const bodyEntries: any[] = [];
                        if (this.options.cssSrcToBodyAssets && this.options.cssSrcToBodyAssets.length) {
                            this.options.cssSrcToBodyAssets.forEach((css: string) => {
                                css = (this.options.addPublicPath && this.publicPath) ? this.publicPath + css : css;
                                bodyEntries.push({
                                    tagName: 'link',
                                    closeTag: true,
                                    attributes: { href: css }
                                });
                            });
                        }
                        if (this.options.scriptSrcToBodyAssets && this.options.scriptSrcToBodyAssets.length) {
                            this.options.scriptSrcToBodyAssets.forEach((script: string) => {
                                script = (this.options.addPublicPath && this.publicPath) ? this.publicPath + script : script;
                                bodyEntries.push({
                                    tagName: 'script',
                                    closeTag: true,
                                    attributes: {
                                        type: 'text/javascript',
                                        src: script
                                    }
                                });
                            });
                        }
                        if (bodyEntries.length) {
                            htmlPluginArgs.body = bodyEntries.concat(htmlPluginArgs.body);
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
                        //
                        if (this.options.clearHeadAssets) {
                            htmlPluginArgs.head = [];
                        }
                        if (this.options.clearBodyAssets) {
                            htmlPluginArgs.body = [];
                        }

                        // *** Order is import
                        // add attributes
                        const updateAttributesFn = (tags: any[], targetTagName: string, attributes: { [key: string]: string | boolean }) =>
                            tags.map((tag: any) => {
                                if (tag.tagName === targetTagName) {
                                    Object.keys(attributes).forEach((key: string) => {
                                        tag.attributes[key] = attributes[key];
                                    });
                                }
                                return tag;
                            });

                        const removeStartingSlashFn = (tags: any[]) =>
                            tags.map((tag: any) => {
                                if ((tag.tagName === 'link' || tag.tagName === 'script') && tag.attributes && (tag.attributes['href'] || tag.attributes['src'])) {
                                    if (tag.attributes.href && tag.attributes.href.length > 1 && tag.attributes.href[0] === '/' && tag.attributes.href[1].match(/\w/i)) {
                                        tag.attributes.href = tag.attributes.href.substring(1);
                                    } else if (tag.attributes.src && tag.attributes.src.length > 1 && tag.attributes.src[0] === '/' && tag.attributes.src[1].match(/\w/i)) {
                                        tag.attributes.src = tag.attributes.src.substring(1);
                                    }
                                }
                                return tag;
                            });

                        if (this.options && this.options.customAttributes) {
                            const customLinkAttributes = this.options.customAttributes
                                .filter(c => c.tagName === 'link').map(c => c.attribute)
                                .reduce((prev: { [key: string]: string | boolean }, next: { [key: string]: string | boolean }) => {
                                    return Object.assign(prev, next);
                                });
                            const customScriptAttributes = this.options.customAttributes
                                .filter(c => c.tagName === 'script').map(c => c.attribute)
                                .reduce((prev: { [key: string]: string | boolean }, next: { [key: string]: string | boolean }) => {
                                    return Object.assign(prev, next);
                                });
                            if (customLinkAttributes) {
                                htmlPluginArgs
                                    .head =
                                    updateAttributesFn(htmlPluginArgs.head, 'link', customLinkAttributes);
                                htmlPluginArgs
                                    .body =
                                    updateAttributesFn(htmlPluginArgs.body, 'link', customLinkAttributes);
                            }
                            if (customScriptAttributes) {
                                htmlPluginArgs.head = updateAttributesFn(htmlPluginArgs.head, 'script', customScriptAttributes);
                                htmlPluginArgs.body = updateAttributesFn(htmlPluginArgs.body, 'script', customScriptAttributes);
                            }
                        }

                        // *** Order is import
                        // remove starting slash
                        if (this.options.removeStartingSlash) {
                            htmlPluginArgs.head = removeStartingSlashFn(htmlPluginArgs.head);
                            htmlPluginArgs.body = removeStartingSlashFn(htmlPluginArgs.body);
                        }

                        return callback(null, htmlPluginArgs);
                    });
            });
    }
}
