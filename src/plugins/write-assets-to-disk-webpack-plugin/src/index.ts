import * as path from 'path';

import * as minimatch from 'minimatch';
import * as webpack from 'webpack';

import { ensureDir, writeFile } from 'fs-extra';

import { InternalError } from '../../../models';
import { Logger, LoggerOptions } from '../../../utils/logger';

export interface WriteAssetsToDiskWebpackPluginOptions {
    emittedPaths?: string[];
    exclude?: string[];
    persistedOutputFileSystemNames?: string[];
    loggerOptions?: LoggerOptions;
}

export class WriteAssetsToDiskWebpackPlugin {
    private readonly logger: Logger;
    private readonly persistedOutputFileSystemNames = ['NodeOutputFileSystem'];

    get name(): string {
        return 'WriteAssetsToDiskWebpackPlugin';
    }

    constructor(private readonly options: WriteAssetsToDiskWebpackPluginOptions) {
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
                if (this.persistedOutputFileSystemNames.includes(compiler.outputFileSystem.constructor.name)) {
                    return cb();
                }

                if (!outputPath || outputPath === '/' || !path.isAbsolute(outputPath)) {
                    return cb(new InternalError(
                        `[${this.name}] Absolute output path must be specified in webpack config -> output -> path.`));
                }

                this.writeAssets(outputPath, compilation)
                    .then(() => {
                        if (!this.options.emittedPaths || !this.options.emittedPaths.length) {
                            return cb();
                        }

                        const emittedPaths = this.options.emittedPaths;
                        this.writeMemoryEmittedFiles(outputPath, emittedPaths, compiler).then(() => cb());
                    })
                    .catch(e => {
                        compilation.errors.push(`[${this.name}] ${e.message || e}.`);
                        cb();
                    });


            });
    }

    private async writeAssets(outputPath: string, compilation: any): Promise<void> {
        await Promise.all(Object.keys(compilation.assets).map(async (assetName: any) => {
            // check the ignore list
            let shouldIgnore = false;
            const ignores = this.options.exclude || [];
            let il = ignores.length;
            while (il--) {
                const ignoreGlob = ignores[il];
                if (minimatch(assetName, ignoreGlob, { dot: true, matchBase: true })) {
                    shouldIgnore = true;
                    break;
                }
            }

            if (shouldIgnore) {
                return;
            }

            const asset = compilation.assets[assetName];
            const assetSource = Array.isArray(asset.source()) ? asset.source().join('\n') : asset.source();

            this.logger.debug(`Writing ${assetName} to disk`);

            const assetFilePath = path.resolve(outputPath, assetName);
            await ensureDir(path.dirname(assetFilePath));
            await writeFile(assetFilePath, assetSource);
        }));

    }

    private async writeMemoryEmittedFiles(outputPath: string, emittedPaths: string[], compiler: webpack.Compiler): Promise<void> {
        await Promise.all(emittedPaths.map(async (targetPath: string) => {
            const content = await new Promise((resolve, reject) => {
                // TODO: to review
                (compiler as any).inputFileSystem.readFile(targetPath,
                    (err: Error, data: Buffer) => {
                        err ? reject(err) : resolve(data);
                    });
            });


            this.logger.debug(`Writing ${path.relative(outputPath, targetPath)} to disk`);
            await writeFile(targetPath, content);

        }));
    }
}
