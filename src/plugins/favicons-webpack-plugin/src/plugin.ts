import * as path from 'path';

import * as rimraf from 'rimraf';
import * as webpack from 'webpack';

import {
    FaviconsConfig,
    InternalError,
    InvalidConfigError } from '../../../models';
import {
    formatValidationError,
    generateHashDigest,
    isBase64,
    isUrl,
    Logger,
    LoggerOptions,
    stripComments,
    validateSchema } from '../../../utils';

import { IconStatsInfo } from './internal-models';
import { ChildComplier } from './compiler';

export interface FaviconsWebpackPluginOptions {
    baseDir: string;

    configFilePath?: string;
    faviconsConfig?: FaviconsConfig;

    forceWriteToDisk?: boolean;
    persistedOutputFileSystemNames?: string[];

    // valide schema options
    validateSchema?: boolean;
    schema?: any;

    htmlPluginOptionKey?: string;

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
    private readonly logger: Logger;
    private readonly fileDependencies: string[] = [];
    private readonly defaultFaviconsConfigOptions: FaviconsConfig = {
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
    private readonly persistedOutputFileSystemNames = ['NodeOutputFileSystem'];

    private faviconsConfig?: FaviconsConfig | null = null;
    private faviconsConfigFilePath?: string;
    private lastConfigHash?: string;
    private lastTimeStamp?: number;

    private iconStatsCacheInfo: IconStatsInfo | null;
    private hasPersistedCachedFile: boolean;

    get name(): string {
        return 'FaviconsWebpackPlugin';
    }

    constructor(private readonly options: FaviconsWebpackPluginOptions) {
        if (!options) {
            throw new InternalError(`[${this.name}] The 'options' is required`);
        }
        if (!this.options.baseDir) {
            throw new InternalError(`The 'baseDir' property is required.`);
        }

        if (!path.isAbsolute(this.options.baseDir)) {
            throw new InternalError(
                `The 'baseDir' must be absolute path, passed value: ${this.options.baseDir}.`);
        }

        if (!this.options.configFilePath && !this.options.faviconsConfig) {
            throw new InternalError(`The 'configFilePath' or 'faviconsConfig' property is required.`);
        }

        const loggerOptions = this.options.loggerOptions || {} as LoggerOptions;
        loggerOptions.name = `[${this.name}]`;
        this.logger = new Logger(loggerOptions);

        if (this.options.persistedOutputFileSystemNames && this.options.persistedOutputFileSystemNames.length) {
            this.options.persistedOutputFileSystemNames
                .filter(pfs => !this.persistedOutputFileSystemNames.includes(pfs))
                .forEach(pfs => this.persistedOutputFileSystemNames.push(pfs));
        }
    }

    apply(compiler: webpack.Compiler): void {
        const context = compiler.options.context || process.cwd();
        const outputPath = compiler.options.output ? compiler.options.output.path : '';

        compiler.plugin('before-compile',
            (params: any, cb: (err?: Error) => void) => {
                if (this.lastTimeStamp &&
                    this.lastTimeStamp > 0 &&
                    Date.now() - this.lastTimeStamp < 500 &&
                    this.faviconsConfig) {
                    if (this.faviconsConfigFilePath) {
                        params.compilationDependencies.push(this.faviconsConfigFilePath);
                    }

                    this.lastTimeStamp = Date.now();
                    return cb();
                }

                this.logger.debug(`Initializing options`);

                if (this.options.configFilePath) {
                    const configFilePath = this.options.configFilePath;
                    if (!(params.compilationDependencies as string[]).includes(configFilePath)) {
                        this.logger.debug(
                            `Adding ${path.relative(context || process.cwd(), configFilePath)
                            } to compilation dependencies`);
                        params.compilationDependencies.push(configFilePath);
                    }

                    this.logger.debug(`Reading ${path.relative(context || process.cwd(), configFilePath)} file`);
                    (compiler as any).inputFileSystem.readFile(configFilePath,
                        (err: Error, result: any) => {
                            if (err) {
                                this.lastTimeStamp = 0;
                                this.lastConfigHash = '';
                                this.faviconsConfigFilePath = '';
                                this.faviconsConfig = null;

                                return cb(err);
                            }

                            const content = result.toString('utf8');
                            const contentHash = generateHashDigest(content);

                            if (this.lastConfigHash && this.faviconsConfig && contentHash === this.lastConfigHash) {
                                this.logger.debug(`No configuration changed`);

                                this.lastTimeStamp = Date.now();
                                return cb();
                            }

                            this.lastConfigHash = contentHash;

                            const data = stripComments(content.replace(/^\uFEFF/, ''));
                            const faviconsConfig = JSON.parse(data);

                            // validation
                            if (this.options.validateSchema && this.options.schema) {
                                if ((faviconsConfig as any).$schema) {
                                    delete (faviconsConfig as any).$schema;
                                }
                                if (faviconsConfig._schema) {
                                    delete faviconsConfig._schema;
                                }
                                if (faviconsConfig._schemaValidated) {
                                    delete faviconsConfig._schemaValidated;
                                }

                                const errors = validateSchema(this.options.schema, faviconsConfig);
                                if (errors.length) {
                                    this.lastTimeStamp = 0;
                                    this.lastConfigHash = '';
                                    this.faviconsConfigFilePath = '';
                                    this.faviconsConfig = null;

                                    const errMsg = errors.map(e => formatValidationError(this.options.schema, e))
                                        .join('\n');
                                    return cb(new InvalidConfigError(
                                        `[${this.name}] Invalid configuration.\n\n${
                                        errMsg}\n`));
                                }
                            }

                            this.applySharedOptions(faviconsConfig as FaviconsConfig);
                            this.faviconsConfig = Object.assign({}, this.defaultFaviconsConfigOptions, faviconsConfig);
                            this.faviconsConfigFilePath = configFilePath;

                            this.logger.debug(`The options has been initialized`);

                            this.lastTimeStamp = Date.now();
                            return cb();
                        });
                } else if (this.options.faviconsConfig) {
                    this.lastConfigHash = '';
                    this.faviconsConfigFilePath = '';

                    this.faviconsConfig = Object.assign({}, this.defaultFaviconsConfigOptions, this.options.faviconsConfig);
                    this.applySharedOptions(this.faviconsConfig as FaviconsConfig);

                    this.logger.debug(`The options has been initialized`);

                    this.lastTimeStamp = Date.now();
                    return cb();
                } else {
                    this.lastConfigHash = '';
                    this.faviconsConfigFilePath = '';

                    this.faviconsConfig = Object.assign({}, this.defaultFaviconsConfigOptions, this.options);
                    this.applySharedOptions(this.faviconsConfig as FaviconsConfig);

                    this.lastTimeStamp = Date.now();
                    return cb();
                }
            });

        compiler.plugin('compilation', (compilation: any) => {
            compilation.plugin('html-webpack-plugin-before-html-generation',
                (htmlPluginArgs: any, cb: (err?: Error, htmlPluginArgs?: any) => void) => {
                    if (!this.iconStatsCacheInfo || !this.iconStatsCacheInfo.stats) {
                        return cb(undefined, htmlPluginArgs);
                    }

                    let publicPath = '';
                    if (htmlPluginArgs.assets &&
                        htmlPluginArgs.assets.publicPath &&
                        htmlPluginArgs.assets.publicPath !== '/') {
                        publicPath = htmlPluginArgs.assets.publicPath;
                        const endsWithBsRegex = /\/$/;
                        const startWithBsRegex = /^\/\w/;
                        publicPath = endsWithBsRegex.test(publicPath) ? publicPath : publicPath + '/';
                        publicPath = startWithBsRegex.test(publicPath) ? publicPath.substr(1) : publicPath;
                    }

                    const faviconsTags = this.iconStatsCacheInfo.stats.htmls.map((tag: string) => {
                        return tag.replace(/href=\"/i, `href="${publicPath}`);
                    });

                    const optionKey = this.options.htmlPluginOptionKey || 'favicons';
                    htmlPluginArgs.plugin.options[optionKey] = faviconsTags;
                    return cb(undefined, htmlPluginArgs);
                });

        });

        compiler.plugin('make',
            (compilation: any, cb: (err?: Error, request?: any) => void) => {
                if (!this.faviconsConfig || !this.faviconsConfig.masterPicture) {
                    return cb();
                }

                const faviconsConfig = this.faviconsConfig;
                const inputFileSystem = (compiler as any).inputFileSystem;
                const cacheFilePath = outputPath ? path.resolve(outputPath, '.icons-cache') : undefined;
                const isPersistedOutFileSystem =
                    this.persistedOutputFileSystemNames.includes(compiler.outputFileSystem.constructor.name);
                const forceWriteToDisk = this.options.forceWriteToDisk && !isPersistedOutFileSystem;

                if (forceWriteToDisk && (!outputPath || outputPath === '/' || !path.isAbsolute(outputPath))) {
                    throw new InternalError(
                        `To force write to disk, absolute output path must be specified at webpack config -> output -> path.`);
                }

                this.checkAndLoadCacheInfo(faviconsConfig,
                    inputFileSystem,
                    outputPath,
                    cacheFilePath).then((fileMap) => {
                        if (this.iconStatsCacheInfo) {
                            return cb();
                        }

                        Object.keys(fileMap).forEach(p => {
                            if (!this.fileDependencies.includes(p)) {
                                this.fileDependencies.push(p);
                            }
                        });

                        this.logger.debug(`Creating child compiler`);
                        const childComplier = new ChildComplier(faviconsConfig,
                            this.options.baseDir,
                            context,
                            forceWriteToDisk as boolean,
                            compilation,
                            this.logger);

                        childComplier.compile(fileMap, isPersistedOutFileSystem, outputPath, cacheFilePath)
                            .then((iconStatsInfo: IconStatsInfo) => {
                                this.iconStatsCacheInfo = iconStatsInfo;
                                return cb();
                            })
                            .catch(err => {
                                this.iconStatsCacheInfo = null;
                                compilation.errors.push(`[${this.name}] ${err.message || err}`);
                                return cb();
                            });
                    });
            });

        compiler.plugin('after-emit', (compilation: any, cb: (err?: Error) => void) => {
            this.fileDependencies.forEach(file => {
                if (!(compilation.fileDependencies as string[]).includes(file)) {
                    compilation.fileDependencies.push(file);
                }
            });
            cb();
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

        if (!this.iconStatsCacheInfo && cacheFilePath) {
            try {
                this.logger.debug(`Reading persisted cache file`);
                this.iconStatsCacheInfo = await this.loadCacheInfo(cacheFilePath, inputFileSystem);
                this.hasPersistedCachedFile = true;
            } catch (e) {
                this.iconStatsCacheInfo = null;
                this.hasPersistedCachedFile = false;
                this.logger.warn(`Couldn't read persisted cache file, path: ${cacheFilePath}`);
            }
        }

        if (this.iconStatsCacheInfo) {
            const optionHash = generateHashDigest(JSON.stringify(faviconsConfig));
            let cacheValid = this.iconStatsCacheInfo.optionHash === optionHash;
            if (cacheValid) {
                const filesContent = JSON.stringify(fileMap);
                const filesHash = generateHashDigest(filesContent);
                cacheValid = this.iconStatsCacheInfo.filesHash === filesHash;
                if (cacheValid) {
                    this.logger.debug(`Found valid cache`);
                    return fileMap;
                }
            }

            this.logger.debug(`Invalid cache`);
            if (outputPath && cacheFilePath && this.hasPersistedCachedFile) {
                this.logger.debug(`Cleaning persisted cache`);
                await new Promise((resolve: any) => rimraf(cacheFilePath, () => resolve()));
                await Promise.all(this.iconStatsCacheInfo.stats.assets.map(assetFileName => {
                    const assetFilePath = path.resolve(outputPath, assetFileName);
                    return new Promise((resolve: any) => rimraf(assetFilePath,
                        () => resolve())
                    );
                }));
                if (this.iconStatsCacheInfo.stats.iconsPathPrefix) {
                    const iconPath = path.resolve(outputPath, this.iconStatsCacheInfo.stats.iconsPathPrefix);
                    await new Promise((resolve: any) => rimraf(iconPath,
                        () => resolve()));
                }

                this.iconStatsCacheInfo = null;
            }
        } else {
            this.logger.debug(`No persisted cache file`);
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
        this.readAllMasterPicturePaths(JSON.parse(JSON.stringify(this.faviconsConfig)),
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
                                : path.resolve(this.options.baseDir, masterPicture);
                            if (!paths.includes(masterPicturePath)) {
                                paths.push(masterPicturePath);
                            }
                        }
                    } else if (masterPicture.type === 'inline' || masterPicture.content !== undefined) {
                        if (!isBase64(masterPicture.content)) {
                            const masterPicturePath = path.isAbsolute(masterPicture.content)
                                ? path.resolve(masterPicture.content)
                                : path.resolve(this.options.baseDir, masterPicture.content);
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
        config.appName = config.appName || this.options.appName;
        config.version = config.version || this.options.appVersion;
        config.appDescription = config.appDescription || this.options.appDescription;
        config.developerUrl = config.developerUrl || this.options.developerUrl;
        config.developerName = config.developerName || this.options.developerName;
        config.lang = config.lang || this.options.lang;
    }
}
