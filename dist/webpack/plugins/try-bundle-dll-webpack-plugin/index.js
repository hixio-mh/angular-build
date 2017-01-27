"use strict";
const fs = require("fs");
// ReSharper disable once CommonJsExternalModule
const webpack = require('webpack');
const webpackOutputOptions = {
    colors: true,
    hash: true,
    timings: true,
    chunks: true,
    chunkModules: false,
    children: false,
    modules: false,
    reasons: false,
    warnings: true,
    assets: false,
    version: false
};
const verboseWebpackOutputOptions = {
    children: true,
    assets: true,
    version: true,
    reasons: true,
    chunkModules: false // TODO: set to true when console to file output is fixed
};
function getWebpackStatsConfig(verbose = false) {
    return verbose
        ? Object.assign(webpackOutputOptions, verboseWebpackOutputOptions)
        : webpackOutputOptions;
}
class TryBundleDllWebpackPlugin {
    constructor(options) {
        this.options = options;
    }
    apply(compiler) {
        compiler.plugin('run', (c, next) => this.tryDll(next));
        compiler.plugin('watch-run', (c, next) => this.tryDll(next));
    }
    tryDll(next) {
        this.checkManifestFile()
            .then((exists) => {
            if (exists) {
                return Promise.resolve(null);
            }
            else {
                const webpackDllConfig = this.options.webpackDllConfig;
                const webpackCompiler = webpack(webpackDllConfig);
                const statsConfig = getWebpackStatsConfig(this.options.debug);
                return new Promise((resolve, reject) => {
                    const callback = (err, stats) => {
                        if (err) {
                            return reject(err);
                        }
                        console.info(stats.toString(statsConfig));
                        // TODO:
                        //if (watch) {
                        //  return;
                        //}
                        if (stats.hasErrors()) {
                            reject();
                        }
                        else {
                            resolve();
                        }
                    };
                    webpackCompiler.run(callback);
                    // TODO:
                    //if (watch) {
                    //  webpackCompiler.watch({}, callback);
                    //} else {
                    //  webpackCompiler.run(callback);
                    //}
                });
            }
        })
            .then(() => next())
            .catch((err) => next(err));
    }
    checkManifestFile() {
        return new Promise((resolve, reject) => {
            return fs.stat(this.options.manifestFile, (err, stats) => {
                if (err) {
                    return reject(err);
                }
                return resolve(stats.isFile());
            });
        });
    }
}
exports.TryBundleDllWebpackPlugin = TryBundleDllWebpackPlugin;
//# sourceMappingURL=index.js.map