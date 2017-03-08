import * as fs from 'fs';
import * as webpack from 'webpack';

// ReSharper disable once InconsistentNaming
const DllReferencePlugin = require('webpack/lib/DllReferencePlugin');

export interface TryBundleDllPluginOptions {
    manifests: { file: string; chunkName: string; }[];
    context?: string;
    debug?: boolean;
    getDllConfigFunc: Function;
}

export class TryBundleDllWebpackPlugin {
    private compiler: any;

    constructor(private readonly options: TryBundleDllPluginOptions) {
    }

    apply(compiler: any) {
        this.compiler = compiler;

        const target = compiler.options.target;
        const context = this.options.context || compiler.options.context;
        const plugins: any[] = [];
        if (!target || target === 'web' || target === 'webworker') {
            this.options.manifests.forEach(manifest => {
                plugins.push(
                    new DllReferencePlugin({
                        context: context,
                        manifest: manifest.file
                    })
                );
            });
        } else {
            this.options.manifests.forEach(manifest => {
                plugins.push(
                    new DllReferencePlugin({
                        context: context,
                        sourceType: 'commonjs2',
                        manifest: manifest.file,
                        name: `./${manifest.chunkName}`
                    })
                );
            });
        }

        plugins.forEach(p => p.apply(compiler));
        compiler.options.plugins.push(...plugins);

        compiler.plugin('run', (c: any, next: any) => this.tryBundleDll(next));
        compiler.plugin('watch-run', (c: any, next: any) => this.tryBundleDll(next));
    }


    tryBundleDll(next: (err?: Error) => any): void {
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

                            //process.stdout.write(stats.toString(statsConfig) + '\n');
                            console.log(stats.toString(statsConfig));

                            // TODO:
                            //if (watch) {
                            //  return;
                            //}

                            if (stats.hasErrors()) {
                                reject();
                            } else {
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
            .catch((err: Error) => next(err));
    }

    private checkManifestFile() {
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
