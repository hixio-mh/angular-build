import * as path from 'path';

import { ensureDir, writeFile } from 'fs-extra';
import * as webpack from 'webpack';

import { InternalError } from '../../../error-models';
import { Logger, LoggerOptions } from '../../../utils';

export interface WriteStatsJsonWebpackPluginOptions {
  /**
   * Absolute path for assets json file.
   */
  path: string;
  outputPath?: string;
  forceWriteToDisk?: boolean;
  persistedOutputFileSystemNames?: string[];
  loggerOptions?: LoggerOptions;
}

export class WriteStatsJsonWebpackPlugin {
  private readonly _logger: Logger;
  private readonly _persistedOutputFileSystemNames = ['NodeOutputFileSystem'];

  get name(): string {
    return 'write-stats-json-webpack-plugin';
  }

  constructor(private readonly _options: WriteStatsJsonWebpackPluginOptions) {
    if (!_options) {
      throw new InternalError(`[${this.name}] The 'options' can't be null or empty.`);
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

    compiler.hooks.afterEmit.tapPromise(this.name, async (compilation: any) => {
      if (!outputPath || outputPath === '/' || !path.isAbsolute(outputPath)) {
        compilation.errors.push(new InternalError(
          `[${this.name}] Absolute output path must be specified in webpack config -> output -> path.`));
        return;
      }

      const statsFilepath = this._options.path;
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
      const assetsToWrite = Object.keys(assetsByChunkName).reduce((chunkMap: any, chunkName: string) => {
        let assets = assetsByChunkName[chunkName];
        if (!Array.isArray(assets)) {
          assets = [assets];
        }

        chunkMap[chunkName] = assets;
        return chunkMap;
      },
        {});

      const statsFileRelative = path.relative(outputPath, statsFilepath);
      const content = Buffer.from(JSON.stringify(assetsToWrite, null, 2), 'utf8');
      if (this._options.forceWriteToDisk &&
        !this._persistedOutputFileSystemNames.includes(compiler.outputFileSystem.constructor.name)) {
        this._logger.debug(`Emitting ${statsFileRelative} to disk`);
        await ensureDir(path.dirname(statsFilepath));
        await writeFile(statsFilepath, content);

      } else {
        this._logger.debug(`Emitting ${statsFileRelative}`);
        await new Promise((resolve, reject) => {
          compiler.outputFileSystem.mkdirp(path.dirname(statsFilepath),
            (err: Error) => {
              if (err) {
                reject(err);
                return;
              }

              compiler.outputFileSystem.writeFile(statsFilepath, content, resolve);
            });
        });
      }
    });
  }
}
