// Ref: angular-cli - https://github.com/angular/angular-cli/blob/master/packages/angular-cli/plugins/suppress-entry-chunks-webpack-plugin.ts
"use strict";
class SuppressEntryChunksWebpackPlugin {
    constructor(options) {
        this.options = options;
        this.isTargetHtmlWebpackPlugin = false;
        if (!options) {
            throw new ReferenceError(`'options' cannot be null or undefined.`);
        }
    }
    apply(compiler) {
        compiler.plugin('compilation', (compilation) => {
            compilation.plugin('after-seal', (callback) => {
                this.supressAssets(compilation, callback);
            });
            if (this.options.assetTagsFilterFunc) {
                compilation.plugin('html-webpack-plugin-alter-asset-tags', (htmlPluginArgs, callback) => {
                    if (!this.options.targetHtmlWebpackPluginId ||
                        (this.options.targetHtmlWebpackPluginId &&
                            this.options.targetHtmlWebpackPluginId === htmlPluginArgs.plugin.options.id)) {
                        this.isTargetHtmlWebpackPlugin = true;
                    }
                    else {
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
    supressAssets(compilation, callback) {
        if (!this.options.chunks || !this.options.supressPattern) {
            callback();
            return;
        }
        compilation.chunks.filter((chunk) => this.options.chunks.indexOf(chunk.name) !== -1)
            .forEach((chunk) => {
            const newFiles = [];
            chunk.files.forEach((file) => {
                if (file.match(this.options.supressPattern)) {
                    delete compilation.assets[file];
                }
                else {
                    newFiles.push(file);
                }
            });
            chunk.files = newFiles;
        });
        callback();
        return;
    }
}
exports.SuppressEntryChunksWebpackPlugin = SuppressEntryChunksWebpackPlugin;
//# sourceMappingURL=index.js.map