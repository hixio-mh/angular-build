// Ref: webpack docs - https://webpack.github.io/docs/loaders.html
// Ref: webpack docs - https://webpack.github.io/docs/how-to-write-a-loader.html
// Ref: haydenbleasel/favicons - https://github.com/haydenbleasel/favicons
// Ref: webpack/loader-utils - https://github.com/webpack/loader-utils
// Ref: jantimon/favicons-webpack-plugin - https://github.com/jantimon/favicons-webpack-plugin
"use strict";
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const loaderUtils = require('loader-utils');
const icon_generator_1 = require("./icon-generator");
const utils_1 = require("./utils");
// ReSharper disable once InconsistentNaming
const PACKAGE_VERSION = '1.0';
function faviconProcessor(loader, content) {
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
    const options = loaderUtils.parseQuery(loader.query);
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
    faviconPersitenceCacheService.loadIconsFromDiskCache(loader, options, cacheFile, fileHash, (err, loaderResult) => {
        if (err) {
            callback(err);
            return;
        }
        if (loaderResult) {
            callback(null, `module.exports = ${JSON.stringify(loaderResult)}`);
            return;
        }
        if (!options.appName) {
            options.appName = utils_1.guessAppName(options.context || loader.options.context);
        }
        const faviconsGenerator = new icon_generator_1.IconGenerator();
        // Generate icons
        faviconsGenerator.generateIcons(content, pathPrefix, options.online, options.preferOnline, options, (genErr, iconStreamResult) => {
            if (genErr) {
                callback(genErr);
                return;
            }
            const mappedLoaderResult = {
                iconsPath: iconStreamResult.iconsPath,
                html: iconStreamResult.html,
                files: iconStreamResult.files.map((f) => iconStreamResult.iconsPath + f.name)
            };
            iconStreamResult.files.forEach((file) => {
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
class FaviconPersitenceCacheService {
    /**
   * Stores the given iconResult together with the control hashes as JSON file
   */
    emitCacheInformationFile(loader, options, cacheFile, fileHash, iconResult) {
        if (!options.persistentCache) {
            return;
        }
        const cachedResult = {
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
    isCacheValid(cache, fileHash, options) {
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
    loadIconsFromDiskCache(loader, options, cacheFile, fileHash, cb) {
        // Stop if cache is disabled
        if (!options.persistentCache) {
            cb(null);
            return;
        }
        const resolvedCacheFile = path.resolve(loader._compiler.parentCompilation
            ? loader._compiler.parentCompilation.compiler.outputPath
            : loader._compiler.outputPath, cacheFile);
        fs.exists(resolvedCacheFile, (exists) => {
            if (!exists) {
                cb(null);
                return;
            }
            fs.readFile(resolvedCacheFile, (err, content) => {
                if (err) {
                    cb(err);
                    return;
                }
                try {
                    const cache = JSON.parse(content);
                    // Bail out if the file or the option changed
                    if (!this.isCacheValid(cache, fileHash, options)) {
                        cb(null);
                        return;
                    }
                    cb(null, cache.result);
                }
                catch (e) {
                    cb(e);
                    return;
                }
            });
        });
    }
    /**
     * Generates a md5 hash for the given options
     */
    generateHashForOptions(options) {
        const hash = crypto.createHash('md5');
        hash.update(JSON.stringify(options));
        return hash.digest('hex');
    }
}
exports.FaviconPersitenceCacheService = FaviconPersitenceCacheService;
// ReSharper disable once CommonJsExternalModule
module.exports = function (content) {
    try {
        faviconProcessor.call(undefined, this, content);
    }
    catch (e) {
        console.error(e, e.stack);
        throw e;
    }
};
module.exports.raw = true;
//# sourceMappingURL=icon-loader.js.map