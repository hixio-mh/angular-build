import * as path from 'path';

import * as uglify from 'uglify-js';
import * as webpack from 'webpack';

import { GlobalParsedEntry, InternalError } from '../../../models';
import { Logger, LoggerOptions } from '../../../utils/logger';
import { generateHashDigest } from '../../../utils/generate-hash-digest';

type ConcatEntry = {
    fileMap: { [key: string]: string; };
    assetEntry: string;
    lazy: boolean;
};

export interface ScriptsConcatWebpackPluginOptions {
    scripts: GlobalParsedEntry[];
    htmlPluginOptionsKey: string;

    appendHash?: boolean;
    minify?: boolean | object;
    sourceMap?: boolean;

    loggerOptions?: LoggerOptions;
}

export class ScriptsConcatWebpackPlugin {
    private readonly logger: Logger;
    private readonly uglifyNonMinifyOptions: any = {
        compress: false,
        mangle: false,
        output: {
            comments: true
        }
    };
    private readonly uglifyMinifiyOptions: any = {
        // ie8: true, // default false
        compress: {
            passes: 3, // default 1
            negate_iife: false // default true, we need this for lazy v8
        },
        output: {
            comments: /^\**!|@preserve|@license/,
            beautify: false // default true
        }
    };

    private concatEntries: ConcatEntry[] | null = null;

    get name(): string {
        return 'ScriptsConcatWebpackPlugin';
    }

    constructor(readonly options: ScriptsConcatWebpackPluginOptions) {
        if (!options) {
            throw new InternalError(`[${this.name}] The 'options' can't be null or empty.`);
        }

        const loggerOptions =
            Object.assign({ name: `[${this.name}]` }, this.options.loggerOptions || {}) as LoggerOptions;
        this.logger = new Logger(loggerOptions);
    }

    apply(compiler: webpack.Compiler): void {
        const outputPath = compiler.options.output ? compiler.options.output.path : undefined;

        compiler.plugin('before-compile',
            (params: any, cb: (err?: Error) => void) => {
                if (this.concatEntries || !this.options.scripts || !this.options.scripts.length) {
                    return cb();
                }

                this.getConcatOptions(this.options.scripts, (compiler as any).inputFileSystem, outputPath || '')
                    .then(concatEntries => {
                        this.concatEntries = concatEntries;
                        return cb();
                    })
                    .catch(err => cb(err));

            });

        compiler.plugin('compilation', compilation => {
            compilation.plugin('html-webpack-plugin-before-html-generation',
                (htmlPluginArgs: any, cb: any) => {
                    if (!this.concatEntries || !this.concatEntries.length || !this.options.htmlPluginOptionsKey) {
                        return cb(null, htmlPluginArgs);
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

                    const scriptAssets = this.concatEntries.filter(concatEntry => !concatEntry.lazy).map(
                        concatEntry => {
                            return publicPath + concatEntry.assetEntry;
                        });

                    if (scriptAssets.length > 0) {
                        this.logger.debug(
                            `Adding script assets to htmlPluginArgs.plugin.options.${this.options.htmlPluginOptionsKey
                            }`);
                        htmlPluginArgs.plugin.options[this.options.htmlPluginOptionsKey] = scriptAssets;
                    }

                    return cb(null, htmlPluginArgs);
                });
        });

        compiler.plugin('emit', (compilation: any, cb: (err?: Error) => void) => {
            if (!this.concatEntries || !this.concatEntries.length) {
                return cb();
            }

            this.logger.debug(`Emitting assets`);
            return this.addAssets(this.concatEntries, compilation)
                .then(() => cb())
                .catch(err => {
                    compilation.errors.push(`[${this.name}] ${err.message || err}`);
                    return cb();
                });
        });

        compiler.plugin('after-emit', (compilation: any, cb: (err?: Error) => void) => {
            if (this.concatEntries) {
                this.logger.debug(`Cleaning cache`);
                this.concatEntries = null;
            }
            cb();
        });
    }

    private async addAssets(concatEntries: {
        assetEntry: string;
        fileMap: any;
    }[], compilation: any): Promise<void> {
        for (let concatEntry of concatEntries) {
            const uglifyOptions = this.options.minify
                ? Object.assign({},
                    this.uglifyMinifiyOptions,
                    typeof this.options.minify === 'object'
                        ? this.options.minify
                        : {
                            sourceMap: this.options.sourceMap
                                ? {
                                    root: '',
                                    filename: concatEntry.assetEntry,
                                    url: `${concatEntry.assetEntry}.map`
                                }
                                : false
                        })
                : Object.assign({
                    sourceMap: this.options.sourceMap
                        ? {
                            root: '',
                            filename: concatEntry.assetEntry,
                            url: `${concatEntry.assetEntry}.map`
                        }
                        : false
                },
                    this.uglifyNonMinifyOptions);

            const result = uglify.minify(concatEntry.fileMap as any, uglifyOptions);
            if ((result as any).error) {
                compilation.errors.push(new Error((result as any).error));
                return;
            }

            if ((result as any).warnings) {
                compilation.warnings.push((result as any).warnings);
            }

            const content = result.code;

            if (this.options.sourceMap && result.map) {
                const sourceMapFile = `${concatEntry.assetEntry}.map`;
                const mapContent = result.map.toString();
                compilation.assets[sourceMapFile] = {
                    source(): string {
                        return mapContent;
                    },
                    size(): number {
                        return mapContent.length;
                    }
                };
            }

            compilation.assets[concatEntry.assetEntry] = {
                source(): string {
                    return content;
                },
                size(): number {
                    return content.length;
                }
            };
        }
    }

    private async getConcatOptions(globalScripts: GlobalParsedEntry[], inputFileSystem: any, outputPath: string):
        Promise<ConcatEntry[]> {
        return await Promise.all(globalScripts.map(async (scriptEntry: GlobalParsedEntry) => {
            const fileMaps = await Promise.all(scriptEntry.paths.map((fileName: string) =>
                new Promise((resolve, reject) => {
                    inputFileSystem.readFile(fileName,
                        (err: Error, data: Buffer) => {
                            if (err) {
                                return reject(err);
                            }

                            const fileNameRel = path.relative(outputPath, fileName).replace(/\\/g, '/');
                            return resolve({
                                [fileNameRel]: data.toString('utf8')
                            });
                        });
                })
            ));

            const fileMap =
                fileMaps.reduce((file1, file2) => Object.assign(file1, file2)) as { [key: string]: string; };
            let assetEntry = scriptEntry.entry + '.js';
            if (this.options.appendHash && !scriptEntry.lazy) {
                const content = Object.keys(fileMap)
                    .reduce((fileContent, fileName) => (fileContent + fileMap[fileName]), '');
                const hash = generateHashDigest(content, 20);
                assetEntry = assetEntry.replace(/\.js$/i, `.${hash}.js`);
            }

            return {
                fileMap: fileMap,
                lazy: typeof scriptEntry.lazy === 'boolean' ? scriptEntry.lazy : false,
                assetEntry: assetEntry
            };

        }));
    }
}
