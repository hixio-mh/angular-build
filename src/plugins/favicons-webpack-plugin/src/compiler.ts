import * as path from 'path';

import { ensureDir, writeFile } from 'fs-extra';
import * as loaderUtils from 'loader-utils';
import * as webpack from 'webpack';

const NodeTargetPlugin = require('webpack/lib/node/NodeTargetPlugin');

import { FaviconsConfig } from '../../../models';
import { generateHashDigest, Logger } from '../../../utils';

import { IconStatsInfo, IconStatsJson } from './internal-models';
import { IconGenerator, IconFileInfo, IconGenerateResult } from './icon-generator';

export class ChildComplier {
    private iconStatsInfo: IconStatsInfo;

    constructor(private readonly faviconsConfig: FaviconsConfig,
        private readonly baseDir: string,
        private readonly context: string,
        private readonly forceWriteToDisk: boolean,
        private readonly parentCompilation: any,
        private readonly logger: Logger) { }

    compile(masterPictureFilesMap: { [key: string]: Buffer },
        isPersistedOutFileSystem: boolean,
        outputPath?: string,
        cacheFilePath?: string): Promise<IconStatsInfo> {
        const parentOutputOptions = (this.parentCompilation.outputOptions || {}) as webpack.Output;
        const outputOptions = {
            publicPath: parentOutputOptions.publicPath || ''
        };

        const compilerName = this.getCompilerName(this.context, 'favicon.ico');
        const childCompiler = this.parentCompilation.createChildCompiler(compilerName, outputOptions);
        childCompiler.context = this.context;
        childCompiler.options.context = this.context;

        childCompiler.apply(
            new NodeTargetPlugin()
        );

        childCompiler.plugin('compilation',
            (childCompilation: any) => {
                // Fix for "Uncaught TypeError: __webpack_require__(...) is not a function"
                // Hot module replacement requires that every child compiler has its own
                // cache. @see https://github.com/ampedandwired/html-webpack-plugin/pull/179
                if (childCompilation.cache) {
                    if (!childCompilation.cache[compilerName]) {
                        childCompilation.cache[compilerName] = {};
                    }
                    childCompilation.cache = childCompilation.cache[compilerName];
                }

                childCompilation.plugin('additional-assets',
                    (cb: (err?: Error) => void) => {
                        this.generateIcons(childCompilation,
                                masterPictureFilesMap,
                                isPersistedOutFileSystem,
                                outputPath,
                                cacheFilePath)
                            .then(iconStatsInfo => {
                                this.iconStatsInfo = iconStatsInfo;
                                cb();
                            })
                            .catch(cb);
                    });
            });

        return new Promise<IconStatsInfo>((resolve, reject) => {
            childCompiler.runAsChild((err: Error, entries: any[], childCompilation: any) => {
                if (childCompilation && childCompilation.errors && childCompilation.errors.length) {
                    const errorDetails = childCompilation.errors
                        .map((error: any) => error.message + (error.error ? `:\n${error.error}` : '')).join('\n');
                    return reject(new Error(errorDetails));
                } else if (err) {
                    return reject(err);
                } else {
                    return resolve(this.iconStatsInfo);
                }
            });
        });
    }

