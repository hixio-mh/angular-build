import * as path from 'path';

import * as webpack from 'webpack';

import { ensureDir, writeFile } from 'fs-extra';

import { InternalError } from '../../../models';
import { Logger, LoggerOptions } from '../../../utils';

export interface WriteStatsJsonWebpackPluginOptions {
    /**
     * Absolute path for assets json file.
     */
    path: string;
    forceWriteToDisk?: boolean;
    persistedOutputFileSystemNames?: string[];
    loggerOptions?: LoggerOptions;
}

export class WriteStatsJsonWebpackPlugin {
    private readonly logger: Logger;
    private readonly persistedOutputFileSystemNames = ['NodeOutputFileSystem'];

    get name(): string {
        return 'WriteStatsJsonWebpackPlugin';
    }

    constructor(private readonly options: WriteStatsJsonWebpackPluginOptions) {
        if (!options) {
            throw new InternalError(`[${this.name}] The 'options' can't be null or empty.`);
        }

        const loggerOptions =
            Object.assign({ name: `[${this.name}]` }, this.options.loggerOptions || {}) as LoggerOptions;
        this.logger = new Logger(loggerOptions);

        if (this.options.persistedOutputFileSystemNames && this.options.persistedOutputFileSystemNames.length) {
            this.options.persistedOutputFileSystemNames
                .filter(pfs => !this.persistedOutputFileSystemNames.includes(pfs))
                .forEach(pfs => this.persistedOutputFileSystemNames.push(pfs));
        }
    }

    apply(compiler: webpack.Compiler): void {
        const outputPath = compiler.options.output ? compiler.options.output.path : undefined;

        compiler.plugin('after-emit',
            (compilation: any, cb: (err?: Error, request?: any) => void) => {
                if (!outputPath || outputPath === '/' || !path.isAbsolute(outputPath)) {
                    return cb(new InternalError(
                        `[${this.name}] Absolute output path must be specified in webpack config -> output -> path.`));
                }

                const statsFilepath = this.options.path;
                const statsOptions = {
                    hash: true,
                    publicPath: true,
                    assets: true,
                    chunks: false,
                    modules: false,
                    source: false,
                    errorDetails: false,
                    timings: false
                };

                const stats = compilation.getStats().toJson(statsOptions);
                const assetsByChunkName = stats.assetsByChunkName;
                var assetsToWrite = Object.keys(assetsByChunkName).reduce((chunkMap: any, chunkName: string) => {
                    let assets = assetsByChunkName[chunkName];
                    if (!Array.isArray(assets)) {
                        assets = [assets];
                    }

                    chunkMap[chunkName] = assets;
                    return chunkMap;
                }, {});

                const statsFileRelative = path.relative(outputPath, statsFilepath);
                const content = new Buffer(JSON.stringify(assetsToWrite, null, 2), 'utf8');
                if (this.options.forceWriteToDisk &&
                    !this.persistedOutputFileSystemNames.includes(compiler.outputFileSystem.constructor.name)) {
                    this.logger.debug(`Emitting ${statsFileRelative} to disk`);
                    ensureDir(path.dirname(statsFilepath))
                        .then(() => writeFile(
                            statsFilepath,
                            content
                        )).then(() => cb())
                        .catch(err => cb(err));

                } else {
                    this.logger.debug(`Emitting ${statsFileRelative}`);
                    compiler.outputFileSystem.mkdirp(path.dirname(statsFilepath),
                        (err: Error) => {
                            if (err) {
                                return cb(err);
                            }
                            compiler.outputFileSystem.writeFile(statsFilepath, content, cb);
                        });
                }


            });
    }
}
