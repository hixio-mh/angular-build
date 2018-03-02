import * as webpack from 'webpack';

import { Logger, LoggerOptions } from '../../../utils/logger';

export interface DynamicDllWebpackPluginOptions {
    manifests: { file: string; chunkName: string; }[];
    getDllConfigFunc: () => webpack.Configuration;
    loggerOptions?: LoggerOptions;
}

export class DynamicDllWebpackPlugin {
    private readonly _logger: Logger;

    get name(): string {
        return 'dynamic-dll-webpack-plugin';
    }

    constructor(private readonly _options: DynamicDllWebpackPluginOptions) {
        const loggerOptions =
            Object.assign({ name: `[${this.name}]` }, this._options.loggerOptions || {}) as LoggerOptions;
        this._logger = new Logger(loggerOptions);
    }

    apply(compiler: any): void {
        const runFn = () => {
            return this.checkAndBundleDll(compiler);
        };

        compiler.hooks.run.tapPromise(this.name, runFn);
        compiler.hooks.watchRun.tapPromise(this.name, runFn);
    }

    private async checkAndBundleDll(compiler: any): Promise<void> {
        const manifestFilesExists = await this.checkManifestFiles(compiler.inputFileSystem);
        if (manifestFilesExists) {
            this._logger.debug('Found manifest file');
            return;
        } else {
            this._logger.debug('Initializing dll config');
            const webpackDllConfig = this._options.getDllConfigFunc();
            if (webpackDllConfig.watch) {
                delete webpackDllConfig.watch;
            }

            const statsConfig = webpackDllConfig.stats || {};

            this._logger.debug('Creating webpack compiler for dll bundling');
            const webpackCompiler = webpack(webpackDllConfig);

            await new Promise((resolve, reject) => {
                webpackCompiler.run((err: Error, stats: webpack.Stats) => {
                    if (err) {
                        return reject(err);
                    }

                    if (stats.hasErrors()) {
                        return reject(new Error(stats.toString('errors-only')));
                    }

                    // tslint:disable-next-line:no-console
                    console.log(stats.toString(statsConfig));
                    resolve();
                });
            });
        }
    }

    private checkManifestFiles(inputFileSystem: any): Promise<boolean> {
        this._logger.debug('Checking dll manifest file');
        const tasks = this._options.manifests.map(manifest => {
            return new Promise<boolean>((resolve) => {
                return inputFileSystem.stat(manifest.file,
                    (err: Error, stats: any) => {
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
