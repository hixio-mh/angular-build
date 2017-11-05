// Ref: angular-cli - https://github.com/angular/angular-cli

import * as webpack from 'webpack';

import {InternalError} from '../../../models';

export interface SuppressEntryChunksWebpackPluginOptions {
    chunks?: string[];
    exclude?: string[];
    supressPattern?: RegExp;
    targetHtmlWebpackPluginId?: string;
    assetTagsFilterFunc?: (tag: any) => boolean;
}

export class SuppressEntryChunksWebpackPlugin {
    private isTargetHtmlWebpackPlugin = false;

    get name(): string {
        return 'SuppressEntryChunksWebpackPlugin';
    }

    constructor(private readonly options: SuppressEntryChunksWebpackPluginOptions) {
        if (!options) {
            throw new InternalError(`[${this.name}] The 'options' can't be null or empty.`);
        }
    }

    apply(compiler: webpack.Compiler): void {
        compiler.plugin('compilation', (compilation: any) => {
            compilation.plugin('after-seal', (cb: any) => {
                this.supressAssets(compilation, cb);
            });

            if (this.options.assetTagsFilterFunc) {
                compilation.plugin('html-webpack-plugin-alter-asset-tags',
                    (htmlPluginArgs: any, cb: any) => {
                        if (!this.options.targetHtmlWebpackPluginId ||
                            (this.options.targetHtmlWebpackPluginId &&
                                this.options.targetHtmlWebpackPluginId === htmlPluginArgs.plugin.options.id)) {
                            this.isTargetHtmlWebpackPlugin = true;
                        } else {
                            this.isTargetHtmlWebpackPlugin = false;
                        }
                        if (!this.isTargetHtmlWebpackPlugin) {
                            return cb(null, htmlPluginArgs);
                        }


                        const filterFn = this.options.assetTagsFilterFunc;
                        htmlPluginArgs.head = htmlPluginArgs.head.filter(filterFn);
                        htmlPluginArgs.body = htmlPluginArgs.body.filter(filterFn);
                        return cb(null, htmlPluginArgs);
                    });
            }
        });
    }

    supressAssets(compilation: any, cb: any): void {
        if (!this.options.chunks || !this.options.supressPattern) {
            return cb();
        }

        const options: SuppressEntryChunksWebpackPluginOptions = this.options || {};

        compilation.chunks.filter((chunk: any) => options.chunks &&
            options.chunks.indexOf(chunk.name) !== -1 &&
            (!options.exclude || !options.exclude.includes(chunk.name)))
            .forEach((chunk: any) => {
                const newFiles: string[] = [];
                chunk.files.forEach((file: string) => {
                    if (options.supressPattern && file.match(options.supressPattern)) {
                        delete compilation.assets[file];
                    } else {
                        newFiles.push(file);
                    }
                });
                chunk.files = newFiles;
            });

        return cb();
    }
}
