// Ref: webpack docs - https://webpack.github.io/docs/loaders.html
// Ref: webpack docs - https://webpack.github.io/docs/how-to-write-a-loader.html
// Ref: haydenbleasel/favicons - https://github.com/haydenbleasel/favicons
// Ref: webpack/loader-utils - https://github.com/webpack/loader-utils
// Ref: jantimon/favicons-webpack-plugin - https://github.com/jantimon/favicons-webpack-plugin

import * as fs from 'fs';
import * as path from 'path';

const loaderUtils = require('loader-utils');
import { IconLoaderOptions, IconGenerateResult, IconFileInfo, IconLoaderResult } from './plugin-models';
import { IconGenerator } from './icon-generator';

// ReSharper disable once InconsistentNaming
const PACKAGE_VERSION = '1.0';

// ReSharper disable once InconsistentNaming
export interface Loader {
    cacheable: () => void;
    query: string;
    async: () => (err: Error, source?: any, map?: string) => void;
    resourcePath: string;
    resolve: () => void;
    addDependency: (dep: string) => void;
    clearDependencies: () => void;
    emitFile: (fileName: string, content: Buffer | string, sourceMap?: any) => void;
    options: any;

    // ReSharper disable once InconsistentNaming
    _compiler: any;
    // ReSharper disable once InconsistentNaming
    _compilation: any;
}

export type QueryOptions = IconLoaderOptions;

// ReSharper disable once InconsistentNaming
export interface LoaderCachedResult {
    hash: string;
    version: string;
    optionHash?: string;
    result: IconLoaderResult;
}

function faviconProcessor(loader: Loader, content: Buffer): void {
    if (!loader.emitFile) {
        throw new Error('emitFile is required from module system');
    }
    if (!loader.async) {
        throw new Error('async is required');
    }

    if (loader.cacheable) {
        loader.cacheable();
    }

    const callback = loader.async();
    const nullError: any = undefined;

    const options = <QueryOptions>loaderUtils.getOptions(loader);
    const pathPrefix = loaderUtils.interpolateName(loader, options.iconsPath, {
        context: options.context || loader.options.context,
        content: content,
        regExp: options.regExp
    });

    const fileHash = loaderUtils.interpolateName(loader, '[hash]', {
        context: options.context || loader.options.context,
        content: content,
        regExp: options.regExp
    });

    const cacheFile = pathPrefix + '.cache';
    const faviconPersitenceCacheService = new FaviconPersitenceCacheService();
    // const publicPath = getPublicPath(loader._compilation);

    faviconPersitenceCacheService.loadIconsFromDiskCache(loader,
        options,
        cacheFile,
        fileHash,
        (err: Error, loaderResult: IconLoaderResult) => {
            if (err) {
                callback(err);
                return;
            }

            if (loaderResult) {
                callback(nullError, `module.exports = ${JSON.stringify(loaderResult)}`);
                return;
            }

            const faviconsGenerator = new IconGenerator();
            // Generate icons
            faviconsGenerator.generateIcons(content,
                pathPrefix,
                options.online as boolean,
                options.preferOnline as boolean,
                options,
                (genErr: any, iconStreamResult: IconGenerateResult) => {
                    if (genErr) {
                        callback(genErr);
                        return;
                    }

                    const mappedLoaderResult: IconLoaderResult = {
                        iconsPath: iconStreamResult.iconsPath,
                        html: iconStreamResult.html,
                        files: iconStreamResult.files.map((f: IconFileInfo) => iconStreamResult.iconsPath + f.name)
                    };

                    iconStreamResult.files.forEach((file: any) => {
                        if (options.emitFaviconIcoToOutDirRoot && file.name === 'favicon.ico') {
                            loader.emitFile(file.name, file.contents);
                        }

                        loader.emitFile(pathPrefix + file.name, file.contents);
                    });

                    faviconPersitenceCacheService.emitCacheInformationFile(loader,
                        options,
                        cacheFile,
                        fileHash,
                        mappedLoaderResult);
                    callback(nullError, `module.exports = ${JSON.stringify(mappedLoaderResult)}`);
                });
        });
}

export class FaviconPersitenceCacheService {
    emitCacheInformationFile(loader: Loader,
        options: QueryOptions,
        cacheFile: string,
        fileHash: string,
        iconResult: IconLoaderResult): void {
        if (!options.persistentCache) {
            return;
        }

        const cachedResult: LoaderCachedResult = {
            hash: fileHash,
            version: PACKAGE_VERSION,
            // optionHash: this.generateHashForOptions(options),
            result: iconResult
        };

        loader.emitFile(cacheFile, JSON.stringify(cachedResult));
    }

    isCacheValid(cache: LoaderCachedResult, fileHash: string, options: QueryOptions): boolean {
        const fileHashEqual = cache.hash === fileHash;
        // Verify that the source file is the same
        return fileHashEqual &&
            // Verify that the options are the same
            // cache.optionHash === this.generateHashForOptions(options) &&
            // Verify that the favicons version of the cache maches this version
            cache.version === PACKAGE_VERSION;
    }

    loadIconsFromDiskCache(loader: Loader,
        options: QueryOptions,
        cacheFile: string,
        fileHash: string,
        cb: (err?: Error, result?: IconLoaderResult) => void): void {
        // Stop if cache is disabled
        if (!options.persistentCache) {
            cb(undefined);
            return;
        }

        const resolvedCacheFile = path.resolve(loader._compiler.parentCompilation
            ? loader._compiler.parentCompilation.compiler.outputPath
            : loader._compiler.outputPath,
            cacheFile);

        fs.exists(resolvedCacheFile,
            (exists: boolean) => {
                if (!exists) {
                    cb(undefined);
                    return;
                }

                fs.readFile(resolvedCacheFile,
                    (err: Error, content: any) => {
                        if (err) {
                            cb(err);
                            return;
                        }

                        try {
                            const cache: LoaderCachedResult = JSON.parse(content);
                            // Bail out if the file or the option changed
                            if (!this.isCacheValid(cache, fileHash, options)) {
                                cb(undefined);
                                return;
                            }

                            const result = cache.result;
                            cb(undefined, result);
                        } catch (e) {
                            cb(e);
                            return;
                        }
                    });
            });
    }

    // generateHashForOptions(options: QueryOptions): string {
    //    const hash = crypto.createHash('md5');
    //    hash.update(JSON.stringify(options));
    //    return hash.digest('hex');
    // }
}

// ReSharper disable once CommonJsExternalModule
module.exports = function(content: any): any {
    try {
        faviconProcessor.call(undefined, this, content);
    } catch (e) {
        console.error(e, e.stack);
        throw e;
    }
};

module.exports.raw = true;
