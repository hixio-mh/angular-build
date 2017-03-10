/**
 * Credits
  * jantimon/favicons-webpack-plugin - https://github.com/jantimon/favicons-webpack-plugin
 *
 * Ref:
 * haydenbleasel/favicons - https://github.com/haydenbleasel/favicons
 *webpack/docs - https://github.com/webpack/docs/wiki/plugins
 */
// Ref: webpack/docs - https://github.com/webpack/docs/wiki/plugins
// Ref: webpack/docs - https://github.com/webpack/docs/wiki/how-to-write-a-plugin
// Ref:ampedandwired/html-webpack-plugin - https://github.com/ampedandwired/html-webpack-plugin

import * as path from 'path';

// ReSharper disable InconsistentNaming
const NodeTemplatePlugin = require('webpack/lib/node/NodeTemplatePlugin');
const NodeTargetPlugin = require('webpack/lib/node/NodeTargetPlugin');
const LoaderTargetPlugin = require('webpack/lib/LoaderTargetPlugin');
const SingleEntryPlugin = require('webpack/lib/SingleEntryPlugin');
// ReSharper restore InconsistentNaming

import { IconPluginOptions } from './models';
import { readJsonSync } from './utils';

// ReSharper disable once InconsistentNaming
export interface IconStatsResult {
    outputName: string;
    stats: {
        html: string[];
    };
}

// ReSharper disable once InconsistentNaming
//export interface HtmlPluginArgs
//{
//  html?: string;
//  assets?: {
//    publicPath?: string;
//    chunks?: {};
//    js?: string[];
//    css?: string[];
//  },
//  plugin?: {
//    options?: {
//      template?: string;
//      filename?: string;
//      hash?: boolean;
//      inject?: boolean|string;
//      compile?: boolean;
//      favicon?: string;
//      minify?: boolean | {}; // See: https://github.com/kangax/html-minifier#options-quick-reference
//      cache?: boolean;
//      showErrors?: boolean;
//      chunks?: string|string[];
//      excludeChunks?: string[];
//      title?: string;
//      xhtml?: boolean;

//      // custom added
//      id?: string;
//      customAttributes?: any;
//      //faviconStats?: any;
//    };
//    childCompilerHash?: string;
//    childCompilationOutputName?: string;
//    assetJson?: string;
//  },
//  outputName?: string;
//}

export class IconWebpackPlugin {

    private readonly defaultPluginOptions: IconPluginOptions = {
        masterPicture: null,
        iconsPath: 'icons-[hash]/',
        emitStats: false,
        statsFilename: 'iconstats.json',
        persistentCache: true,
        online: false,
        preferOnline: false,
        settings: {
            scalingAlgorithm: 'Mitchell',
            errorOnImageTooSmall: false
        }
    };

    private readonly rawOptions: IconPluginOptions | string;
    private options: IconPluginOptions;
    private optionInitialized: boolean;

    private context: string;
    private iconStatsResult: IconStatsResult = null;
    private childComplier: ChildComplier = null;
    private isTargetHtmlWebpackPlugin = false;

    constructor(options: IconPluginOptions | string) {
        if (!options) {
            throw new Error('"options" is required');
        }
        this.rawOptions = options;
    }

    private initOptions(context: string): void {

        if (this.optionInitialized) {
            return;
        }

        // may be config file or icon file.
        if (typeof this.rawOptions == 'string') {
            const str = this.rawOptions as string;
            if (str.match(/\.json$/i)) {
                const pathAbsolute = path.isAbsolute(str) ? str : path.resolve(context, str);
                this.options = Object.assign({}, this.defaultPluginOptions, readJsonSync(pathAbsolute));
            } else if (str.match(/\.(png|jpe?g|svg|bmp)$/i)) {
                const pathAbsolute = path.isAbsolute(str) ? str : path.resolve(context, str);
                this.options = Object.assign({}, this.defaultPluginOptions, { masterPicture: pathAbsolute });
            } else {
                throw new Error('Invalid options.');
            }
        } else {
            if (typeof this.rawOptions !== 'object') {
                throw new Error('Invalid options.');
            }

            if (!this.rawOptions.masterPicture) {
                throw new Error('"masterPicture" is required.');
            }

            this.options = Object.assign({}, this.defaultPluginOptions, this.rawOptions);
        }

        if (this.options.iconsPath) {
            this.options.iconsPath = /\/$/.test(this.options.iconsPath)
                ? this.options.iconsPath
                : this.options.iconsPath + '/';
        }

        this.optionInitialized = true;
    }

