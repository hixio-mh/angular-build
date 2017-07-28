export interface DllAssetsReferencePluginOptions {
    manifest: string;
    name: string;
    targetHtmlWebpackPluginIdsForLinks?: string[];
    targetHtmlWebpackPluginIdsForScripts?: string[];
    customLinkAttributes?: { [key: string]: string | boolean };
    customScriptAttributes?: { [key: string]: string | boolean };
    linksPosition?: 'head' | 'body';
    scriptsPosition?: 'head' | 'body';
}

export class DllAssetsReferenceWebpackPlugin {
    private publicPath = '';
    private cssLinks: string[] = [];
    private scripts: string[] = [];

    constructor(private readonly options: DllAssetsReferencePluginOptions) {
    }

    apply(compiler: any): void {
        compiler.plugin('before-compile', (params: any, callback: any) => {
            const manifest = this.options.manifest;
            params.compilationDependencies.push(manifest);
            compiler.inputFileSystem.readFile(manifest, (err: any, result: any) => {
                if (err) {
                    return callback(err);
                }
                params[`dll assets reference ${manifest}`] = JSON.parse(result.toString('utf-8'));
                return callback();
            });
        });

        compiler.plugin('compile', (params: any) => {
            const manifestJson = params[`dll assets reference ${this.options.manifest}`];
            const vendorAssets: string[] = manifestJson[this.options.name];
            if (vendorAssets && Array.isArray(vendorAssets)) {
                vendorAssets.filter(asset => asset && /\.(js|css)$/i.test(asset)).forEach(asset => {
                    if (/\.js$/i.test(asset)) {
                        this.scripts.push(asset);
                    } else {
                        this.cssLinks.push(asset);
                    }
                });
            }

        });

        compiler.plugin('compilation',
            (compilation: any) => {
                compilation.plugin('html-webpack-plugin-before-html-generation',
                    (htmlPluginArgs: any, cb: any) => {
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
                        const customLinks: string[] = [];
                        const customScripts: string[] = [];

                        this.cssLinks.forEach((l: string) => {
                            l = this.publicPath ? this.publicPath + l : l;
                            customLinks.push(l);
                        });

                        this.scripts.forEach((s: string) => {
                            s = this.publicPath ? this.publicPath + s : s;
                            customScripts.push(s);
                        });

                        const targetHtmlWebpackPluginIdsForLinks = this.options.targetHtmlWebpackPluginIdsForLinks || [];
                        if (!targetHtmlWebpackPluginIdsForLinks.length ||
                            (targetHtmlWebpackPluginIdsForLinks.length &&
                                targetHtmlWebpackPluginIdsForLinks.indexOf(htmlPluginArgs.plugin.options.id) >
                                -1)) {
                            htmlPluginArgs.plugin.options.customLinks = htmlPluginArgs.plugin.options.customLinks || [];
                            htmlPluginArgs.plugin.options.customLinks.push(...customLinks);
                        }

                        const targetHtmlWebpackPluginIdsForScripts = this.options.targetHtmlWebpackPluginIdsForScripts || [];
                        if (!targetHtmlWebpackPluginIdsForScripts.length ||
                            (targetHtmlWebpackPluginIdsForScripts.length &&
                                targetHtmlWebpackPluginIdsForScripts.indexOf(htmlPluginArgs.plugin.options.id) >
                                -1)) {
                            htmlPluginArgs.plugin.options.customScripts =
                                htmlPluginArgs.plugin.options.customScripts || [];
                            htmlPluginArgs.plugin.options.customScripts.push(...customScripts);
                        }


                        return cb(null, htmlPluginArgs);
                    });

                compilation.plugin('html-webpack-plugin-alter-asset-tags',
                    (htmlPluginArgs: any, cb: any) => {
                        const headEntries: any[] = [];
                        const bodyEntries: any[] = [];
                        const customLinkAttributes = this.options.customLinkAttributes || {};
                        const customScriptAttributes = this.options.customScriptAttributes || {};

                        const targetHtmlWebpackPluginIdsForLinks = this.options.targetHtmlWebpackPluginIdsForLinks || [];
                        if (!targetHtmlWebpackPluginIdsForLinks.length ||
                            (targetHtmlWebpackPluginIdsForLinks.length &&
                                targetHtmlWebpackPluginIdsForLinks.indexOf(htmlPluginArgs.plugin.options.id) >
                                -1)) {
                            this.cssLinks.forEach((l: string) => {
                                l = this.publicPath ? this.publicPath + l : l;
                                const selectedEntries = this.options.linksPosition === 'body' ? bodyEntries : headEntries;
                                selectedEntries.push({
                                    tagName: 'link',
                                    selfClosingTag: true,
                                    attributes: Object.assign({
                                        rel: 'stylesheet',
                                        href: l
                                    }, customLinkAttributes)
                                });
                            });
                            if (headEntries.length) {
                                htmlPluginArgs.head = headEntries.concat(htmlPluginArgs.head);
                            }
                            if (bodyEntries.length) {
                                htmlPluginArgs.body = bodyEntries.concat(htmlPluginArgs.body);
                            }
                        }

                        const targetHtmlWebpackPluginIdsForScripts = this.options.targetHtmlWebpackPluginIdsForScripts || [];
                        if (!targetHtmlWebpackPluginIdsForScripts.length ||
                            (targetHtmlWebpackPluginIdsForScripts.length &&
                                targetHtmlWebpackPluginIdsForScripts.indexOf(htmlPluginArgs.plugin.options.id) >
                                -1)) {
                            this.scripts.forEach((s: string) => {
                                s = this.publicPath ? this.publicPath + s : s;
                                const selectedEntries = this.options.scriptsPosition === 'head' ? headEntries : bodyEntries;
                                selectedEntries.push({
                                    tagName: 'script',
                                    closeTag: true,
                                    attributes: Object.assign({
                                        type: 'text/javascript',
                                        src: s
                                    },
                                        customScriptAttributes)
                                });
                            });
                            if (headEntries.length) {
                                htmlPluginArgs.head = headEntries.concat(htmlPluginArgs.head);
                            }
                            if (bodyEntries.length) {
                                htmlPluginArgs.body = bodyEntries.concat(htmlPluginArgs.body);
                            }
                        }

                        return cb(null, htmlPluginArgs);
                    });
            });
    }
}
