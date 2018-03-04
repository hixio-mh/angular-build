import * as path from 'path';

import * as rimraf from 'rimraf';

import {
    FaviconsConfig,
    InternalError,
    InvalidConfigError
} from '../../../models';

import { generateHashDigest } from '../../../utils/generate-hash-digest';
import { isBase64 } from '../../../utils/is-base64';
import { isUrl } from '../../../utils/is-url';
import { stripComments } from '../../../utils/strip-comments';
import { Logger, LoggerOptions } from '../../../utils/logger';
import { formatValidationError, validateSchema } from '../../../utils/validate-schema';
import { IconStatsInfo } from './internal-models';
import { ChildComplier } from './compiler';

function readFile(filename: string, compilation: any): Promise<string> {
    return new Promise<string>((resolve, reject) => {
        compilation.inputFileSystem.readFile(filename, (err: Error, data: Buffer) => {
            if (err) {
                reject(err);
                return;
            }

            const content = data.toString();
            resolve(content);
        });
    });
}

export interface FaviconsWebpackPluginOptions {
    srcDir: string;
    outputPath?: string;

    configFilePath?: string;
    faviconsConfig?: FaviconsConfig;

    forceWriteToDisk?: boolean;
    persistedOutputFileSystemNames?: string[];

    // valide schema options
    validateSchema?: boolean;
    schema?: any;

    appName?: string;
    appVersion?: string;
    appDescription?: string;
    developerUrl?: string;
    developerName?: string;
    lang?: string;

    // logger options
    loggerOptions?: LoggerOptions;
}

export class FaviconsWebpackPlugin {
    private readonly _logger: Logger;
    private readonly _defaultFaviconsConfigOptions: FaviconsConfig = {
        masterPicture: '',
        iconsPath: 'icons-[hash]/',
        online: true,
        fallbackOffline: true,
        cache: true,
        emitFaviconIcoToOutDirRoot: true,
        settings: {
            scalingAlgorithm: 'Mitchell',
            errorOnImageTooSmall: false
        }
    };
    private readonly _persistedOutputFileSystemNames = ['NodeOutputFileSystem'];

    private _faviconsConfig?: FaviconsConfig | null = null;
    private _fileDependencies = new Set<string>();

    private _iconStatsCacheInfo: IconStatsInfo | null = null;
    private _hasPersistedCachedFile = false;

    get name(): string {
        return 'favicons-webpack-plugin';
    }

    constructor(private readonly _options: FaviconsWebpackPluginOptions) {
        if (!_options) {
            throw new InternalError(`[${this.name}] The 'options' is required`);
        }

        if (!this._options.srcDir) {
            throw new InternalError("The 'srcDir' property is required.");
        }

        if (!path.isAbsolute(this._options.srcDir)) {
            throw new InternalError(
                `The 'srcDir' must be absolute path, passed value: ${this._options.srcDir}.`);
        }

        if (!this._options.configFilePath && !this._options.faviconsConfig) {
            throw new InternalError("The 'configFilePath' or 'faviconsConfig' property is required.");
        }

        this._logger = new Logger({ name: `[${this.name}]`, ...this._options.loggerOptions });

        if (this._options.persistedOutputFileSystemNames && this._options.persistedOutputFileSystemNames.length) {
            this._options.persistedOutputFileSystemNames
                .filter(pfs => !this._persistedOutputFileSystemNames.includes(pfs))
                .forEach(pfs => this._persistedOutputFileSystemNames.push(pfs));
        }
    }