    apply(compiler: any): void {

        this.context = compiler.context || compiler.options.context;
        this.initOptions(this.context);

        compiler.plugin('make',
            (compilation: any, cb: (err?: Error, request?: any) => void) => {
                this.childComplier = new ChildComplier(this.context, compilation);

                this.childComplier.compileTemplate(this.options)
                    .then((result: IconStatsResult) => {
                        this.iconStatsResult = result;
                        cb();
                    })
                    .catch(cb);
            });


        compiler.plugin('compilation',
            (compilation: any) => {

                compilation.plugin('html-webpack-plugin-before-html-generation',
                    (htmlPluginArgs: any, callback: (err: Error, htmlPluginArgs?: any) => void) => {

                        if (!this.options.targetHtmlWebpackPluginIds || !this.options.targetHtmlWebpackPluginIds.length ||
                            (this.options.targetHtmlWebpackPluginIds && this.options.targetHtmlWebpackPluginIds.length &&
                                this.options.targetHtmlWebpackPluginIds.indexOf(htmlPluginArgs.plugin.options.id) > -1)) {
                            this.isTargetHtmlWebpackPlugin = true;
                        } else {
                            this.isTargetHtmlWebpackPlugin = false;
                        }
                        if (!this.isTargetHtmlWebpackPlugin) {
                            return callback(null, htmlPluginArgs);
                        }

                        if (this.iconStatsResult &&
                            this.iconStatsResult.stats.html &&
                            this.iconStatsResult.stats.html.length) {

                            let faviconsTags: string[] = [];
                            if (htmlPluginArgs.assets.publicPath && htmlPluginArgs.assets.publicPath !== '/') {
                                let publicPath = htmlPluginArgs.assets.publicPath;
                                const endsWithBsRegex = /\/$/;
                                const startWithBsRegex = /^\/\w/;
                                publicPath = endsWithBsRegex.test(publicPath) ? publicPath : publicPath + '/';
                                publicPath = startWithBsRegex.test(publicPath) ? publicPath.substring(1) : publicPath;

                                faviconsTags = this.iconStatsResult.stats.html.map((tag: any) => {
                                    return tag.replace(/href=\"/i, `href="${publicPath}`);
                                });
                            } else {
                                faviconsTags.push(...this.iconStatsResult.stats.html);
                            }

                            htmlPluginArgs.plugin.options['favicons'] = {
                                tags: faviconsTags
                            };
                        }

                        return callback(null, htmlPluginArgs);
                    });


                compilation.plugin('html-webpack-plugin-before-html-processing',
                    (htmlPluginArgs: any, callback: (err: Error, htmlPluginArgs?: any) => void) => {

                        if (!this.isTargetHtmlWebpackPlugin ||
                            !htmlPluginArgs.plugin.options['favicons'] ||
                            !htmlPluginArgs.plugin.options['favicons'].tags) {
                            return callback(null, htmlPluginArgs);
                        }

                        //if (this.options.seperateOutput) {
                        //    htmlPluginArgs.html = '';
                        //} else {
                        //    htmlPluginArgs.html = htmlPluginArgs.html || '';
                        //}
                        htmlPluginArgs.html = htmlPluginArgs.html || '';

                        let faviconsTags = <string[]>htmlPluginArgs.plugin.options['favicons'].tags;

                        //if (htmlPluginArgs.plugin.options.customAttributes && htmlPluginArgs.plugin.options.customAttributes.linkAttributes) {
                        //    const linkAttributes = <{ [key: string]: string }>htmlPluginArgs.plugin.options
                        //        .customAttributes.linkAttributes;
                        //    const linkAttributesStr = Object.keys(linkAttributes).map((key: string) => {
                        //        return `${key}="${linkAttributes[key].toString()}"`;
                        //    }).join(' ');

                        //    const linkRegex = /^\<link\s+.*\/?\>$/i;
                        //    faviconsTags = faviconsTags.map((tag: string) => {
                        //        if (tag.match(linkRegex)) {
                        //            return tag.replace(/(\/?\>)/i, ` ${linkAttributesStr}$&`);
                        //        }
                        //        return tag;
                        //    });
                        //}

                        if (htmlPluginArgs.html.match(/(<\/head>)/i)) {
                            htmlPluginArgs.html = htmlPluginArgs.html.replace(
                                /(<\/head>)/i,
                                `  ${faviconsTags.join('\n  ')}\n$&`);
                        } else {
                            htmlPluginArgs.html = `${htmlPluginArgs.html.trim()}\n${faviconsTags.join('\n')}\n`;
                            //if (this.options.seperateOutput) {
                            //    htmlPluginArgs.html = htmlPluginArgs.html.trim();
                            //}
                        }

                        callback(null, htmlPluginArgs);
                    });
            });

        if (!this.options.emitStats) {
            compiler.plugin('emit',
                (compilation: any, cb: any) => {
                    if (this.iconStatsResult && this.iconStatsResult.outputName) {
                        delete compilation.assets[this.iconStatsResult.outputName];
                    }
                    cb();
                });
        }
    }
}

export class ChildComplier {

    constructor(private readonly context: string, private readonly parentCompilation: any) {
    }

    compileTemplate(options: IconPluginOptions): Promise<IconStatsResult> {

        var outputOptions = {
            filename: options.statsFilename,
            publicPath: this.parentCompilation.outputOptions.publicPath
        };

        const compilerName = this.getCompilerName(this.context, outputOptions.filename);
        const childCompiler = this.parentCompilation.createChildCompiler(compilerName, outputOptions);
        childCompiler.context = this.context;

        const loaderOptions: any = Object.assign({}, options);
        if (loaderOptions['masterPicture']) {
            delete loaderOptions['masterPicture'];
        }
        // adding !! to a request will disable all loaders specified in the configuration
        const templateEntry = `!!${require.resolve('./icon-loader')}?${JSON.stringify(loaderOptions)}!${options
            .masterPicture}`;

        childCompiler.apply(
            new NodeTemplatePlugin(outputOptions),
            new NodeTargetPlugin(),
            new SingleEntryPlugin(this.context, templateEntry),
            new LoaderTargetPlugin('node')
        );

        // Store the result of the parent compilation before we start the child compilation
        const assetsBeforeCompilation = Object.assign(
            {},
            this.parentCompilation.assets[outputOptions.filename]
        );

        // Fix for "Uncaught TypeError: __webpack_require__(...) is not a function"
        // Hot module replacement requires that every child compiler has its own
        // cache. @see https://github.com/ampedandwired/html-webpack-plugin/pull/179
        childCompiler.plugin('compilation',
            (childCompilation: any) => {
                if (childCompilation.cache) {
                    if (!childCompilation.cache[compilerName]) {
                        childCompilation.cache[compilerName] = {};
                    }
                    childCompilation.cache = childCompilation.cache[compilerName];
                }

                childCompilation.plugin('optimize-chunk-assets',
                    (chunks: any[], cb: any) => {
                        if (!chunks[0]) {
                            return cb(childCompilation.errors[0] || 'Favicons generation failed');
                        }

                        const resultFile = chunks[0].files[0]; // iconstats.json
                        const resultCode = childCompilation.assets[resultFile].source(); // module.exports = {"iconsPath":"icons/","html":["<meta name=\"mobile-web-app-capable\" ....
                        let resultJson: string;
                        try {
                            /* eslint no-eval:0 */
                            const result = eval(resultCode);
                            resultJson = JSON.stringify(result);
                        } catch (e) {
                            return cb(e);
                        }

                        childCompilation.assets[resultFile] = {
                            source() {
                                return resultJson;
                            },
                            size() {
                                return resultJson.length;
                            }
                        };

                        return cb(null);
                    });
            });

        // Compile and return a promise
        return new Promise((resolve: any, reject: any) => {
            childCompiler.runAsChild((err: Error, entries: any[], childCompilation: any) => {
                // Resolve / reject the promise
                if (childCompilation && childCompilation.errors && childCompilation.errors.length) {
                    const errorDetails = childCompilation.errors
                        .map((error: any) => error.message + (error.error ? `:\n${error.error}` : '')).join('\n');
                    reject(new Error(`Child compilation failed:\n${errorDetails}`));
                } else if (err) {
                    reject(err);
                } else {
                    // Replace [hash] placeholders in filename
                    const outputName = this.parentCompilation.mainTemplate.applyPluginsWaterfall(
                        'asset-path',
                        outputOptions.filename,
                        {
                            hash: childCompilation.hash,
                            chunk: entries[0]
                        });

                    // Restore the parent compilation to the state like it was before the child compilation.
                    this.parentCompilation.assets[outputName] = assetsBeforeCompilation[outputName];
                    if (assetsBeforeCompilation[outputName] === undefined) {
                        // If it wasn't there - delete it.
                        delete this.parentCompilation.assets[outputName];
                    }

                    const compilationResult: IconStatsResult = {
                        // Hash of the template entry point.
                        //hash: entries[0].hash,
                        outputName: outputName,
                        stats: JSON.parse(childCompilation.assets[outputName].source())
                    };
                    resolve(compilationResult);
                }
            });
        });
    }

    private getCompilerName(context: string, filename: string): string {
        const absolutePath = path.resolve(context, filename);
        const relativePath = path.relative(context, absolutePath);
        return `icon-webpack-plugin for "${absolutePath.length < relativePath.length ? absolutePath : relativePath}"`;
    }
}
