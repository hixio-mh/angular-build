import * as path from 'path';

import { ensureDir, writeFile } from 'fs-extra';
import * as minimatch from 'minimatch';

import { InternalError } from '../../../models';
import { Logger, LoggerOptions } from '../../../utils/logger';

export interface WriteAssetsToDiskWebpackPluginOptions {
    outputPath?: string;
    emittedPaths?: string[];
    exclude?: string[];
    persistedOutputFileSystemNames?: string[];
    loggerOptions?: LoggerOptions;
}

export class WriteAssetsToDiskWebpackPlugin {
    private readonly _options: WriteAssetsToDiskWebpackPluginOptions;
    private readonly _logger: Logger;
    private readonly _persistedOutputFileSystemNames = ['NodeOutputFileSystem'];

    get name(): string {
        return 'write-assets-to-disk-webpack-plugin';
    }

    constructor(options: Partial<WriteAssetsToDiskWebpackPluginOptions>) {
        this._options = {
            ...options
        };

        const loggerOptions =
            Object.assign({ name: `[${this.name}]` }, this._options.loggerOptions || {}) as LoggerOptions;
        this._logger = new Logger(loggerOptions);

        if (this._options.persistedOutputFileSystemNames && this._options.persistedOutputFileSystemNames.length) {
            this._options.persistedOutputFileSystemNames
                .filter(pfs => !this._persistedOutputFileSystemNames.includes(pfs))
                .forEach(pfs => this._persistedOutputFileSystemNames.push(pfs));
        }
    }

    apply(compiler: any): void {
        const outputPath = this._options.outputPath || compiler.outputPath;

        compiler.hooks.afterEmit.tapPromise(this.name, async (compilation: any) => {
            if (this._persistedOutputFileSystemNames.includes(compiler.outputFileSystem.constructor.name)) {
                return;
            }

            if (!outputPath || outputPath === '/' || !path.isAbsolute(outputPath)) {
                compilation.errors.push(new InternalError(
                    `[${this.name}] Absolute output path must be specified in webpack config -> output -> path.`));
                return;
            }

            await this.writeAssets(outputPath, compilation);
            if (!this._options.emittedPaths || !this._options.emittedPaths.length) {
                return;
            }

            const emittedPaths = this._options.emittedPaths;
            await this.writeMemoryEmittedFiles(outputPath, emittedPaths, compiler);

        });
    }

    private async writeAssets(outputPath: string, compilation: any): Promise<void> {
        await Promise.all(Object.keys(compilation.assets).map(async (assetName: any) => {
            // check the ignore list
            let shouldIgnore = false;
            const ignores = this._options.exclude || [];
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

            this._logger.debug(`Writing ${assetName} to disk`);

            const assetFilePath = path.resolve(outputPath, assetName);
            await ensureDir(path.dirname(assetFilePath));
            await writeFile(assetFilePath, assetSource);
        }));

    }

    private async writeMemoryEmittedFiles(outputPath: string, emittedPaths: string[], compiler: any):
        Promise<void> {
        await Promise.all(emittedPaths.map(async (targetPath: string) => {
            const content = await new Promise((resolve, reject) => {
                // TODO: to review
                compiler.inputFileSystem.readFile(targetPath,
                    (err: Error, data: Buffer) => {
                        err ? reject(err) : resolve(data);
                    });
            });


            this._logger.debug(`Writing ${path.relative(outputPath, targetPath)} to disk`);
            await writeFile(targetPath, content);
        }));
    }
}
