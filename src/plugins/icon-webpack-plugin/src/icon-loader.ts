// Ref: webpack docs - https://webpack.github.io/docs/loaders.html
// Ref: webpack docs - https://webpack.github.io/docs/how-to-write-a-loader.html
// Ref: haydenbleasel/favicons - https://github.com/haydenbleasel/favicons
// Ref: webpack/loader-utils - https://github.com/webpack/loader-utils
// Ref: jantimon/favicons-webpack-plugin - https://github.com/jantimon/favicons-webpack-plugin

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

const loaderUtils = require('loader-utils');
//const pluginVersion = require('../package.json').version;
import { IconLoaderOptions, IconResult, IconFileInfo, IconLoaderResult } from './models';
import { IconGenerator } from './icon-generator';
import { guessAppName } from './utils';

// ReSharper disable once InconsistentNaming
const PACKAGE_VERSION = '1.0';

// ReSharper disable once InconsistentNaming
export interface Loader {
    // version: string;
    //context: string;
    // request: string;
    // data: any;
    // loaders: any[];
    // loaderIndex: number;
    // resourceQuery: string;
    // emitWarning: (message: string) => void;
    // emitError: (message: string) => void;
    // exec
    // resolveSync
    // addContextDependency
    // value
    // inputValue
    // debug
    // minimize
    // sourceMap
    // target
    // webpack

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
    optionHash: string;
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

    // TODO: the next version of loaderUtils
    //const options = <QueryOptions>loaderUtils.getOptions(loader.query);
    const options = <QueryOptions>loaderUtils.parseQuery(loader.query);
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
    //const publicPath = getPublicPath(loader._compilation);

    faviconPersitenceCacheService.loadIconsFromDiskCache(loader, options, cacheFile, fileHash, (err: Error, loaderResult: IconLoaderResult) => {
        if (err) {
            callback(err);
            return;
        }

        if (loaderResult) {
            callback(null, `module.exports = ${JSON.stringify(loaderResult)}`);
            return;
        }

        if (!options.appName) {
            options.appName = guessAppName(options.context || loader.options.context);
        }

        const faviconsGenerator = new IconGenerator();
        // Generate icons
        faviconsGenerator.generateIcons(content, pathPrefix, options.online, options.preferOnline, options, (genErr: any, iconStreamResult: IconResult) => {
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
                loader.emitFile(pathPrefix + file.name, file.contents);
            });

            faviconPersitenceCacheService.emitCacheInformationFile(loader, options, cacheFile, fileHash, mappedLoaderResult);
            callback(null, `module.exports = ${JSON.stringify(mappedLoaderResult)}`);
        });
    });
}

//function getPublicPath(compilation: any): string {
//  let publicPath = compilation.outputOptions.publicPath || '';
//  if (publicPath.length && publicPath.substr(-1) !== '/') {
//    publicPath += '/';
//  }
//  return publicPath;
//}

export class FaviconPersitenceCacheService {
    /**
   * Stores the given iconResult together with the control hashes as JSON file
   */
    emitCacheInformationFile(loader: Loader, options: QueryOptions, cacheFile: string, fileHash: string, iconResult: IconLoaderResult): void {
        if (!options.persistentCache) {
            return;
        }

        const cachedResult: LoaderCachedResult = {
            hash: fileHash,
            version: PACKAGE_VERSION,
            optionHash: this.generateHashForOptions(options),
            result: iconResult
        };

        loader.emitFile(cacheFile, JSON.stringify(cachedResult));
    }

    /**
     * Checks if the given cache object is still valid
     */
    isCacheValid(cache: LoaderCachedResult, fileHash: string, options: QueryOptions): boolean {
        // Verify that the source file is the same
        return cache.hash === fileHash &&
            // Verify that the options are the same
            cache.optionHash === this.generateHashForOptions(options) &&
            // Verify that the favicons version of the cache maches this version
            cache.version === PACKAGE_VERSION;
    }

    /**
     * Try to load the file from the disc cache
     */
    loadIconsFromDiskCache(loader: Loader, options: QueryOptions, cacheFile: string, fileHash: string, cb: (err: Error, result?: IconLoaderResult) => void): void {
        // Stop if cache is disabled
        if (!options.persistentCache) {
            cb(null);
            return;
        }

        const resolvedCacheFile = path.resolve(loader._compiler.parentCompilation
            ? loader._compiler.parentCompilation.compiler.outputPath
            : loader._compiler.outputPath,
            cacheFile);

        fs.exists(resolvedCacheFile,
            (exists: boolean) => {
                if (!exists) {
                    cb(null);
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
                                cb(null);
                                return;
                            }
                            cb(null, cache.result);
                        } catch (e) {
                            cb(e);
                            return;
                        }
                    });
            });
    }

    /**
     * Generates a md5 hash for the given options
     */
    generateHashForOptions(options: QueryOptions): string {
        const hash = crypto.createHash('md5');
        hash.update(JSON.stringify(options));
        return hash.digest('hex');
    }
}

// ReSharper disable once CommonJsExternalModule
module.exports = function (content: any) {
    try {
        faviconProcessor.call(undefined, this, content);
    } catch (e) {
        console.error(e, e.stack);
        throw e;
    }
}
module.exports.raw = true;