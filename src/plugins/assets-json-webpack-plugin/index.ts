const fs = require('fs-extra');
import * as path from 'path';

export interface AssetsJsonPluginOptions {
    fileName?: string;
}

export class AssetsJsonWebpackPlugin {
    constructor(private readonly options: AssetsJsonPluginOptions) {
    }

    apply(compiler: any): void {
        compiler.plugin('emit',
            (compilation: any, cb: (err?: Error, request?: any) => void) => {
                const bundleDir = compiler.outputFileSystem.constructor.name === 'MemoryFileSystem'
                    ? null
                    : compiler.outputPath;

                if (bundleDir === null) {
                    cb();
                    return;
                }

                let statsFilepath = this.options.fileName || 'assets.json';
                if (!path.isAbsolute(statsFilepath)) {
                    statsFilepath = path.resolve(bundleDir, statsFilepath);
                }

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
                    },
                    {});

                fs.ensureDir(path.dirname(statsFilepath))
                    .then(() => fs.writeFile(
                        statsFilepath,
                        JSON.stringify(assetsToWrite, null, 2)
                    )).then(() => cb())
                    .catch(cb);
            });
    }
}
