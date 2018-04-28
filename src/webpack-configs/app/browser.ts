import * as path from 'path';

import * as webpack from 'webpack';

import { FaviconsWebpackPlugin } from '../../plugins/favicons-webpack-plugin';
import { HtmlInjectWebpackPlugin } from '../../plugins/html-inject-webpack-plugin';
import { ScriptsWebpackPlugin } from '../../plugins/scripts-webpack-plugin';
import { ServiceWorkerWebpackPlugin } from '../../plugins/service-worker-webpack-plugin';

import { AngularBuildContext, AppProjectConfigInternal, GlobalParsedEntry } from '../../build-context';
import { InternalError, InvalidConfigError } from '../../error-models';
import {
    applyProjectConfigDefaults,
    applyProjectConfigWithEnvironment,
    outputHashFormat,
    resolveLoaderPath
} from '../../helpers';
import { FaviconsConfig } from '../../interfaces';

export function
    getAppBrowserWebpackConfigPartial<TConfig extends AppProjectConfigInternal>(angularBuildContext:
        AngularBuildContext<TConfig>): webpack.Configuration {
    const logLevel = angularBuildContext.buildOptions.logLevel;

    const appConfig = angularBuildContext.projectConfig as AppProjectConfigInternal;

    // browser only
    if ((appConfig.platformTarget && appConfig.platformTarget !== 'web') ||
        (!appConfig.entry &&
            (!appConfig.polyfills || !appConfig.polyfills.length) &&
            (!appConfig.scripts || !Array.isArray(appConfig.scripts) || !appConfig.scripts.length) &&
            (!appConfig.htmlInject || !Object.keys(appConfig.htmlInject).length) &&
            !appConfig.favicons)) {
        return {};
    }

    if (!appConfig.outputPath) {
        throw new InvalidConfigError(
            `The 'projects[${appConfig.name || appConfig._index}].outputPath' value is required.`);
    }

    const projectRoot = path.resolve(AngularBuildContext.workspaceRoot, appConfig.root || '');
    const outputPath = path.resolve(AngularBuildContext.workspaceRoot, appConfig.outputPath);

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

    const entryPoints: { [key: string]: string[] } = {};
    const rules: webpack.Rule[] = [];
    const plugins: webpack.Plugin[] = [];

    // polyfills
    const tsPolyfillEntries: any[] = [];
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

        entryPoints[polyfillsChunkName] = entries;
    }

    if (tsPolyfillEntries.length > 0 && !appConfig.entry) {
        const tsConfigPath = appConfig._tsConfigPath;
        const tsLoaderOptions: { [key: string]: any } = {
            instance: `at-${appConfig.name || 'apps[' + appConfig._index + ']'}-loader`,
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
            test: /\.ts$/,
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
            .reduce((prev: GlobalParsedEntry[], curr: GlobalParsedEntry) => {
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

    // Provide plugin
    if (appConfig.entry && appConfig.provides && Object.keys(appConfig.provides).length > 0) {
        plugins.push(
            new webpack.ProvidePlugin(appConfig.provides)
        );
    }

    // service worker
    if (appConfig.serviceWorker) {
        plugins.push(
            new ServiceWorkerWebpackPlugin({
                host: angularBuildContext.host,
                workspaceRoot: AngularBuildContext.workspaceRoot,
                projectRoot: projectRoot,
                outputPath: outputPath,
                baseHref: appConfig.baseHref || ''
            })
        );
    }

    // favicons
    if (appConfig.favicons) {
        const favicons = appConfig.favicons;
        let configFilePath = '';
        let faviconsConfig: FaviconsConfig | undefined;
        if (typeof favicons === 'string') {
            configFilePath = path.resolve(projectRoot, favicons);
        } else {
            faviconsConfig = favicons as FaviconsConfig;
        }

        plugins.push(new FaviconsWebpackPlugin({
            baseDir: projectRoot,
            outputPath: outputPath,

            configFilePath: configFilePath,
            faviconsConfig: faviconsConfig,

            forceWriteToDisk: true,
            appName: appConfig._projectName,
            appVersion: appConfig._projectVersion,
            appDescription: appConfig._projectDescription,
            developerName: appConfig._projectAuthor,
            developerUrl: appConfig._projectHomePage,
            lang: appConfig.i18nLocale,

            loggerOptions: {
                logLevel: logLevel
            }
        }));
    }

    // performance options
    let performanceOptions: any = {
        hints: false
    };
    if (appConfig.performance) {
        performanceOptions = appConfig.performance;
    }

    // html inject
    if (appConfig.htmlInject && Object.keys(appConfig.htmlInject).length) {
        const SortedEntryList: string[] = [];
        // chunkSortList.push('sw-register');
        if (appConfig.referenceDll) {
            SortedEntryList.push(vendorChunkName);
        }
        SortedEntryList.push(polyfillsChunkName);

        // global styles
        if (appConfig.styles && Array.isArray(appConfig.styles) && appConfig.styles.length > 0) {
            if (!appConfig._styleParsedEntries) {
                throw new InternalError("The 'appConfig._styleParsedEntries' is not set.");
            }
            appConfig._styleParsedEntries.forEach(styleEntry => {
                if (!styleEntry.lazy && !SortedEntryList.includes(styleEntry.entry)) {
                    SortedEntryList.push(styleEntry.entry);
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
                if (!scriptEntry.lazy && !SortedEntryList.includes(scriptEntry.entry)) {
                    SortedEntryList.push(scriptEntry.entry);
                }
            });
        }
        // vendor chunk
        if (!appConfig.referenceDll) {
            SortedEntryList.push(vendorChunkName);
        }
        // main entry
        SortedEntryList.push(mainChunkName);

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

            applyProjectConfigDefaults(dllProjectConfig, dllEnvironment);

            if (dllProjectConfig.dlls &&
                ((Array.isArray(dllProjectConfig.dlls) && dllProjectConfig.dlls.length > 0) ||
                    (typeof dllProjectConfig.dlls === 'object' && Object.keys(dllProjectConfig.dlls).length > 0))) {

                dllAssetsFile = path.resolve(AngularBuildContext.workspaceRoot,
                    appConfig.outputPath,
                    `${vendorChunkName}-assets.json`);
                injectDllAssets = true;
            }
        }

        // icons
        let iconsCacheFile: string | undefined;
        let injectIcons = appConfig.htmlInject.icons;
        if (appConfig.favicons && typeof iconsCacheFile === 'undefined' && injectIcons !== false) {
            iconsCacheFile = '.icons-cache';
            injectIcons = true;
        }

        let runtimeChunkInline = appConfig.htmlInject.runtimeChunkInline;
        if (typeof runtimeChunkInline === 'undefined' && appConfig.optimization) {
            runtimeChunkInline = true;
        }

        plugins.push(new HtmlInjectWebpackPlugin({
            ...appConfig.htmlInject,
            baseDir: projectRoot,
            outDir: outputPath,
            entrypoints: SortedEntryList,
            baseHref: appConfig.baseHref,
            publicPath: appConfig.publicPath,

            runtimeChunkInline: runtimeChunkInline,

            dlls: injectDllAssets,
            dllAssetsFile: dllAssetsFile,

            icons: injectIcons,
            iconsCacheFile: iconsCacheFile,

            loggerOptions: {
                logLevel: logLevel
            }
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

    const webpackConfig: webpack.Configuration = {
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
        (webpackConfig as any).node = false;
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
                            test: (module: any, chunks: Array<{ name: string }>) => {
                                const moduleName = module.nameForCondition ? module.nameForCondition() : '';
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

    if (entryPoints && Object.keys(entryPoints).length > 0) {
        webpackConfig.entry = entryPoints;
    }

    return webpackConfig;
}
