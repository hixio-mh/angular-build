import * as path from 'path';

import { copy } from 'fs-extra';
import * as webpack from 'webpack';

import { InternalError, InvalidConfigError } from '../../../error-models';
import { AssetEntry } from '../../../interfaces';
import { isInFolder, Logger, LoggerOptions } from '../../../utils';

import { preProcessAssets } from './pre-process-assets';
import { processAssets, ProcessedAssetsResult } from './process-assets';

export interface CopyWebpackPluginOptions {
  baseDir: string;
  outputPath?: string;
  assets: (string | AssetEntry)[];
  allowCopyOutsideOutputPath?: boolean;
  forceWriteToDisk?: boolean;
  persistedOutputFileSystemNames?: string[];
  loggerOptions?: LoggerOptions;
}

export class CopyWebpackPlugin {
  private readonly _options: CopyWebpackPluginOptions;
  private readonly _logger: Logger;
  private readonly _persistedOutputFileSystemNames = ['NodeOutputFileSystem'];
  private readonly _fileDependencies: string[] = [];
  private readonly _contextDependencies: string[] = [];
  private _cachedFiles: { [key: string]: any } = {};
  private _newWrittenCount = 0;

  get name(): string {
    return 'copy-webpack-plugin';
  }

  constructor(options: CopyWebpackPluginOptions) {
    if (!options) {
      throw new InternalError(`[${this.name}] The 'options' can't be null or empty.`);
    }

    this._options = {
      ...options,
    };

    if (!this._options.baseDir) {
      throw new InternalError("The 'baseDir' property is required.");
    }

    if (!path.isAbsolute(this._options.baseDir)) {
      throw new InternalError(
        `The 'baseDir' must be absolute path, passed value: ${this._options.baseDir}.`);
    }

    this._logger = new Logger({ name: `[${this.name}]`, ...this._options.loggerOptions });

    if (this._options.persistedOutputFileSystemNames && this._options.persistedOutputFileSystemNames.length) {
      this._options.persistedOutputFileSystemNames
        .filter(pfs => !this._persistedOutputFileSystemNames.includes(pfs))
        .forEach(pfs => this._persistedOutputFileSystemNames.push(pfs));
    }
  }

  apply(compiler: webpack.Compiler): void {
    let outputPath = this._options.outputPath;
    if (!outputPath && compiler.options.output && compiler.options.output.path) {
      outputPath = compiler.options.output.path;
    }

    const emitFn = (compilation: any, cb: (err?: Error) => void) => {
      const startTime = Date.now();
      this._newWrittenCount = 0;

      this._logger.debug('Processing assets to be copied');

      if (!this._options.assets || !this._options.assets.length) {
        this._logger.debug('No asset entry is passed');
        return cb();
      }

      preProcessAssets(this._options.baseDir, this._options.assets, compilation.inputFileSystem)
        .then(preProcessedEntries => processAssets(preProcessedEntries,
          outputPath,
          compilation.inputFileSystem))
        .then(processedAssets => this.writeFile(processedAssets, compiler, compilation, outputPath || ''))
        .then(() => {
          if (!this._newWrittenCount) {
            this._logger.debug('No asset has been emitted');
          }
          this._newWrittenCount = 0;
          const duration = Date.now() - startTime;
          this._logger.debug(`Copy completed in [${duration}ms]`);

          this._fileDependencies.forEach(file => {
            compilation.fileDependencies.add(file);
          });

          this._contextDependencies.forEach(context => {
            compilation.contextDependencies.add(context);
          });

          return cb();
        })
        .catch(err => {
          this._newWrittenCount = 0;
          return cb(err);
        });
    };

    compiler.hooks.emit.tapAsync(this.name, emitFn);
  }

  private async writeFile(processedAssets: ProcessedAssetsResult[],
    compiler: webpack.Compiler,
    compilation: any,
    outputPath: string):
    Promise<void> {
    await Promise.all(processedAssets.map(async (processedAsset) => {
      const assetEntry = processedAsset.assetEntry;

      if (assetEntry.fromType === 'directory' && !this._contextDependencies.includes(assetEntry.context)) {
        this._contextDependencies.push(assetEntry.context);
      }

      if (!this._options.allowCopyOutsideOutputPath &&
        outputPath &&
        path.isAbsolute(outputPath) &&
        (this._persistedOutputFileSystemNames.includes(compiler.outputFileSystem.constructor.name) ||
          this._options.forceWriteToDisk)) {
        const absoluteTo = path.resolve(outputPath, processedAsset.relativeTo);
        if (!isInFolder(outputPath, absoluteTo)) {
          throw new InvalidConfigError(
            `Copying assets outside of output path is not permitted, path: ${absoluteTo}.`);
        }
      }

      if (assetEntry.fromType !== 'directory' && !this._fileDependencies.includes(processedAsset.absoluteFrom)) {
        this._fileDependencies.push(processedAsset.absoluteFrom);
      }

      if (this._cachedFiles[processedAsset.absoluteFrom] &&
        this._cachedFiles[processedAsset.absoluteFrom][processedAsset.hash]) {
        this._logger.debug(`Already in cached - ${path.relative(processedAsset.assetEntry.context,
          processedAsset.absoluteFrom)}`);
        return;
      } else {
        this._cachedFiles[processedAsset.absoluteFrom] = {
          [processedAsset.hash]: true
        };
      }

      if (this._options.forceWriteToDisk &&
        !this._persistedOutputFileSystemNames.includes(compiler.outputFileSystem.constructor.name)) {
        if (!outputPath || outputPath === '/' || !path.isAbsolute(outputPath)) {
          throw new InternalError('The absolute path must be specified in config -> output.path.');
        }

        const absoluteTo = path.resolve(outputPath, processedAsset.relativeTo);

        this._logger.debug(`Emitting ${processedAsset.relativeTo} to disk`);
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

        ++this._newWrittenCount;
      } else if (!compilation.assets[processedAsset.relativeTo]) {
        this._logger.debug(
          `Emitting ${processedAsset.relativeTo}${compiler.outputFileSystem.constructor.name ===
            'MemoryFileSystem' &&
            !this._options.forceWriteToDisk
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

        ++this._newWrittenCount;
      }
    }));
  }
}