    apply(compiler: any): void {
        // TODO: to reivew
        const context = compiler.options.context || process.cwd();
        const outputPath = this._options.outputPath || compiler.outputPath;

        compiler.hooks.make.tapPromise(this.name, async (compilation: any) => {
                // reading config
                this._logger.debug('Initializing options');

                if (this._options.configFilePath) {
                    const configFilePath = this._options.configFilePath;
                    this._fileDependencies.add(configFilePath);

                    this._logger.debug(`Reading ${path.relative(context || process.cwd(), configFilePath)} file`);
                    const configContent = await readFile(configFilePath, compilation);
                    const data = stripComments(configContent.replace(/^\uFEFF/, ''));
                    const config = JSON.parse(data);

                    if (this._options.validateSchema && this._options.schema) {
                        if ((config as any).$schema) {
                            delete (config as any).$schema;
                        }
                        if (config._schema) {
                            delete config._schema;
                        }
                        if (config._schemaValidated) {
                            delete config._schemaValidated;
                        }

                        const errors = validateSchema(this._options.schema, config);
                        if (errors.length) {
                            this._faviconsConfig = null;

                            const errMsg = errors.map(e => formatValidationError(this._options.schema, e))
                                .join('\n');
                            compilation.errors.push(new InvalidConfigError(
                                `[${this.name}] Invalid configuration.\n\n${
                                errMsg}\n`));
                            return;
                        }
                    }

                    this.applySharedOptions(config as FaviconsConfig);
                    this._faviconsConfig = { ...this._defaultFaviconsConfigOptions, ...config };
                } else if (this._options.faviconsConfig) {
                    this._faviconsConfig = { ...this._defaultFaviconsConfigOptions, ...this._options.faviconsConfig };
                    this.applySharedOptions(this._faviconsConfig as FaviconsConfig);
                }

                if (!this._faviconsConfig || !this._faviconsConfig.masterPicture) {
                    return;
                }

                const faviconsConfig = this._faviconsConfig;
                const inputFileSystem = (compiler as any).inputFileSystem;
                const cacheFilePath = outputPath ? path.resolve(outputPath, '.icons-cache') : undefined;
                const isPersistedOutFileSystem =
                    this._persistedOutputFileSystemNames.includes(compiler.outputFileSystem.constructor.name);
                const forceWriteToDisk = this._options.forceWriteToDisk && !isPersistedOutFileSystem;

                if (forceWriteToDisk && (!outputPath || outputPath === '/' || !path.isAbsolute(outputPath))) {
                    compilation.errors.push(new InternalError(
                        'To force write to disk, absolute output path must be specified at webpack config -> output -> path.'));
                    return;
                }

                const fileMap = await this.checkAndLoadCacheInfo(faviconsConfig,
                    inputFileSystem,
                    outputPath,
                    cacheFilePath);
                if (this._iconStatsCacheInfo) {
                    return;
                }

                Object.keys(fileMap).forEach(p => {
                    this._fileDependencies.add(p);
                });

                this._logger.debug('Creating child compiler');
                const childComplier = new ChildComplier(faviconsConfig,
                    this._options.srcDir,
                    context,
                    forceWriteToDisk as boolean,
                    compilation,
                    this._logger);

                try {
                    this._iconStatsCacheInfo = await
                        childComplier.compile(fileMap, isPersistedOutFileSystem, outputPath, cacheFilePath);
                    compilation._htmlInjectOptions = compilation._htmlInjectOptions || {};
                    compilation._htmlInjectOptions.iconHtmls = this._iconStatsCacheInfo.stats.htmls;

                } catch (err2) {
                    this._iconStatsCacheInfo = null;
                    compilation._htmlInjectOptions = compilation._htmlInjectOptions || {};
                    compilation._htmlInjectOptions.iconRawHtmls = [];
                    compilation.errors.push(`[${this.name}] ${err2.message || err2}`);
                }
            });

        compiler.hooks.emit.tap(this.name,
            (compilation: any) => {
                for (const d of this._fileDependencies) {
                    compilation.fileDependencies.add(d);
                }
            });
    }

    private async checkAndLoadCacheInfo(faviconsConfig: FaviconsConfig,
        inputFileSystem: any,
        outputPath?: string,
        cacheFilePath?: string): Promise<{ [key: string]: Buffer }> {
        const fileMap = await this.getMasterPictureFilesMap(inputFileSystem);
        if (faviconsConfig.cache === false) {
            return fileMap;
        }

        if (!this._iconStatsCacheInfo && cacheFilePath) {
            try {
                this._logger.debug('Reading persisted cache file');
                this._iconStatsCacheInfo = await this.loadCacheInfo(cacheFilePath, inputFileSystem);
                this._hasPersistedCachedFile = true;
            } catch (e) {
                this._iconStatsCacheInfo = null;
                this._hasPersistedCachedFile = false;
                this._logger.warn(`Couldn't read persisted cache file, path: ${cacheFilePath}`);
            }
        }

        if (this._iconStatsCacheInfo) {
            const optionHash = generateHashDigest(JSON.stringify(faviconsConfig));
            let cacheValid = this._iconStatsCacheInfo.optionHash === optionHash;
            if (cacheValid) {
                const filesContent = JSON.stringify(fileMap);
                const filesHash = generateHashDigest(filesContent);
                cacheValid = this._iconStatsCacheInfo.filesHash === filesHash;
                if (cacheValid) {
                    this._logger.debug('Found valid cache');
                    return fileMap;
                }
            }

            this._logger.debug('Invalid cache');
            if (outputPath && cacheFilePath && this._hasPersistedCachedFile) {
                this._logger.debug('Cleaning persisted cache');
                await new Promise((resolve: any) => rimraf(cacheFilePath, () => resolve()));
                await Promise.all(this._iconStatsCacheInfo.stats.assets.map(assetFileName => {
                    const assetFilePath = path.resolve(outputPath, assetFileName);
                    return new Promise((resolve: any) => rimraf(assetFilePath,
                        () => resolve())
                    );
                }));
                if (this._iconStatsCacheInfo.stats.iconsPathPrefix) {
                    const iconPath = path.resolve(outputPath, this._iconStatsCacheInfo.stats.iconsPathPrefix);
                    await new Promise((resolve: any) => rimraf(iconPath,
                        () => resolve()));
                }

                this._iconStatsCacheInfo = null;
            }
        } else {
            this._logger.debug('No persisted cache file');
        }

        return fileMap;
    }

