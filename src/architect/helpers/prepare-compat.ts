// tslint:disable: no-any

import * as path from 'path';

import { normalizeEnvironment } from '../../helpers';
import { BuildOptions } from '../../models';
import { BuildOptionsInternal } from '../../models/internals';

import { AppBuilderOptions, AssetPatternObjectCompat, BuildOptionsCompat, LibBuilderOptions } from '../models';

export function getBuildOptionsFromBuilderOptions(options: BuildOptions & BuildOptionsCompat): BuildOptionsInternal {
    const buildOptions: BuildOptionsInternal = { environment: {} };

    if (options.environment) {
        const env = normalizeEnvironment(options.environment);
        buildOptions.environment = env;
        delete options.environment;
    }

    if (options.filter) {
        buildOptions.filter = options.filter;
        delete options.filter;
    }

    if (options.verbose != null) {
        if (options.verbose) {
            buildOptions.logLevel = 'debug';
        }
        delete options.verbose;
    }

    if (options.logLevel) {
        buildOptions.logLevel = options.logLevel;
        delete options.logLevel;
    }

    if (options.progress != null) {
        if (options.progress) {
            buildOptions.progress = true;
        }
        delete options.progress;
    }

    if (options.poll != null) {
        buildOptions.watchOptions = {
            poll: options.poll
        };
        delete options.poll;
    }

    if (options.cleanOutDir != null) {
        if (options.cleanOutDir) {
            buildOptions.cleanOutDir = true;
        }
        delete options.cleanOutDir;
    }

    if (options.watch != null) {
        if (options.watch) {
            buildOptions.watch = true;
        }
        delete options.watch;
    }

    if (options.watchOptions) {
        buildOptions.watchOptions = { ...options.watchOptions };
        delete options.watchOptions;
    }

    if (options.beep != null) {
        if (options.beep) {
            buildOptions.beep = true;
        }
        delete options.beep;
    }

    return buildOptions;
}

// tslint:disable-next-line: max-func-body-length
export function applyAppBuilderOptionsCompat(appConfig: AppBuilderOptions): void {
    if (appConfig.target && !appConfig.platformTarget) {
        appConfig.platformTarget = appConfig.target as ('web' | 'node');
        delete appConfig.target;
    }
    if (appConfig.platform && !appConfig.platformTarget) {
        appConfig.platformTarget = appConfig.platform === 'server' ? 'node' : 'web';
        delete appConfig.platform;
    }
    if (appConfig.outDir && !appConfig.outputPath) {
        appConfig.outputPath = appConfig.outDir;
        delete appConfig.outDir;
    }
    if (appConfig.main && !appConfig.entry) {
        appConfig.entry = appConfig.main;
        delete appConfig.main;
    }
    if (appConfig.index && !appConfig.htmlInject) {
        appConfig.htmlInject = {
            index: appConfig.index
        };
        delete appConfig.index;
    }
    if (appConfig.evalSourceMap && !appConfig.sourceMapDevTool) {
        appConfig.sourceMapDevTool = 'eval';
        delete appConfig.evalSourceMap;
    }
    if (appConfig.deployUrl && !appConfig.publicPath) {
        appConfig.publicPath = appConfig.deployUrl;
        delete appConfig.deployUrl;
    }
    if (appConfig.assets &&
        Array.isArray(appConfig.assets) &&
        (!appConfig.copy || (Array.isArray(appConfig.copy) && !appConfig.copy.length))) {
        appConfig.copy = appConfig.assets.map((assetEntry: string | AssetPatternObjectCompat) => {
            if (typeof assetEntry === 'string') {
                return assetEntry;
            }

            return {
                from: path.join(assetEntry.input, assetEntry.glob || ''),
                to: assetEntry.output,
                exclude: assetEntry.ignore
            };
        });
        delete appConfig.assets;
    }
    if (appConfig.deleteOutputPath && !appConfig.clean) {
        appConfig.clean = {
            beforeBuild: {
                cleanOutDir: true
            }
        };
        delete appConfig.deleteOutputPath;
    }
    if (appConfig.statsJson && !appConfig.bundleAnalyzer) {
        appConfig.bundleAnalyzer = {
            generateStatsFile: true
        };
        delete appConfig.statsJson;
    }
    if (appConfig.bundleDependencies && appConfig.bundleDependencies === 'none') {
        appConfig.nodeModulesAsExternals = true;
        const externals = [
            /^@angular/,
            (_: any, request: any, callback: (error?: any, result?: any) => void) => {
                // Absolute & Relative paths are not externals
                // tslint:disable-next-line: no-unsafe-any
                if (request.match(/^\.{0,2}\//)) {
                    callback();

                    return;
                }

                try {
                    // Attempt to resolve the module via Node
                    // tslint:disable-next-line: no-unsafe-any
                    const e = require.resolve(request);
                    if (/node_modules/.test(e)) {
                        // It's a node_module
                        callback(null, request);
                    } else {
                        // It's a system thing (.ie util, fs...)
                        callback();
                    }
                } catch (e) {
                    // Node couldn't find it, so it must be user-aliased
                    callback();
                }
            }
        ];
        if (!appConfig.externals) {
            appConfig.externals = externals as any;
        } else {
            if (Array.isArray(appConfig.externals)) {
                appConfig.externals = [...(appConfig.externals as any[]), ...externals];
            } else {
                appConfig.externals = [appConfig.externals as any, ...externals];
            }
        }
        delete appConfig.bundleDependencies;
    }
}

export function applyLibBuilderOptionsCompat(libConfig: LibBuilderOptions): void {
    if (libConfig.target && !libConfig.platformTarget) {
        libConfig.platformTarget = libConfig.target as ('web' | 'node');
        delete libConfig.target;
    }

    if (libConfig.platform && !libConfig.platformTarget) {
        libConfig.platformTarget = libConfig.platform === 'server' ? 'node' : 'web';
        delete libConfig.platform;
    }

    if (libConfig.outDir && !libConfig.outputPath) {
        libConfig.outputPath = libConfig.outDir;
        delete libConfig.outDir;
    }

    if (libConfig.assets &&
        Array.isArray(libConfig.assets) &&
        (!libConfig.copy || (Array.isArray(libConfig.copy) && !libConfig.copy.length))) {
        libConfig.copy = libConfig.assets.map(assetEntry => {
            if (typeof assetEntry === 'string') {
                return assetEntry;
            }

            return {
                from: path.join(assetEntry.input, assetEntry.glob || ''),
                to: assetEntry.output,
                exclude: assetEntry.ignore
            };
        });
        delete libConfig.assets;
    }

    if (libConfig.deleteOutputPath && !libConfig.clean) {
        libConfig.clean = {
            beforeBuild: {
                cleanOutDir: true
            }
        };
        delete libConfig.deleteOutputPath;
    }

    if (libConfig.bundleDependencies && libConfig.bundleDependencies === 'all') {
        libConfig.nodeModulesAsExternals = false;
    }
}
