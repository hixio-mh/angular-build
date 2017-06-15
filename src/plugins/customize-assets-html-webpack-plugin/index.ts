export class CustomizeAssetsHtmlPluginOptions {
    targetHtmlWebpackPluginIds?: string[];

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

    removeStartingSlash?: boolean;
}

export class CustomizeAssetsHtmlWebpackPlugin {
    private publicPath = '';

    constructor(private readonly options: CustomizeAssetsHtmlPluginOptions) { }

    apply(compiler: any): void {
        compiler.plugin('compilation',
            (compilation: any) => {

                compilation.plugin('html-webpack-plugin-before-html-generation',
                    (htmlPluginArgs: any, callback: any) => {

                        const targetHtmlWebpackPluginIds = this.options.targetHtmlWebpackPluginIds || [];

                        let isTargetHtmlWebpackPlugin = false;
                        if (!targetHtmlWebpackPluginIds.length ||
                        (targetHtmlWebpackPluginIds.length &&
                            targetHtmlWebpackPluginIds.indexOf(htmlPluginArgs.plugin.options.id) >
                            -1)) {
                            isTargetHtmlWebpackPlugin = true;
                        }

                        if (!isTargetHtmlWebpackPlugin) {
                            return callback(null, htmlPluginArgs);
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
                        this.publicPath = publicPath;

                        const customCss: string[] = [];
                        const customScripts: string[] = [];
                        const cssSrcToHeadAssets = this.options.cssSrcToHeadAssets || [];
                        const scriptSrcToHeadAssets = this.options.scriptSrcToHeadAssets || [];
                        const cssSrcToBodyAssets = this.options.cssSrcToBodyAssets || [];
                        const scriptSrcToBodyAssets = this.options.scriptSrcToBodyAssets || [];

                        if (cssSrcToHeadAssets.length) {
                            cssSrcToHeadAssets.forEach((css: string) => {
                                css = (this.options.addPublicPath && this.publicPath) ? this.publicPath + css : css;
                                customCss.push(css);
                            });
                        }
                        if (scriptSrcToHeadAssets.length) {
                            scriptSrcToHeadAssets.forEach((script: string) => {
                                script = (this.options.addPublicPath && this.publicPath)
                                    ? this.publicPath + script
                                    : script;
                                customScripts.push(script);
                            });
                        }

                        // body
                        if (cssSrcToBodyAssets.length) {
                            cssSrcToBodyAssets.forEach((css: string) => {
                                css = (this.options.addPublicPath && this.publicPath) ? this.publicPath + css : css;
                                customCss.push(css);
                            });
                        }
                        if (scriptSrcToBodyAssets.length) {
                            scriptSrcToBodyAssets.forEach((script: string) => {
                                script = (this.options.addPublicPath && this.publicPath)
                                    ? this.publicPath + script
                                    : script;
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
                        const cssSrcToHeadAssets = this.options.cssSrcToHeadAssets || [];
                        const scriptSrcToHeadAssets = this.options.scriptSrcToHeadAssets || [];
                        const cssSrcToBodyAssets = this.options.cssSrcToBodyAssets || [];
                        const scriptSrcToBodyAssets = this.options.scriptSrcToBodyAssets || [];

                        const targetHtmlWebpackPluginIds = this.options.targetHtmlWebpackPluginIds || [];

                        let isTargetHtmlWebpackPlugin = false;
                        if (targetHtmlWebpackPluginIds.length ||
                        (targetHtmlWebpackPluginIds.length &&
                            targetHtmlWebpackPluginIds.indexOf(htmlPluginArgs.plugin.options.id) >
                            -1)) {
                            isTargetHtmlWebpackPlugin = true;
                        }

                        if (!isTargetHtmlWebpackPlugin) {
                            return callback(null, htmlPluginArgs);
                        }

                        // head
                        const headEntries: any[] = [];
                        if (cssSrcToHeadAssets.length) {
                            cssSrcToHeadAssets.forEach((css: string) => {
                                css = (this.options.addPublicPath && this.publicPath) ? this.publicPath + css : css;
                                headEntries.push({
                                    tagName: 'link',
                                    closeTag: true,
                                    attributes: { href: css }
                                });
                            });
                        }

                        if (scriptSrcToHeadAssets.length) {
                            scriptSrcToHeadAssets.forEach((script: string) => {
                                script = (this.options.addPublicPath && this.publicPath)
                                    ? this.publicPath + script
                                    : script;
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
                        if (cssSrcToBodyAssets.length) {
                            cssSrcToBodyAssets.forEach((css: string) => {
                                css = (this.options.addPublicPath && this.publicPath) ? this.publicPath + css : css;
                                bodyEntries.push({
                                    tagName: 'link',
                                    closeTag: true,
                                    attributes: { href: css }
                                });
                            });
                        }
                        if (scriptSrcToBodyAssets.length) {
                            scriptSrcToBodyAssets.forEach((script: string) => {
                                script = (this.options.addPublicPath && this.publicPath)
                                    ? this.publicPath + script
                                    : script;
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
                        const updateAttributesFn = (tags: any[],
                                targetTagName: string,
                                attributes: { [key: string]: string | boolean }) =>
                            tags.map((tag: any) => {
                                if (tag.tagName === targetTagName) {
                                    Object.keys(attributes).forEach((key: string) => {
                                        tag.attributes[key] = attributes[key].toString();
                                    });
                                }
                                return tag;
                            });

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

                        // TODO:
                        const customAttributes = htmlPluginArgs.plugin.options.customAttributes;
                        if (customAttributes && customAttributes.length) {
                            let customLinkAttributes: { [key: string]: string | boolean } | null = null;
                            const linkAttributes = customAttributes
                                .filter((c: any) => c.tagName === 'link').map((c: any) => c.attribute);
                            if (linkAttributes.length) {
                                customLinkAttributes = linkAttributes
                                    .reduce((prev: { [key: string]: string | boolean },
                                        next: { [key: string]: string | boolean }) => {
                                        return Object.assign({}, prev, next);
                                    });
                            }

                            let customScriptAttributes: { [key: string]: string | boolean } | null = null;
                            const scriptAttributes = customAttributes
                                .filter((c: any) => c.tagName === 'script').map((c: any) => c.attribute);
                            if (scriptAttributes.length) {
                                customScriptAttributes = scriptAttributes
                                    .reduce((prev: { [key: string]: string | boolean },
                                        next: { [key: string]: string | boolean }) => {
                                        return Object.assign({}, prev, next);
                                    });
                            }

                            if (customLinkAttributes) {
                                htmlPluginArgs.head =
                                    updateAttributesFn(htmlPluginArgs.head, 'link', customLinkAttributes);
                                htmlPluginArgs.body =
                                    updateAttributesFn(htmlPluginArgs.body, 'link', customLinkAttributes);
                            }
                            if (customScriptAttributes) {
                                htmlPluginArgs.head =
                                    updateAttributesFn(htmlPluginArgs.head, 'script', customScriptAttributes);
                                htmlPluginArgs.body =
                                    updateAttributesFn(htmlPluginArgs.body, 'script', customScriptAttributes);
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
