import * as path from 'path';

import { copy } from 'fs-extra';
import * as webpack from 'webpack';

import { AssetEntry, InternalError, InvalidConfigError } from '../../../models';
import { isInFolder, Logger, LoggerOptions } from '../../../utils';

import { preProcessAssets } from './pre-process-assets';
import { processAssets, ProcessedAssetsResult } from './process-assets';

export type CopyWebpackPluginOptions = {
    baseDir: string;
    assets: (string | AssetEntry)[];
    allowCopyOutsideOutputPath?: boolean;
    forceWriteToDisk?: boolean;
    persistedOutputFileSystemNames?: string[];
    loggerOptions?: LoggerOptions;
};

export class CopyWebpackPlugin {
    private readonly logger: Logger;
    private readonly persistedOutputFileSystemNames = ['NodeOutputFileSystem'];
    private readonly fileDependencies: string[] = [];
    private readonly contextDependencies: string[] = [];

    private cachedFiles: { [key: string]: any } = {};
    private newWrittenCount = 0;

    get name(): string {
        return 'CopyWebpackPlugin';
    }

    constructor(private readonly options: CopyWebpackPluginOptions) {
        if (!options) {
            throw new InternalError(`[${this.name}] The 'options' can't be null or empty.`);
        }
        if (!this.options.baseDir) {
            throw new InternalError(`The 'baseDir' property is required.`);
        }

        if (!path.isAbsolute(this.options.baseDir)) {
            throw new InternalError(
                `The 'baseDir' must be absolute path, passed value: ${this.options.baseDir}.`);
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
        const outputPath = compiler.options.output ? compiler.options.output.path : '';

        compiler.plugin('emit', (compilation: any, cb: (err?: Error) => void) => {
            const startTime = Date.now();
            this.newWrittenCount = 0;

            this.logger.debug(`Processing assets to be copied`);

            if (!this.options.assets || !this.options.assets.length) {
                this.logger.debug(`No asset entry is passed`);
                return cb();
            }

            preProcessAssets(this.options.baseDir, this.options.assets, compilation.inputFileSystem)
                .then(preProcessedEntries => processAssets(preProcessedEntries,
                    outputPath,
                    compilation.inputFileSystem))
                .then(processedAssets => this.writeFile(processedAssets, compiler, compilation, outputPath || ''))
                .then(() => {
                    if (!this.newWrittenCount) {
                        this.logger.debug(`No asset has been emitted`);
                    }
                    this.newWrittenCount = 0;
                    const duration = Date.now() - startTime;
                    this.logger.debug(`Copy completed in [${duration}ms]`);
                    return cb();
                })
                .catch(err => {
                    this.newWrittenCount = 0;
                    return cb(err);
                });
        });

        compiler.plugin('after-emit', (compilation: any, cb: (err?: Error) => void) => {
            this.fileDependencies.forEach(file => {
                if (!(compilation.fileDependencies as string[]).includes(file)) {
                    compilation.fileDependencies.push(file);
                }
            });

            this.contextDependencies.forEach(context => {
                if (!(compilation.contextDependencies as string[]).includes(context)) {
                    compilation.contextDependencies.push(context);
                }
            });

            cb();
        });
    }

    private async writeFile(processedAssets: ProcessedAssetsResult[],
        compiler: webpack.Compiler,
        compilation: any,
        outputPath: string):
        Promise<void> {
        await Promise.all(processedAssets.map(async (processedAsset) => {
            const assetEntry = processedAsset.assetEntry;

            if (assetEntry.fromIsDir && assetEntry.fromDir && !this.contextDependencies.includes(assetEntry.fromDir)) {
                this.contextDependencies.push(assetEntry.fromDir);
            }

            if (!this.options.allowCopyOutsideOutputPath &&
                outputPath &&
                path.isAbsolute(outputPath) &&
                (this.persistedOutputFileSystemNames.includes(compiler.outputFileSystem.constructor.name) ||
                    this.options.forceWriteToDisk)) {
                const absoluteTo = path.resolve(outputPath, processedAsset.relativeTo);
                if (!isInFolder(outputPath, absoluteTo)) {
                    throw new InvalidConfigError(
                        `Copying assets outside of 'outDir' is not permitted, path: ${absoluteTo}.`);
                }
            }

            if (!assetEntry.fromIsDir && !this.fileDependencies.includes(processedAsset.absoluteFrom)) {
                this.fileDependencies.push(processedAsset.absoluteFrom);
            }

            if (this.cachedFiles[processedAsset.absoluteFrom] &&
                this.cachedFiles[processedAsset.absoluteFrom][processedAsset.hash]) {
                this.logger.debug(`Already in cached - ${path.relative(processedAsset.assetEntry.context,
                    processedAsset.absoluteFrom)}`);
                return;
            } else {
                this.cachedFiles[processedAsset.absoluteFrom] = {
                    [processedAsset.hash]: true
                };
            }

            if (this.options.forceWriteToDisk &&
                !this.persistedOutputFileSystemNames.includes(compiler.outputFileSystem.constructor.name)) {
                if (!outputPath || outputPath === '/' || !path.isAbsolute(outputPath)) {
                    throw new InternalError(`The absolute path must be specified in config -> output.path.`);
                }

                const absoluteTo = path.resolve(outputPath, processedAsset.relativeTo);

                this.logger.debug(`Emitting ${processedAsset.relativeTo} to disk`);
                await copy(processedAsset.absoluteFrom, absoluteTo);

                if (!compilation.assets[processedAsset.relativeTo]) {
                    compilation.assets[processedAsset.relativeTo] = {
                        size(): number {
                            return processedAsset.content.length;
                        },
                        source(): Buffer {
                            return processedAsset.content;
                        }
                    };
                }

                ++this.newWrittenCount;
            } else if (!compilation.assets[processedAsset.relativeTo]) {
                this.logger.debug(
                    `Emitting ${processedAsset.relativeTo}${compiler.outputFileSystem.constructor.name ===
                        'MemoryFileSystem' &&
                        !this.options.forceWriteToDisk
                        ? ' to memory'
                        : ''}`);

                compilation.assets[processedAsset.relativeTo] = {
                    size(): number {
                        return processedAsset.content.length;
                    },
                    source(): Buffer {
                        return processedAsset.content;
                    }
                };

                ++this.newWrittenCount;
            }
        }));
    }
}