    private async loadCacheInfo(cacheFilePath: string, inputFileSystem: any): Promise<IconStatsInfo | null> {
        const cacheExists = await new Promise((resolve) => {
            inputFileSystem.stat(cacheFilePath,
                (statError: Error) => {
                    resolve(statError ? false : true);
                });
        });

        if (!cacheExists) {
            return null;
        }

        return new Promise<IconStatsInfo | null>((resolve, reject) => {
            inputFileSystem.readFile(cacheFilePath,
                (err: Error, content: any) => {
                    if (err) {
                        return reject(err);
                    }

                    try {
                        const cache = JSON.parse(content) as IconStatsInfo;
                        resolve(cache);
                    } catch (e) {
                        return reject(e);
                    }
                });
        });
    }

    private async getMasterPictureFilesMap(inputFileSystem: any): Promise<{ [key: string]: Buffer }> {
        const masterPicturePaths: string[] = [];
        this.readAllMasterPicturePaths(JSON.parse(JSON.stringify(this._faviconsConfig)),
            masterPicturePaths);
        masterPicturePaths.forEach(p => {
            if (!/\.(jpe?g|png|svg|gif)$/i.test(p)) {
                throw new InvalidConfigError(
                    'Unsupported masterPicture format. Only jpg, png, svg or gif is supported.');
            }
        });
        const fileMaps = await Promise.all(masterPicturePaths.map(async (p) => {
            const content = await new Promise<Buffer>((resolve, reject) => {
                inputFileSystem.readFile(p,
                    (err: Error, data: Buffer) => {
                        if (err) {
                            return reject(err);
                        }

                        return resolve(data);
                    });
            });

            return {
                [p]: content
            };
        }));

        const fileMap = fileMaps.reduce((file1, file2) => Object.assign(file1, file2));
        return fileMap;
    }

    private readAllMasterPicturePaths(request: any, paths: string[]): any {
        if (request.constructor === Array) {
            for (let i = 0; i < request.length; i++) {
                request[i] = this.readAllMasterPicturePaths(request[i], paths);
            }
            return request;
        } else if (request.constructor === Object) {
            const keys = Object.keys(request);
            for (let j = 0; j < keys.length; j++) {
                if (keys[j] === 'master_picture' || keys[j] === 'masterPicture') {
                    request[keys[j]] = request[keys[j]];

                    const masterPicture = request[keys[j]] as any;
                    if (typeof masterPicture === 'string') {
                        if (!isUrl(masterPicture)) {
                            const masterPicturePath = path.isAbsolute(masterPicture)
                                ? path.resolve(masterPicture)
                                : path.resolve(this._options.srcDir, masterPicture);
                            if (!paths.includes(masterPicturePath)) {
                                paths.push(masterPicturePath);
                            }
                        }
                    } else if (masterPicture.type === 'inline' || masterPicture.content !== undefined) {
                        if (!isBase64(masterPicture.content)) {
                            const masterPicturePath = path.isAbsolute(masterPicture.content)
                                ? path.resolve(masterPicture.content)
                                : path.resolve(this._options.srcDir, masterPicture.content);
                            if (!paths.includes(masterPicturePath)) {
                                paths.push(masterPicturePath);
                            }
                        }
                    }

                } else {
                    request[keys[j]] = this.readAllMasterPicturePaths(request[keys[j]], paths);
                }
            }
            return request;
        } else {
            return request;
        }
    }

    private applySharedOptions(config: FaviconsConfig): void {
        config.appName = config.appName || this._options.appName;
        config.version = config.version || this._options.appVersion;
        config.appDescription = config.appDescription || this._options.appDescription;
        config.developerUrl = config.developerUrl || this._options.developerUrl;
        config.developerName = config.developerName || this._options.developerName;
        config.lang = config.lang || this._options.lang;
    }
}
