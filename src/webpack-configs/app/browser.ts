// tslint:disable:no-any
// tslint:disable:no-unsafe-any

import * as path from 'path';

import { Configuration, Options, Plugin, RuleSetRule } from 'webpack';

import { HtmlInjectWebpackPlugin } from '../../plugins/html-inject-webpack-plugin';
import { ScriptsWebpackPlugin } from '../../plugins/scripts-webpack-plugin';
import { ServiceWorkerWebpackPlugin } from '../../plugins/service-worker-webpack-plugin';

import { AngularBuildContext } from '../../build-context';
import {
    applyProjectConfigWithEnvironment,
    outputHashFormat,
    resolveLoaderPath
} from '../../helpers';
import { InternalError } from '../../models/errors';
import { AppProjectConfigInternal, GlobalScriptStyleParsedEntry } from '../../models/internals';

// tslint:disable:max-func-body-length
export function getAppBrowserWebpackConfigPartial(angularBuildContext: AngularBuildContext<AppProjectConfigInternal>): Configuration {
    const logLevel = angularBuildContext.buildOptions.logLevel;
    const appConfig = angularBuildContext.projectConfig;

    if (!appConfig._projectRoot) {
        throw new InternalError("The 'appConfig._projectRoot' is not set.");
    }

    if (!appConfig._outputPath) {
        throw new InternalError("The 'appConfig._outputPath' is not set.");
    }

    // browser only
    if ((appConfig.platformTarget && appConfig.platformTarget !== 'web') ||
        (!appConfig.entry &&
            (!appConfig.polyfills || !appConfig.polyfills.length) &&
            (!appConfig.scripts || !Array.isArray(appConfig.scripts) || !appConfig.scripts.length) &&
            (!appConfig.htmlInject || !Object.keys(appConfig.htmlInject).length))) {
        return {};
    }

    const projectRoot = appConfig._projectRoot;
    const outputPath = appConfig._outputPath;

    const polyfillsChunkName = appConfig.polyfillsChunkName || 'polyfills';
    const vendorChunkName = appConfig.vendorChunkName || 'vendor';
    const mainChunkName = appConfig.mainChunkName || 'main';

    const bundleHashFormat = (!appConfig.platformTarget || appConfig.platformTarget === 'web') &&
        appConfig._outputHashing &&
        appConfig._outputHashing.bundles
        ? outputHashFormat.chunk
        : '';

    // const chunksHashFormat = (!appConfig.platformTarget || appConfig.platformTarget === 'web') &&
    //    appConfig._outputHashing &&
    //    appConfig._outputHashing.chunks
    //    ? outputHashFormat.chunk
    //    : '';

    const entrypoints: { [key: string]: string[] } = {};
    const rules: RuleSetRule[] = [];
    const plugins: Plugin[] = [];

    // polyfills
    const tsPolyfillEntries: string[] = [];
    if (appConfig.polyfills && appConfig.polyfills.length > 0) {
        if (!appConfig._polyfillParsedResult) {
            throw new InternalError("The 'appConfig._polyfillParsedResult' is not set.");
        }
        const polyfillResult = appConfig._polyfillParsedResult;

        const entries: string[] = [];
        polyfillResult.tsEntries.forEach(tsEntry => {
            if (!tsPolyfillEntries.includes(tsEntry)) {
                tsPolyfillEntries.push(tsEntry);
            }
            if (!entries.includes(tsEntry)) {
                entries.push(tsEntry);
            }
        });
        polyfillResult.scriptEntries.forEach(scriptEntry => {
            if (!entries.includes(scriptEntry)) {
                entries.push(scriptEntry);
            }
        });

        entrypoints[polyfillsChunkName] = entries;
    }

    if (tsPolyfillEntries.length > 0 && !appConfig.entry) {
        const tsConfigPath = appConfig._tsConfigPath;
        const tsLoaderOptions: { [key: string]: string | boolean } = {
            // tslint:disable-next-line:prefer-template
            instance: `at-${appConfig.name || 'apps[' + (appConfig._index as number).toString() + ']'}-loader`,
            transpileOnly: appConfig.tsConfig ? false : true,
            onlyCompileBundledFiles: appConfig.tsConfig ? false : true,
            silent: logLevel !== 'debug'
        };

        if (appConfig.tsConfig && tsConfigPath) {
            tsLoaderOptions.configFile = tsConfigPath;
        }
        if (logLevel) {
            tsLoaderOptions.logLevel = logLevel;
        }

        const tsLoader = resolveLoaderPath('ts-loader');

        rules.push({
            test: /\.tsx?$/,
            use: [
                {
                    loader: tsLoader,
                    options: tsLoaderOptions
                }
            ],
            include: tsPolyfillEntries
        });
    }

    // global scripts
    if (appConfig.scripts && Array.isArray(appConfig.scripts) && appConfig.scripts.length > 0) {
        if (!appConfig._scriptParsedEntries) {
            throw new InternalError("The 'appConfig._scriptParsedEntries' is not set.");
        }
        const parsedEntries = appConfig._scriptParsedEntries;
        const globalScriptsByEntry = parsedEntries
            .reduce((prev: GlobalScriptStyleParsedEntry[], curr: GlobalScriptStyleParsedEntry) => {
                const existingEntry = prev.find((el) => el.entry === curr.entry);
                if (existingEntry) {
                    existingEntry.paths.push(...curr.paths);
                    existingEntry.lazy = existingEntry.lazy && curr.lazy;
                } else {
                    prev.push({
                        entry: curr.entry,
                        paths: curr.paths,
                        lazy: curr.lazy
                    });
                }

                return prev;
            },
                []);

        // Add a new asset for each entry.
        globalScriptsByEntry.forEach((script) => {
            // Lazy scripts don't get a hash, otherwise they can't be loaded by name.
            const hash = script.lazy ? '' : bundleHashFormat;
            plugins.push(new ScriptsWebpackPlugin({
                name: script.entry,
                sourceMap: appConfig.sourceMap,
                filename: `${path.basename(script.entry)}${hash}.js`,
                scripts: script.paths,
                basePath: projectRoot,
            }));
        });
    }

    // service worker
    if (appConfig.serviceWorker) {
        plugins.push(
            new ServiceWorkerWebpackPlugin({
                host: angularBuildContext.host,
                workspaceRoot: AngularBuildContext.workspaceRoot,
                projectRoot: projectRoot,
                outputPath: outputPath,
                baseHref: appConfig.baseHref || '/',
                ngswConfigPath: appConfig.ngswConfigPath
            })
        );
    }

    // performance options
    let performanceOptions: Options.Performance;
    if (appConfig.performance) {
        performanceOptions = appConfig.performance as Options.Performance;
    } else {
        performanceOptions = {
            hints: false
        };
    }

    // html inject
    if (appConfig.htmlInject && Object.keys(appConfig.htmlInject).length) {
        const sortedEntryList: string[] = [];
        // chunkSortList.push('sw-register');
        if (appConfig.referenceDll) {
            sortedEntryList.push(vendorChunkName);
        }
        sortedEntryList.push(polyfillsChunkName);

        // global styles
        if (appConfig.styles && Array.isArray(appConfig.styles) && appConfig.styles.length > 0) {
            if (!appConfig._styleParsedEntries) {
                throw new InternalError("The 'appConfig._styleParsedEntries' is not set.");
            }
            appConfig._styleParsedEntries.forEach(styleEntry => {
                if (!styleEntry.lazy && !sortedEntryList.includes(styleEntry.entry)) {
                    sortedEntryList.push(styleEntry.entry);
                }
            });
        }
        // global scripts
        if (appConfig.scripts && Array.isArray(appConfig.scripts) && appConfig.scripts.length > 0) {
            if (!appConfig._scriptParsedEntries) {
                throw new InternalError("The 'appConfig._scriptParsedEntries' is not set.");
            }

            const scriptParsedEntries = appConfig._scriptParsedEntries;
            scriptParsedEntries.forEach(scriptEntry => {
                if (!scriptEntry.lazy && !sortedEntryList.includes(scriptEntry.entry)) {
                    sortedEntryList.push(scriptEntry.entry);
                }
            });
        }
        // vendor chunk
        if (!appConfig.referenceDll) {
            sortedEntryList.push(vendorChunkName);
        }

        // main entry
        sortedEntryList.push(mainChunkName);

        // dll assets
        let dllAssetsFile: string | undefined;
        let injectDllAssets = appConfig.htmlInject.dlls;
        if (appConfig.referenceDll && appConfig.entry && injectDllAssets !== false) {
            const dllEnvironment = { ...angularBuildContext.buildOptions.environment };
            dllEnvironment.dll = true;
            if (dllEnvironment.aot) {
                dllEnvironment.aot = false;
            }
            const dllProjectConfig =
                JSON.parse(JSON.stringify(angularBuildContext.projectConfigWithoutEnvApplied)) as
                AppProjectConfigInternal;

            applyProjectConfigWithEnvironment(dllProjectConfig, dllEnvironment);
            dllProjectConfig._isDll = true;

            if (dllProjectConfig.vendors && dllProjectConfig.vendors.length > 0) {
                dllAssetsFile = path.resolve(outputPath,
                    `${vendorChunkName}-assets.json`);
                injectDllAssets = true;
            }
        }

        let runtimeChunkInline = appConfig.htmlInject.runtimeChunkInline;
        if (runtimeChunkInline == null && appConfig.optimization) {
            runtimeChunkInline = true;
        }

        plugins.push(new HtmlInjectWebpackPlugin({
            ...appConfig.htmlInject,
            baseDir: projectRoot,
            outDir: outputPath,
            entrypoints: sortedEntryList,
            baseHref: appConfig.baseHref,
            publicPath: appConfig.publicPath,
            runtimeChunkInline: runtimeChunkInline,
            dlls: injectDllAssets,
            dllAssetsFile: dllAssetsFile,
            logLevel: logLevel
        }));
    }

    const styleEntryNames: string[] = [];
    if (appConfig.styles && Array.isArray(appConfig.styles) && appConfig.styles.length > 0) {
        if (!appConfig._styleParsedEntries) {
            throw new InternalError("The 'appConfig._styleParsedEntries' is not set.");
        }
        appConfig._styleParsedEntries.forEach(styleEntry => {
            styleEntryNames.push(styleEntry.entry);
        });
    }

    const webpackConfig: Configuration = {
        module: {
            rules: rules
        },
        plugins: plugins,
        performance: performanceOptions,
        output: {
            publicPath: appConfig.publicPath || '/',
            // chunkFilename: `[id]${chunksHashFormat}.chunk.js`
        }
    };

    if (appConfig.environmentVariables) {
        webpackConfig.node = {
            process: true, // default: true
            global: true, // default: true
            fs: 'empty', // default: 'empty'
            crypto: 'empty',
            tls: 'empty',
            net: 'empty',
            module: false,
            clearImmediate: false,
            setImmediate: false, // default: true
        };
    } else {
        webpackConfig.node = false;
    }

    if (!appConfig.entry && tsPolyfillEntries.length > 0) {
        webpackConfig.resolve = {
            extensions: ['.ts', '.js']
        };
    }

    if (appConfig.entry) {
        webpackConfig.optimization = {
            runtimeChunk: 'single',
            splitChunks: {
                maxAsyncRequests: Infinity,
                cacheGroups: {
                    default: appConfig.commonChunk
                        ? {
                            chunks: 'async',
                            minChunks: 2,
                            priority: 10,
                        }
                        : false,
                    common: appConfig.commonChunk
                        ? {
                            name: 'common',
                            chunks: 'async',
                            minChunks: 2,
                            enforce: true,
                            priority: 5,
                        }
                        : false,
                    vendors: false,
                    vendor: appConfig.vendorChunk
                        ? {
                            name: vendorChunkName,
                            chunks: 'initial',
                            enforce: true,
                            test: (mod: any, chunks: { name: string }[]) => {
                                const moduleName = mod.nameForCondition ? mod.nameForCondition() : '';

                                return /[\\/]node_modules[\\/]/.test(moduleName) &&
                                    !chunks.some(
                                        ({ name }) => name === polyfillsChunkName || styleEntryNames.includes(name));
                            },
                        }
                        : false,
                } as any
            }
        };
    }

    if (entrypoints && Object.keys(entrypoints).length > 0) {
        webpackConfig.entry = entrypoints;
    }

    return webpackConfig;
}