    private async generateIcons(compilation: any,
        masterPictureFilesMap: { [key: string]: Buffer },
        isPersistedOutFileSystem: boolean,
        outputPath?: string,
        cacheFilePath?: string): Promise<IconStatsInfo> {
        const optionHash = generateHashDigest(JSON.stringify(this.faviconsConfig));
        const filesContent = JSON.stringify(masterPictureFilesMap);
        const filesHash = generateHashDigest(filesContent);
        const forceWriteToDisk = this.forceWriteToDisk && !isPersistedOutFileSystem;

        let iconsPathPrefix = this.faviconsConfig.iconsPath || '';
        if (iconsPathPrefix) {
            iconsPathPrefix = /\/$/.test(iconsPathPrefix) ? iconsPathPrefix : iconsPathPrefix + '/';
            let iconsPathRelative =
                path.join(path.relative(this.context, this.baseDir), iconsPathPrefix);
            // a Hack because loaderUtils.interpolateName doesn't
            // find the right path if no directory is defined
            // ie. [path] applied to 'file.txt' would return 'file'
            if (iconsPathRelative.indexOf(path.sep) < 0) {
                iconsPathRelative = path.sep + iconsPathRelative;
            }
            iconsPathPrefix = loaderUtils.interpolateName(
                { resourcePath: iconsPathRelative } as any,
                iconsPathPrefix,
                {
                    context: this.context,
                    content: JSON.stringify(masterPictureFilesMap)
                });
        }

        let iconGenerateResult: IconGenerateResult | null = null;
        const iconsGenerator = new IconGenerator(this.faviconsConfig,
            this.baseDir,
            masterPictureFilesMap,
            iconsPathPrefix,
            this.logger);

        if (this.faviconsConfig.online) {
            try {
                iconGenerateResult = await iconsGenerator.generateRfgOnline();
            } catch (err) {
                if (!this.faviconsConfig.fallbackOffline) {
                    throw err;
                } else {
                    this.logger.warn(
                        `Error in generating icons from online, Error details: ${
                        err.message || err}`);
                }
            }

            if (!iconGenerateResult) {
                iconGenerateResult = await iconsGenerator.generateOffline(true);
            }
        } else {
            iconGenerateResult = await iconsGenerator.generateOffline();
        }

        if (!iconGenerateResult) {
            throw new Error('Error in generating icons');
        }

        const generatedResult = iconGenerateResult as IconGenerateResult;
        const newIconStatsJson: IconStatsJson = {
            iconsPathPrefix: iconsPathPrefix,
            assets: [],
            htmls: generatedResult.htmls.slice(0)
        };

        if (forceWriteToDisk && outputPath) {
            await ensureDir(outputPath);

            if (iconsPathPrefix) {
                await ensureDir(path.resolve(outputPath, iconsPathPrefix));
            }
        }

        await Promise.all(iconGenerateResult.files.map(async (file: IconFileInfo) => {
            if (this.faviconsConfig.emitFaviconIcoToOutDirRoot !== false &&
                file.name === 'favicon.ico' &&
                iconsPathPrefix &&
                iconsPathPrefix !== '/') {
                newIconStatsJson.assets.push(file.name);

                if (forceWriteToDisk && outputPath) {
                    await writeFile(path.resolve(outputPath, file.name), file.content);
                }

                compilation.assets[file.name] = {
                    source(): any {
                        return file.content;
                    },
                    size(): number {
                        return file.content.length;
                    }
                };
            }

            const fileNameWithIconPath = path.join(iconsPathPrefix || '', file.name).replace(/\\/g, '/');

            newIconStatsJson.assets.push(fileNameWithIconPath);

            if (forceWriteToDisk && outputPath) {
                await writeFile(path.resolve(outputPath, fileNameWithIconPath), file.content);
            }

            compilation.assets[fileNameWithIconPath] = {
                source(): any {
                    return file.content;
                },
                size(): number {
                    return file.content.length;
                }
            };
        }));

        // Emit cache file
        const statsInfo: IconStatsInfo = {
            filesHash: filesHash,
            optionHash: optionHash,
            stats: newIconStatsJson
        };

        if (this.faviconsConfig.cache !== false &&
            cacheFilePath &&
            outputPath &&
            (isPersistedOutFileSystem || forceWriteToDisk)) {
            const iconCacheInfoString = JSON.stringify(statsInfo, null, 2);
            const cacheFileRelative = path.relative(outputPath, cacheFilePath);

            if (forceWriteToDisk) {
                await writeFile(cacheFilePath, iconCacheInfoString);
            }

            compilation.assets[cacheFileRelative] = {
                source(): any {
                    return iconCacheInfoString;
                },
                size(): number {
                    return iconCacheInfoString.length;
                }
            };
        }

        return statsInfo;
    }

    private getCompilerName(context: string, filename: string): string {
        const absolutePath = path.resolve(context, filename);
        const relativePath = path.relative(context, absolutePath);
        return `favicons-webpack-plugin for "${absolutePath.length < relativePath.length ? absolutePath : relativePath
            }"`;
    }
}
