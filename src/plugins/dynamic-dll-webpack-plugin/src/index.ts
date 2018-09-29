// tslint:disable:no-any
// tslint:disable:no-unsafe-any

import * as webpack from 'webpack';

import { Logger, LogLevelString } from '../../../utils';

export interface DynamicDllWebpackPluginOptions {
    manifests: { file: string; chunkName: string }[];
    logLevel?: LogLevelString;
    getDllConfigFunc(): webpack.Configuration;
}

export class DynamicDllWebpackPlugin {
    private readonly _logger: Logger;

    get name(): string {
        return 'dynamic-dll-webpack-plugin';
    }

    constructor(private readonly _options: DynamicDllWebpackPluginOptions) {
        this._logger = new Logger({
            name: `[${this.name}]`,
            logLevel: this._options.logLevel || 'info'
        });
    }

    apply(compiler: webpack.Compiler): void {
        const runFn = async () => {
            return this.checkAndBundleDll(compiler);
        };

        compiler.hooks.run.tapPromise(this.name, runFn);
        compiler.hooks.watchRun.tapPromise(this.name, runFn);
    }

    private async checkAndBundleDll(compiler: webpack.Compiler): Promise<void> {
        const manifestFilesExists = await this.checkManifestFiles((compiler as any).inputFileSystem);
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
                        reject(err);

                        return;
                    }

                    if (stats.hasErrors()) {
                        reject(new Error(stats.toString('errors-only')));

                        return;
                    }

                    // tslint:disable-next-line:no-console
                    console.log(stats.toString(statsConfig));
                    resolve();
                });
            });
        }
    }

    private async checkManifestFiles(inputFileSystem: any): Promise<boolean> {
        this._logger.debug('Checking dll manifest file');
        const tasks = this._options.manifests.map(async (manifest) => {
            return new Promise<boolean>((resolve) => {
                return inputFileSystem.stat(manifest.file,
                    (err: Error, stats: any) => {
                        if (err) {
                            resolve(false);

                            return;
                        }

                        resolve(stats.isFile());

                        return;
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
