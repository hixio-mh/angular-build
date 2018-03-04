import * as path from 'path';

import * as webpack from 'webpack';

import { FaviconsWebpackPlugin } from '../../plugins/favicons-webpack-plugin';
import { HtmlInjectWebpackPlugin } from '../../plugins/html-inject-webpack-plugin';
import { ScriptsWebpackPlugin } from '../../plugins/scripts-webpack-plugin';

import {
    AngularBuildContext,
    AppProjectConfigInternal,
    FaviconsConfig,
    GlobalParsedEntry,
    InternalError,
    InvalidConfigError
} from '../../models';

import { outputHashFormat } from '../../helpers/output-hash-format';
import { applyProjectConfigDefaults, applyProjectConfigWithEnvOverrides } from '../../helpers/prepare-configs';

export function getAppBrowserWebpackConfigPartial(angularBuildContext: AngularBuildContext): any {
    const environment = AngularBuildContext.environment;
    if (environment.dll) {
        return {};
    }

    const appConfig = angularBuildContext.projectConfig as AppProjectConfigInternal;

    // browser only
    if ((appConfig.platformTarget && appConfig.platformTarget !== 'web') ||
        (!appConfig.entry &&
            (!appConfig.polyfills || !appConfig.polyfills.length) &&
            (!appConfig.scripts || !appConfig.scripts.length) &&
            (!appConfig.htmlInject || !Object.keys(appConfig.htmlInject).length) &&
            !appConfig.favicons)) {
        return {};
    }

    if (!appConfig.outDir) {
        throw new InvalidConfigError(
            `The 'apps[${angularBuildContext.projectConfig._index
            }].outDir' value is required.`);
    }

    const polyfillsChunkName = appConfig.polyfillsChunkName || 'polyfills';
    const vendorChunkName = appConfig.vendorChunkName || 'vendor';
    const mainChunkName = appConfig.mainChunkName || 'main';

    const projectRoot = AngularBuildContext.projectRoot;
    const srcDir = path.resolve(projectRoot, appConfig.srcDir || '');
    const outDir = path.resolve(projectRoot, appConfig.outDir);

    const bundleHashFormat = (!appConfig.platformTarget || appConfig.platformTarget === 'web') &&
        appConfig.bundlesHash
        ? outputHashFormat.bundle
        : '';

    const entryPoints: { [key: string]: string[] } = {};
    const rules: webpack.Rule[] = [];
    const plugins: webpack.Plugin[] = [];
    const resolvePlugins: webpack.Plugin[] = [];

    // polyfills
    const tsEntries: any[] = [];
    if (appConfig.polyfills && appConfig.polyfills.length > 0) {
        if (!appConfig._polyfillParsedResult) {
            throw new InternalError("The 'appConfig._polyfillParsedResult' is not set.");
        }
        const polyfillResult = appConfig._polyfillParsedResult;

        const entries: string[] = [];
        polyfillResult.tsEntries.forEach(tsEntry => {
            if (!tsEntries.includes(tsEntry)) {
                tsEntries.push(tsEntry);
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

    if (tsEntries.length > 0 && !appConfig.entry) {
        const tsConfigPath = appConfig._tsConfigPath;
        rules.push({
            test: /\.ts$/,
            use: [
                {
                    loader: 'awesome-typescript-loader',
                    options: {
                        instance: `at-${appConfig.name || 'apps[' + appConfig._index + ']'}-loader`,
                        configFileName: tsConfigPath,
                        silent: true
                    }
                }
            ],
            include: tsEntries
        });

        // `CheckerPlugin` is optional. Use it if you want async error reporting.
        // We need this plugin to detect a `--watch` mode. It may be removed later
        // after https://github.com/webpack/webpack/issues/3460 will be resolved.
        const { CheckerPlugin, TsConfigPathsPlugin } = require('awesome-typescript-loader');
        plugins.push(new CheckerPlugin());

        if (tsConfigPath) {
            resolvePlugins.push(new TsConfigPathsPlugin(tsConfigPath));
        }
    }

    // global scripts
    if (appConfig.scripts && appConfig.scripts.length > 0) {
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
                filename: `${script.entry}${hash}.js`,
                scripts: script.paths,
                context: projectRoot,
            }));
        });
    }

    // Provide plugin
    if (appConfig.entry && appConfig.provides && Object.keys(appConfig.provides).length > 0) {
        plugins.push(
            new webpack.ProvidePlugin(appConfig.provides)
        );
    }

    // favicons
    if (appConfig.favicons) {
        const favicons = appConfig.favicons;
        let configFilePath = '';
        let faviconsConfig: FaviconsConfig | undefined;
        if (typeof favicons === 'string') {
            configFilePath = path.resolve(srcDir, favicons);
        } else {
            faviconsConfig = favicons as FaviconsConfig;
        }

        plugins.push(new FaviconsWebpackPlugin({
            srcDir: srcDir,
            outputPath: outDir,

            configFilePath: configFilePath,
            faviconsConfig: faviconsConfig,

            forceWriteToDisk: true,
            appName: angularBuildContext.projectName,
            appVersion: angularBuildContext.projectVersion,
            appDescription: angularBuildContext.projectDescription,
            developerName: angularBuildContext.projectAuthor,
            developerUrl: angularBuildContext.projectHomePage,
            lang: appConfig.locale,

            loggerOptions: {
                logLevel: AngularBuildContext.angularBuildConfig.logLevel
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

    let vendorChunk = appConfig.vendorChunk;
    if (typeof vendorChunk === 'undefined') {
        vendorChunk = !appConfig.referenceDll && !AngularBuildContext.isProductionMode;
    }

    // html inject
    if (appConfig.htmlInject && Object.keys(appConfig.htmlInject).length) {
        const chunkSortList: string[] = [];
        // chunkSortList.push('sw-register');
        if (appConfig.referenceDll) {
            chunkSortList.push(vendorChunkName);
        }
        chunkSortList.push(polyfillsChunkName);

        // global styles
        if (appConfig.styles && appConfig.styles.length > 0) {
            if (!appConfig._styleParsedEntries) {
                throw new InternalError("The 'appConfig._styleParsedEntries' is not set.");
            }
            appConfig._styleParsedEntries.forEach(styleEntry => {
                if (!styleEntry.lazy && !chunkSortList.includes(styleEntry.entry)) {
                    chunkSortList.push(styleEntry.entry);
                }
            });
        }
        // global scripts
        if (appConfig.scripts && appConfig.scripts.length > 0) {
            if (!appConfig._scriptParsedEntries) {
                throw new InternalError("The 'appConfig._scriptParsedEntries' is not set.");
            }

            const scriptParsedEntries = appConfig._scriptParsedEntries;
            scriptParsedEntries.forEach(scriptEntry => {
                if (!scriptEntry.lazy && !chunkSortList.includes(scriptEntry.entry)) {
                    chunkSortList.push(scriptEntry.entry);
                }
            });
        }
        // vendor chunk
        if (!appConfig.referenceDll) {
            chunkSortList.push(vendorChunkName);
        }
        // main entry
        chunkSortList.push(mainChunkName);

        // dll assets
        let dllAssetsFile: string | undefined;
        let iconsCacheFile: string | undefined;
        let injectDllAssets = appConfig.htmlInject.dlls;
        let injectIcons = appConfig.htmlInject.icons;
        if (appConfig.referenceDll && appConfig.entry && injectDllAssets !== false) {
            const dllEnvironment = { dll: true };
            const dllProjectConfig =
                JSON.parse(JSON.stringify(angularBuildContext.projectConfigMaster)) as AppProjectConfigInternal;
            applyProjectConfigWithEnvOverrides(dllProjectConfig, dllEnvironment);
            applyProjectConfigDefaults(projectRoot,
                dllProjectConfig,
                dllEnvironment,
                AngularBuildContext.isProductionMode,
                AngularBuildContext.commandOptions || {});

            if (dllProjectConfig.dll &&
                ((Array.isArray(dllProjectConfig.dll) && dllProjectConfig.dll.length > 0) ||
                    (typeof dllProjectConfig.dll === 'object' && Object.keys(dllProjectConfig.dll).length > 0))) {

                dllAssetsFile = path.resolve(projectRoot, appConfig.outDir, `${vendorChunkName}-assets.json`);
                injectDllAssets = true;

            }

            // icons
            if (typeof iconsCacheFile === 'undefined' && dllProjectConfig.favicons) {
                iconsCacheFile = path.resolve(projectRoot, appConfig.outDir, '.icons-cache');

                if (typeof injectIcons === 'undefined') {
                    injectIcons = true;
                }
            }
        }

        // icons
        if (typeof iconsCacheFile === 'undefined' && appConfig.favicons && injectIcons !== false) {
            iconsCacheFile = '.icons-cache';
            injectIcons = true;
        }

        appConfig.htmlInject = appConfig.htmlInject || {};

        plugins.push(new HtmlInjectWebpackPlugin({
            ...appConfig.htmlInject,
            srcDir: srcDir,
            outDir: outDir,
            entrypoints: chunkSortList,
            baseHref: appConfig.baseHref,
            publicPath: appConfig.publicPath,

            dlls: injectDllAssets,
            icons: injectIcons,
            dllAssetsFile: dllAssetsFile,
            iconsCacheFile: iconsCacheFile,

            loggerOptions: {
                logLevel: AngularBuildContext.angularBuildConfig.logLevel
            }
        }));
    }

    const styleEntryNames: string[] = [];
    if (appConfig.styles && appConfig.styles.length > 0) {
        if (!appConfig._styleParsedEntries) {
            throw new InternalError("The 'appConfig._styleParsedEntries' is not set.");
        }
        appConfig._styleParsedEntries.forEach(styleEntry => {
            styleEntryNames.push(styleEntry.entry);
        });
    }

    const webpackConfig = {
        module: {
            rules: rules
        },
        plugins: plugins,
        performance: performanceOptions,
        output: {
            publicPath: appConfig.publicPath || '/'
        },
        node: appConfig.environmentVariables
            ? {
                process: true, // default: true
                global: true, // default: true
                fs: 'empty', // default: 'empty'
                crypto: 'empty',
                tls: 'empty',
                net: 'empty',
                module: false,
                clearImmediate: false,
                setImmediate: false, // default: true
            }
            : false
    };

    if (!appConfig.entry && tsEntries.length > 0 && resolvePlugins.length > 0) {
        (webpackConfig as any).resolve = {
            extensions: ['.ts', '.js'],
            plugins: resolvePlugins
        };
    }

    if (appConfig.entry) {
        (webpackConfig as any).optimization = {
            runtimeChunk: 'single',
            splitChunks: {
                chunks: appConfig.commonChunk ? 'all' : 'initial',
                cacheGroups: {
                    vendors: false,
                    vendor: vendorChunk ?
                        {
                            name: vendorChunkName,
                            chunks: 'initial',
                            test: (module: any, chunks: Array<{ name: string }>) => {
                                const moduleName = module.nameForCondition ? module.nameForCondition() : '';
                                return /[\\/]node_modules[\\/]/.test(moduleName) &&
                                    !chunks.some(
                                        ({ name }) => name === polyfillsChunkName || styleEntryNames.includes(name));
                            },
                        } : false,
                }
            }
        };
    }


    if (entryPoints && Object.keys(entryPoints).length > 0) {
        (webpackConfig as any).entry = entryPoints;
    }

    return webpackConfig;
}
