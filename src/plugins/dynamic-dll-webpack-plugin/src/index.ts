import * as webpack from 'webpack';

import { Logger, LoggerOptions } from '../../../utils/logger';

export interface DynamicDllWebpackPluginOptions {
    manifests: { file: string; chunkName: string; }[];
    getDllConfigFunc: () => webpack.Configuration;
    loggerOptions?: LoggerOptions;
}

export class DynamicDllWebpackPlugin {
    private readonly logger: Logger;

    get name(): string {
        return 'DynamicDllWebpackPlugin';
    }

    constructor(private readonly options: DynamicDllWebpackPluginOptions) {
        const loggerOptions =
            Object.assign({ name: `[${this.name}]` }, this.options.loggerOptions || {}) as LoggerOptions;
        this.logger = new Logger(loggerOptions);
    }


    apply(compiler: webpack.Compiler): void {
        compiler.plugin(['run', 'watch-run'], (c: any, cb: (err?: Error) => void) => {
            this.checkAndBundleDll(compiler)
                .then(() => cb())
                .catch((err) => cb(err));
        });
    }

    private async checkAndBundleDll(compiler: webpack.Compiler): Promise<void> {
        const manifestFilesExists = await this.checkManifestFiles((compiler as any).inputFileSystem);
        if (manifestFilesExists) {
            this.logger.debug(`Found manifest file`);
            return;
        } else {
            this.logger.debug(`Initializing dll config`);
            const webpackDllConfig = this.options.getDllConfigFunc();
            if (webpackDllConfig.watch) {
                delete webpackDllConfig.watch;
            }

            const statsConfig = webpackDllConfig.stats || {};

            this.logger.debug(`Creating webpack compiler for dll bundling`);
            const webpackCompiler = webpack(webpackDllConfig);

            await new Promise((resolve, reject) => {
                webpackCompiler.run((err: Error, stats: webpack.Stats) => {
                    if (err) {
                        return reject(err);
                    }

                    if (stats.hasErrors()) {
                        return reject(new Error(stats.toString('errors-only')));
                    }

                    console.log(stats.toString(statsConfig));
                    resolve();
                });
            });
        }
    }

    private checkManifestFiles(inputFileSystem: any): Promise<boolean> {
        this.logger.debug(`Checking dll manifest file`);
        const tasks = this.options.manifests.map(manifest => {
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
