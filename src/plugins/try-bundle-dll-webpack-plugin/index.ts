import * as fs from 'fs';
import * as webpack from 'webpack';

// ReSharper disable once InconsistentNaming
const DllReferencePlugin = require('webpack/lib/DllReferencePlugin');

export interface TryBundleDllPluginOptions {
    manifests: { file: string; chunkName: string; }[];
    context?: string;
    debug?: boolean;
    sourceLibraryType?: string;
    getDllConfigFunc: (silent?: boolean) => webpack.Configuration;
}

export class TryBundleDllWebpackPlugin {
    private compiler: any;

    constructor(private readonly options: TryBundleDllPluginOptions) {
    }

    apply(compiler: any): void {
        this.compiler = compiler;

        const target = compiler.options.target;
        const context = this.options.context || compiler.options.context;
        const webpackDllConfig = this.options.getDllConfigFunc(true);
        const sourceLibraryType = webpackDllConfig.output && webpackDllConfig.output.libraryTarget
            ? webpackDllConfig.output.libraryTarget
            : this.options.sourceLibraryType;
        const plugins: any[] = [];
        if (!target || target === 'node' || target === 'async-node' || target === 'node-webkit') {
            this.options.manifests.forEach(manifest => {
                plugins.push(
                    new DllReferencePlugin({
                        context: context,
                        manifest: manifest.file,
                        name: `./${manifest.chunkName}`,
                        sourceType: sourceLibraryType || 'commonjs2'
                    })
                );
            });
        } else {
            this.options.manifests.forEach(manifest => {
                plugins.push(
                    new DllReferencePlugin({
                        context: context,
                        manifest: manifest.file,
                        sourceType: sourceLibraryType
                    })
                );
            });
        }

        plugins.forEach(p => p.apply(compiler));
        compiler.options.plugins.push(...plugins);

        compiler.plugin('run', (c: any, next: any) => this.tryBundleDll(next));
        compiler.plugin('watch-run', (c: any, next: any) => this.tryBundleDll(next, true));
    }


    tryBundleDll(next: (err?: Error) => any, watch?: boolean): void {
        this.checkManifestFile()
            .then((exists: boolean) => {
                if (exists) {
                    return Promise.resolve(null);
                } else {
                    const webpackDllConfig = this.options.getDllConfigFunc();
                    const webpackCompiler: any = webpack(webpackDllConfig);
                    const statsConfig = this.compiler.options.stats || {};

                    return new Promise((resolve, reject) => {
                        const callback = (err: any, stats: any) => {
                            if (err) {
                                return reject(err);
                            }

                            console.log(stats.toString(statsConfig));

                             if (watch) {
                               return;
                             }

                            if (stats.hasErrors()) {
                                console.log(stats.toString('errors-only'));
                                reject();
                            } else {
                                resolve();
                            }
                        };

                        webpackCompiler.run(callback);
                    });
                }
            })
            .then(() => next())
            .catch((err: Error) => next(err));
    }

    private checkManifestFile(): Promise<any> {
        const tasks = this.options.manifests.map(manifest => {
            return new Promise((resolve) => {
                return fs.stat(manifest.file,
                    (err, stats) => {
                        if (err) {
                            return resolve(false);
                        }
                        return resolve(stats.isFile());
                    });
            });
        });

        return Promise.all(tasks)
            .then(results => {
                return results.reduce((prev: boolean, current: boolean) => {
                    return prev && current;
                });
            });
    }
}
