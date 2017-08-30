// Add assets from `ConcatPlugin` to index.html.
// Ref: angular-cli - https://github.com/angular/angular-cli

import * as fs from 'fs';
import * as md5 from 'md5';
import * as uglify from 'uglify-js';

export class ScriptsConcatWebpackPluginOptions {
    inputs: string[];
    output: string;
    lazy?: boolean;
    appendHash?: boolean;
    minify?: boolean;
    sourceMap?: boolean;
    verbose?: boolean;
    targetHtmlWebpackPluginIds?: string[];
    customAttributes?: { [key: string]: string | boolean };
    injectPosition?: 'head' | 'body';
}

export class ScriptsConcatWebpackPlugin {
    private outputFileName = '';
    private readonly startTime: number;
    private prevTimestamps: any = {};
    private publicPath = '';

    private readonly uglifyNonMinifyOptions: any = {
        ie8: true, // default false
        compress: false,
        output: {
            comments: true,
        }
    };

    private readonly uglifyMinifiyOptions: any = {
        ie8: true, // default false
        compress: {
            passes: 3, // default 1
            negate_iife: false // default true, we need this for lazy v8
        },
        output: {
            comments: /^\**!|@preserve|@license/,
            beautify: false // default true
        }
    };

    constructor(private readonly options: ScriptsConcatWebpackPluginOptions) {
        this.startTime = Date.now();
    }


    md5File(fileMap: {[key: string]: any}): string {
        const content = Object.keys(fileMap)
            .reduce((fileContent: any, fileName: string) => (fileContent + fileMap[fileName]), '');

        return md5(content);
    }

    interpolateName(fileMap: { [key: string]: any }): string {
        let filePath = this.options.output;
        if (this.options.appendHash && !this.options.lazy) {
            const fileHash = this.md5File(fileMap);
            filePath = filePath.replace(/\.js$/, `.${fileHash.slice(0, 20)}.js`);
        }

        return filePath;
    }

    apply(compiler: any): void {
        const concatPromise = this.options.inputs.map(fileName =>
            new Promise((resolve) => {
                fs.readFile(fileName, (err, data) => {
                    if (err) {
                        throw err;
                    }
                    resolve({
                        [fileName]: data.toString()
                    });
                });
            })
        );

        const dependenciesChanged = (compilation: any) => {
            const fileTimestampsKeys = Object.keys(compilation.fileTimestamps);
            // Since there are no time stamps, assume this is the first run and emit files
            if (!fileTimestampsKeys.length) {
                return true;
            }
            const changed = fileTimestampsKeys.filter(watchfile =>
                (this.prevTimestamps[watchfile] || this.startTime) < (compilation.fileTimestamps[watchfile] || Infinity)
            ).some(f => this.options.inputs.includes(f));
            this.prevTimestamps = compilation.fileTimestamps;
            return changed;
        };

        compiler.plugin('compilation', (compilation: any) => {
            compilation.plugin('html-webpack-plugin-before-html-generation', (htmlPluginArgs: any, cb: any) => {
                if (this.options.lazy) {
                    cb(null, htmlPluginArgs);
                    return;
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

                const targetHtmlWebpackPluginIds = this.options.targetHtmlWebpackPluginIds || [];
                if (targetHtmlWebpackPluginIds.length &&
                (!targetHtmlWebpackPluginIds.length ||
                        targetHtmlWebpackPluginIds.indexOf(htmlPluginArgs.plugin.options.id) <= -1)) {
                    cb(null, htmlPluginArgs);
                    return;
                } else {
                    if (this.options.appendHash && !this.options.lazy) {
                        Promise.all(concatPromise).then((fileMaps: { [key: string]: any }[]) => {
                            const fileMap = fileMaps.reduce((file1, file2) => Object.assign(file1, file2));
                            this.outputFileName = this.interpolateName(fileMap);

                            htmlPluginArgs.plugin.options.customScripts =
                                htmlPluginArgs.plugin.options.customScripts || [];
                            htmlPluginArgs.plugin.options.customScripts.push(this.outputFileName);
                            cb(null, htmlPluginArgs);
                        });
                    } else {
                        this.outputFileName = this.options.output;
                        htmlPluginArgs.plugin.options.customScripts =
                            htmlPluginArgs.plugin.options.customScripts || [];
                        htmlPluginArgs.plugin.options.customScripts.push(this.outputFileName);
                        cb(null, htmlPluginArgs);
                    }

                }
            });

            compilation.plugin('html-webpack-plugin-alter-asset-tags',
                (htmlPluginArgs: any, cb: any) => {
                    if (!this.outputFileName || this.options.lazy) {
                        return cb(null, htmlPluginArgs);
                    }

                    const customScriptAttributes = this.options.customAttributes || {};
                    const targetHtmlWebpackPluginIds = this.options.targetHtmlWebpackPluginIds || [];
                    if (!targetHtmlWebpackPluginIds.length ||
                        (targetHtmlWebpackPluginIds.length &&
                            targetHtmlWebpackPluginIds.indexOf(htmlPluginArgs.plugin.options.id) >
                            -1)) {

                        let s = this.outputFileName;
                        s = this.publicPath ? this.publicPath + s : s;
                        const bodyEntries: any[] = [];
                        const headEntries: any[] = [];
                        const selectedEntries = this.options.injectPosition === 'head' ? headEntries : bodyEntries;
                        selectedEntries.push({
                            tagName: 'script',
                            closeTag: true,
                            attributes: Object.assign({
                                    type: 'text/javascript',
                                    src: s
                                },
                                customScriptAttributes)
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

        compiler.plugin('emit', (compilation: any, cb: any) => {
            compilation.fileDependencies.push(...(this.options.inputs));
            if (!dependenciesChanged(compilation)) {
                cb();
                return;
            }

            Promise.all(concatPromise).then((fileMaps: { [key: string]: any }[]) => {
                const fileMap = fileMaps.reduce((file1, file2) => Object.assign(file1, file2));
                this.outputFileName = this.interpolateName(fileMap);
                const sourceMapFileName = `${this.outputFileName}.map`;

                const uglifyOptions = this.options.minify ? this.uglifyMinifiyOptions : this.uglifyNonMinifyOptions;
                if (this.options.verbose) {
                    uglifyOptions.warnings = this.options.verbose;
                }
                if (this.options.sourceMap) {
                    uglifyOptions.sourceMap = { url: sourceMapFileName };
                }

                const result = uglify.minify(fileMap as any, uglifyOptions);
                if ((result as any).error) {
                    compilation.errors.push(new Error((result as any).error));
                    cb();
                }
                if ((result as any).warnings) {
                    compilation.warnings.push((result as any).warnings);
                }

                const content = result.code;

                if (this.options.sourceMap && result.map) {
                    const mapContent = result.map.toString();
                    compilation.assets[sourceMapFileName] = {
                        source(): string {
                            return mapContent;
                        },
                        size(): number {
                            return mapContent.length;
                        }
                    };
                }

                compilation.assets[this.outputFileName] = {
                    source(): string {
                        return content;
                    },
                    size(): number {
                        return content.length;
                    }
                };

                cb();
            });
        });
    }
}
