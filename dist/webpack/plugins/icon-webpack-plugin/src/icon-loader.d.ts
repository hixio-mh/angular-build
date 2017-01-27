/// <reference types="node" />
import { IconLoaderOptions, IconLoaderResult } from './models';
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
    _compiler: any;
    _compilation: any;
}
export declare type QueryOptions = IconLoaderOptions;
export interface LoaderCachedResult {
    hash: string;
    version: string;
    optionHash: string;
    result: IconLoaderResult;
}
export declare class FaviconPersitenceCacheService {
    /**
   * Stores the given iconResult together with the control hashes as JSON file
   */
    emitCacheInformationFile(loader: Loader, options: QueryOptions, cacheFile: string, fileHash: string, iconResult: IconLoaderResult): void;
    /**
     * Checks if the given cache object is still valid
     */
    isCacheValid(cache: LoaderCachedResult, fileHash: string, options: QueryOptions): boolean;
    /**
     * Try to load the file from the disc cache
     */
    loadIconsFromDiskCache(loader: Loader, options: QueryOptions, cacheFile: string, fileHash: string, cb: (err: Error, result?: IconLoaderResult) => void): void;
    /**
     * Generates a md5 hash for the given options
     */
    generateHashForOptions(options: QueryOptions): string;
}
