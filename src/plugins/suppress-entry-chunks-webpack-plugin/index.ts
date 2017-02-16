// Ref: angular-cli - https://github.com/angular/angular-cli/blob/master/packages/angular-cli/plugins/suppress-entry-chunks-webpack-plugin.ts

// ExtractTextPlugin leaves behind the entry points, which we might not need anymore
// if they were entirely css. This plugin removes those entry points.

// ReSharper disable once InconsistentNaming
export interface SuppressEntryChunksPluginOptions {
    chunks?: string[];
    supressPattern?: RegExp;
    targetHtmlWebpackPluginId?: string;
    assetTagsFilterFunc?: (tag: any) => boolean;
}

export class SuppressEntryChunksWebpackPlugin {
    private isTargetHtmlWebpackPlugin = false;

    constructor(private readonly options: SuppressEntryChunksPluginOptions) {
        if (!options) {
            throw new ReferenceError(`'options' cannot be null or undefined.`);
        }
    }

    apply(compiler: any): void {

        compiler.plugin('compilation', (compilation: any) => {

            compilation.plugin('after-seal', (callback: any) => {
                this.supressAssets(compilation, callback);
            });

            if (this.options.assetTagsFilterFunc) {
                compilation.plugin('html-webpack-plugin-alter-asset-tags',
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


                        const filterFn = this.options.assetTagsFilterFunc;
                        htmlPluginArgs.head = htmlPluginArgs.head.filter(filterFn);
                        htmlPluginArgs.body = htmlPluginArgs.body.filter(filterFn);
                        return callback(null, htmlPluginArgs);
                    });
            }
        });
    }

    supressAssets(compilation: any, callback: any) {
        if (!this.options.chunks || !this.options.supressPattern) {
            callback();
            return;
        }
        compilation.chunks.filter((chunk: any) => this.options.chunks.indexOf(chunk.name) !== -1)
            .forEach((chunk: any) => {
                const newFiles: string[] = [];
                chunk.files.forEach((file: string) => {
                    if (file.match(this.options.supressPattern)) {
                        delete compilation.assets[file];
                    } else {
                        newFiles.push(file);
                    }
                });
                chunk.files = newFiles;
            });
        callback();
        return;
    }
}