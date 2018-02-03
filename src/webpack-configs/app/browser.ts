import * as path from 'path';

import * as webpack from 'webpack';

import * as HtmlWebpackPlugin from 'html-webpack-plugin';

import { AddAssetsHtmlWebpckPlugin } from '../../plugins/add-assets-html-webpack-plugin';
import { BaseHrefHtmlWebpackPlugin } from '../../plugins/base-href-html-webpack-plugin';
import { CustomizeAssetsHtmlWebpackPlugin } from '../../plugins/customize-assets-html-webpack-plugin';
import { FaviconsWebpackPlugin } from '../../plugins/favicons-webpack-plugin';
import { ResourceHintsHtmlWebpackPlugin } from '../../plugins/resource-hints-html-webpack-plugin';
import { ScriptsConcatWebpackPlugin } from '../../plugins/script-concat-webpack-plugin';

import {
    AppBuildContext,
    AppProjectConfigInternal,
    FaviconsConfig,
    GlobalParsedEntry,
    InternalError,
    InvalidConfigError,
    PreDefinedEnvironment } from '../../models';
import { applyProjectConfigDefaults, applyProjectConfigWithEnvOverrides } from '../../helpers/prepare-configs';

export function getAppBrowserWebpackConfigPartial(angularBuildContext: AppBuildContext): webpack.Configuration {
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

    const environment = angularBuildContext.environment as PreDefinedEnvironment;
    const projectRoot = angularBuildContext.projectRoot;
    const srcDir = path.resolve(projectRoot, appConfig.srcDir || '');

    const entryPoints: { [key: string]: string[] } = {};
    const plugins: webpack.Plugin[] = [];

    // polyfills
    if (appConfig.polyfills && appConfig.polyfills.length > 0) {
        if (!appConfig._polyfillParsedResult) {
            throw new InternalError(`The 'appConfig._polyfillParsedResult' is not set.`);
        }
        const polyfillResult = appConfig._polyfillParsedResult;

        const entries: string[] = [];
        polyfillResult.tsEntries.forEach(tsEntry => {
            if (!entries.includes(tsEntry)) {
                entries.push(tsEntry);
            }
        });
        polyfillResult.scriptEntries.forEach(scriptEntry => {
            if (!entries.includes(scriptEntry)) {
                entries.push(scriptEntry);
            }
        });

        const polyfillsChunkName = appConfig.polyfillsChunkName || 'polyfills';
        entryPoints[polyfillsChunkName] = entries;
    }

    // plugins
    plugins.push(...getHtmlInjectPlugins(angularBuildContext));
    plugins.push(...getChunkPlugins(angularBuildContext));

    // global scripts
    if (appConfig.scripts && appConfig.scripts.length > 0) {
        if (!appConfig._scriptParsedEntries) {
            throw new InternalError(`The 'appConfig._scriptParsedEntries' is not set.`);
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
            }, []);

        plugins.push(new ScriptsConcatWebpackPlugin({
            scripts: globalScriptsByEntry,
            htmlPluginOptionsKey: 'globalScripts',
            appendHash: appConfig.appendOutputHash,
            sourceMap: appConfig.sourceMap,
            minify: environment.prod,
            loggerOptions: {
                logLevel: angularBuildContext.angularBuildConfig.logLevel
            }
        }));
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
        let faviconsConfig: FaviconsConfig | undefined = undefined;
        if (typeof favicons === 'string') {
            configFilePath = path.resolve(srcDir, favicons);
        } else {
            faviconsConfig = favicons as FaviconsConfig;
        }

        plugins.push(new FaviconsWebpackPlugin({
            baseDir: srcDir,

            configFilePath: configFilePath,
            faviconsConfig: faviconsConfig,

            // TODO: to reivew
            forceWriteToDisk: true,
            appName: angularBuildContext.projectName,
            appVersion: angularBuildContext.projectVersion,
            appDescription: angularBuildContext.projectDescription,
            developerName: angularBuildContext.projectAuthor,
            developerUrl: angularBuildContext.projectHomePage,
            lang: appConfig.locale,

            loggerOptions: {
                logLevel: angularBuildContext.angularBuildConfig.logLevel
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

    const webpackBrowserConfig: webpack.Configuration = {
        plugins: plugins,
        performance: performanceOptions,
        output: {
            publicPath: appConfig.publicPath || '/'
        },
        node: {
            process: appConfig.environmentVariables !== false, // default: true
            global: true, // default: true
            module: false,
            fs: 'empty', // default: 'empty'
            crypto: 'empty',
            tls: 'empty',
            net: 'empty',
            clearImmediate: false,
            setImmediate: false, // default: true
        }
    };

    if (entryPoints && Object.keys(entryPoints).length > 0) {
        webpackBrowserConfig.entry = entryPoints;
    }

    return webpackBrowserConfig;
}

function getHtmlInjectPlugins(angularBuildContext: AppBuildContext): webpack.Plugin[] {
    const plugins: webpack.Plugin[] = [];
    const appConfig = angularBuildContext.projectConfig as AppProjectConfigInternal;

    if (!appConfig.htmlInject || !Object.keys(appConfig.htmlInject).length) {
        return plugins;
    }

    if (!appConfig.outDir) {
        throw new InvalidConfigError(`The 'apps[${appConfig._index
            }].outDir' value is required.`);
    }

    const environment = angularBuildContext.environment;
    const projectRoot = angularBuildContext.projectRoot;
    const srcDir = path.resolve(projectRoot, appConfig.srcDir || '');

    const vendorChunkName = appConfig.vendorChunkName || 'vendor';
    const polyfillsChunkName = appConfig.polyfillsChunkName || 'polyfills';
    const commonChunkName = appConfig.commonChunkName || 'common';
    const inlineChunkName = appConfig.inlineChunkName || 'inline';
    const mainChunkName = appConfig.mainEntryChunkName || 'main';

    const lazyChunks: string[] = [];
    const chunkSortList: string[] = [];

    chunkSortList.push('sw-register');

    if (appConfig.referenceDll) {
        chunkSortList.push(vendorChunkName);
    }

    chunkSortList.push(inlineChunkName);
    chunkSortList.push(polyfillsChunkName);

    const styleEntryNames: string[] = [];
    if (appConfig.styles && appConfig.styles.length > 0) {
        const styleParsedEntries = appConfig._styleParsedEntries;
        styleParsedEntries.forEach(styleEntry => {
            if (styleEntry.lazy) {
                lazyChunks.push(styleEntry.entry);
            } else {
                if (appConfig.extractCss) {
                    styleEntryNames.push(styleEntry.entry);
                } else {
                    if (!chunkSortList.includes(styleEntry.entry)) {
                        chunkSortList.push(styleEntry.entry);
                    }
                }
            }
        });
    }

    const defaultHtmlWebpackPluginId = 'DefaultHtmlWebpackPlugin';
    const stylesHtmlWebpackPluginId = 'StylesHtmlWebpackPlugin';
    const scriptsHtmlWebpackPluginId = 'ScriptsHtmlWebpackPlugin';
    const resourceHintsHtmlWebpackPluginId = 'ResourceHintsHtmlWebpackPlugin';

    appConfig.htmlInject = appConfig.htmlInject || {};

    const customAttributes = appConfig.htmlInject.customAttributes || {};
    const customLinkAttributes = Object.assign({}, customAttributes, appConfig.htmlInject.customLinkAttributes || {});
    const customScriptAttributes = Object.assign({}, customAttributes, appConfig.htmlInject.customLinkAttributes || {});
    const customPreloadPrefetchAttributes =
        Object.assign({}, customAttributes, appConfig.htmlInject.customPreloadPrefetchAttributes || {});

    // global scripts
    if (appConfig.scripts && appConfig.scripts.length > 0) {
        if (!appConfig._scriptParsedEntries) {
            throw new InternalError(`The 'appConfig._scriptParsedEntries' is not set.`);
        }
        const scriptParsedEntries = appConfig._scriptParsedEntries;

        const targetScriptIds = [
            defaultHtmlWebpackPluginId, scriptsHtmlWebpackPluginId, resourceHintsHtmlWebpackPluginId
        ];
        plugins.push(new AddAssetsHtmlWebpckPlugin({
            source: 'linksAndScriptsOptionsKey',
            scriptsHtmlPluginOptionsKey: 'globalScripts',
            targetHtmlWebpackPluginIdsForScripts: targetScriptIds,
            customScriptAttributes: customScriptAttributes
        }));

        scriptParsedEntries.forEach(scriptEntry => {
            if (scriptEntry.lazy) {
                lazyChunks.push(scriptEntry.entry);
            } else {
                if (!chunkSortList.includes(scriptEntry.entry)) {
                    chunkSortList.push(scriptEntry.entry);
                }
            }
        });
    }

    if (!appConfig.referenceDll) {
        chunkSortList.push(vendorChunkName);
    }

    chunkSortList.push(commonChunkName);
    chunkSortList.push(mainChunkName);

    // dll assets
    if (appConfig.referenceDll && appConfig.entry) {
        const targetScriptIds = [defaultHtmlWebpackPluginId, scriptsHtmlWebpackPluginId, resourceHintsHtmlWebpackPluginId];
        const targetLinkIds = [defaultHtmlWebpackPluginId, stylesHtmlWebpackPluginId, resourceHintsHtmlWebpackPluginId];

        const dllEnvironment =
            JSON.parse(JSON.stringify(angularBuildContext.environment)) as PreDefinedEnvironment;
        dllEnvironment.aot = false;
        dllEnvironment.dll = true;
        const dllProjectConfig =
            JSON.parse(JSON.stringify(angularBuildContext.projectConfigMaster)) as AppProjectConfigInternal;
        applyProjectConfigWithEnvOverrides(dllProjectConfig, dllEnvironment);
        applyProjectConfigDefaults(projectRoot, dllProjectConfig, dllEnvironment);

        if (dllProjectConfig.dll &&
        ((Array.isArray(dllProjectConfig.dll) && dllProjectConfig.dll.length > 0) ||
                (typeof dllProjectConfig.dll === 'object' && Object.keys(dllProjectConfig.dll).length > 0))) {
            plugins.push(new AddAssetsHtmlWebpckPlugin({
                source: 'json',
                assetJsonPath: path.resolve(projectRoot, appConfig.outDir, `${vendorChunkName}-assets.json`),
                rawTagsHtmlPluginOptionsKey: 'vendors',
                targetHtmlWebpackPluginIdsForScripts: targetScriptIds,
                targetHtmlWebpackPluginIdsForLinks: targetLinkIds,
                customLinkAttributes: customLinkAttributes,
                customScriptAttributes: customScriptAttributes
            }));
        }
    }

    // default inject
    if (appConfig.htmlInject.index || appConfig.htmlInject.indexOut) {
        if (appConfig.htmlInject.index && appConfig.htmlInject.index.trim()) {
            plugins.push(new HtmlWebpackPlugin({
                template: path.resolve(srcDir, appConfig.htmlInject.index),
                filename: path.resolve(projectRoot,
                    appConfig.outDir,
                    appConfig.htmlInject.indexOut || appConfig.htmlInject.index),
                chunksSortMode: packageChunkSort(chunkSortList),
                excludeChunks: lazyChunks,
                title: '',
                minify: environment.prod
                    ? {
                        caseSensitive: true,
                        collapseWhitespace: true,
                        keepClosingSlash: true
                    }
                    : false,
                xhtml: true,
                id: defaultHtmlWebpackPluginId
            }));
        } else {
            plugins.push(new HtmlWebpackPlugin({
                templateContent: ' ',
                filename: path.resolve(projectRoot,
                    appConfig.outDir,
                    appConfig.htmlInject.indexOut || appConfig.htmlInject.index || ''),
                chunksSortMode: packageChunkSort(chunkSortList),
                excludeChunks: lazyChunks,
                title: '',
                minify: false,
                xhtml: true,
                id: defaultHtmlWebpackPluginId,
                inject: true
            }));
        }

        plugins.push(new CustomizeAssetsHtmlWebpackPlugin({
            targetHtmlWebpackPluginIds: [defaultHtmlWebpackPluginId],
            customLinkAttributes: customLinkAttributes,
            customScriptAttributes: customScriptAttributes,
            removeStartingSlash: true
        }));
    }

    // styles Inject
    let shouldMoveStyleAssetsToBody = false;
    let separateStylesOut = appConfig.htmlInject.stylesOut &&
        appConfig.htmlInject.stylesOut !== appConfig.htmlInject.indexOut &&
        appConfig.htmlInject.stylesOut !== appConfig.htmlInject.index;
    if (separateStylesOut) {
        plugins.push(new HtmlWebpackPlugin({
            templateContent: ' ',
            filename: path.resolve(projectRoot, appConfig.outDir, appConfig.htmlInject.stylesOut || ''),
            title: '',
            minify: false,
            xhtml: true,
            chunks: styleEntryNames,
            inject: true,
            id: stylesHtmlWebpackPluginId
        }));

        shouldMoveStyleAssetsToBody = true;
        plugins.push(new CustomizeAssetsHtmlWebpackPlugin({
            targetHtmlWebpackPluginIds: [stylesHtmlWebpackPluginId],
            customLinkAttributes: customLinkAttributes,
            removeStartingSlash: true
        }));
    }

    // script inject
    let shouldMoveScriptsAssetsToBody = false;
    if (appConfig.htmlInject.scriptsOut &&
        appConfig.htmlInject.scriptsOut !== appConfig.htmlInject.indexOut &&
        appConfig.htmlInject.scriptsOut !== appConfig.htmlInject.index) {
        const excludeChunks = lazyChunks.slice();
        if (separateStylesOut) {
            excludeChunks.push(...styleEntryNames);
        }
        if (appConfig.referenceDll) {
            excludeChunks.push(vendorChunkName);
        }

        plugins.push(new HtmlWebpackPlugin({
            templateContent: ' ',
            filename: path.resolve(projectRoot, appConfig.outDir, appConfig.htmlInject.scriptsOut),
            chunksSortMode: packageChunkSort(chunkSortList),
            excludeChunks: excludeChunks,
            title: '',
            minify: false,
            xhtml: true,
            id: scriptsHtmlWebpackPluginId,
            inject: true
        }));

        shouldMoveScriptsAssetsToBody = true;
        plugins.push(new CustomizeAssetsHtmlWebpackPlugin({
            targetHtmlWebpackPluginIds: [scriptsHtmlWebpackPluginId],
            customScriptAttributes: customScriptAttributes,
            removeStartingSlash: true
        }));
    }

    // favicons inject
    // TODO: preload support?, and customAttributes?
    const iconsInjectOutFileName = appConfig.htmlInject.iconsOut;
    const iconHtmlSeparateOut = iconsInjectOutFileName &&
        iconsInjectOutFileName !== appConfig.htmlInject.indexOut &&
        iconsInjectOutFileName !== appConfig.htmlInject.index;
    if (appConfig.favicons || iconHtmlSeparateOut) {
        const iconsHtmlWebpackPluginId = 'IconsHtmlWebpackPlugin';
        if (appConfig.favicons) {
            const targetHtmlWebpackPluginIds = [iconsHtmlWebpackPluginId, defaultHtmlWebpackPluginId];
            plugins.push(new AddAssetsHtmlWebpckPlugin({
                source: 'rawOptionsKey',
                isSeparateOutFunc: (htmlOptionsId?: string): boolean => {
                    return htmlOptionsId === iconsHtmlWebpackPluginId;
                },
                rawTagsHtmlPluginOptionsKey: 'favicons',
                targetHtmlWebpackPluginIdsForRawTags: targetHtmlWebpackPluginIds,
                loggerOptions: {
                    logLevel: angularBuildContext.angularBuildConfig.logLevel
                }
            }));
        }

        if (iconHtmlSeparateOut) {
            plugins.push(new HtmlWebpackPlugin({
                templateContent: ' ',
                filename: path.resolve(projectRoot, appConfig.outDir, iconsInjectOutFileName || ''),
                chunks: [],
                title: '',
                minify: false,
                xhtml: true,
                inject: true,
                id: iconsHtmlWebpackPluginId
            }));
        }
    }

    // resource hints
    if (appConfig.htmlInject.resourceHints ||
        (appConfig.htmlInject.resourceHintsOut && appConfig.htmlInject.resourceHints !== false)) {
        const resourceHintsInjectOutFileName = appConfig.htmlInject.resourceHintsOut;
        const resourceHintsHtmlSeparateOut = !!resourceHintsInjectOutFileName &&
            resourceHintsInjectOutFileName !== appConfig.htmlInject.indexOut &&
            resourceHintsInjectOutFileName !== appConfig.htmlInject.index;

        plugins.push(new ResourceHintsHtmlWebpackPlugin({
            isSeparateOutFunc: (htmlOptionsId?: string): boolean => {
                return htmlOptionsId === resourceHintsHtmlWebpackPluginId;
            },
            targetHtmlWebpackPluginIds: [resourceHintsHtmlWebpackPluginId, defaultHtmlWebpackPluginId],
            preloads: appConfig.htmlInject.preloads || ['**/*.js'],
            prefetches: appConfig.htmlInject.prefetches || [],
            customAttributes: customPreloadPrefetchAttributes,
            loggerOptions: {
                logLevel: angularBuildContext.angularBuildConfig.logLevel
            }
        }));

        if (resourceHintsHtmlSeparateOut) {
            const excludeChunks = lazyChunks.slice();
            // if (separateStylesOut) {
            //    excludeChunks.push(...styleEntryNames);
            // }
            // TODO: to reivew
            // if (appConfig.referenceDll) {
            //    excludeChunks.push(vendorChunkName);
            // }

            plugins.push(new HtmlWebpackPlugin({
                templateContent: ' ',
                filename: path.resolve(projectRoot, appConfig.outDir, resourceHintsInjectOutFileName || ''),
                chunksSortMode: packageChunkSort(chunkSortList),
                excludeChunks: excludeChunks,
                title: '',
                minify: false,
                xhtml: true,
                inject: true,
                id: resourceHintsHtmlWebpackPluginId
            }));
        }
    }

    // basehref
    if (appConfig.baseHref || appConfig.baseHref === '' || appConfig.htmlInject.baseHrefOut) {
        const baseHrefInjectOutFileName = appConfig.htmlInject.baseHrefOut;
        const baseHrefHtmlSeparateOut = !!baseHrefInjectOutFileName &&
            baseHrefInjectOutFileName !== appConfig.htmlInject.indexOut &&
            baseHrefInjectOutFileName !== appConfig.htmlInject.index;

        const baseHrefHtmlWebpackPluginId = 'BaseHrefHtmlWebpackPlugin';
        const targetHtmlWebpackPluginIds = [baseHrefHtmlWebpackPluginId, defaultHtmlWebpackPluginId];

        plugins.push(new BaseHrefHtmlWebpackPlugin({
            baseHref: appConfig.baseHref || '',
            isSeparateOutFunc: (htmlOptionsId?: string): boolean => {
                return htmlOptionsId === baseHrefHtmlWebpackPluginId;
            },
            targetHtmlWebpackPluginIds: targetHtmlWebpackPluginIds,
            loggerOptions: {
                logLevel: angularBuildContext.angularBuildConfig.logLevel
            }
        }));

        if (baseHrefHtmlSeparateOut) {
            plugins.push(new HtmlWebpackPlugin({
                templateContent: ' ',
                filename: path.resolve(projectRoot, appConfig.outDir, baseHrefInjectOutFileName || ''),
                title: '',
                minify: false,
                xhtml: true,
                inject: true,
                id: baseHrefHtmlWebpackPluginId
            }));
        }
    }

    // move to body
    if (shouldMoveStyleAssetsToBody) {
        plugins.push(new CustomizeAssetsHtmlWebpackPlugin({
            targetHtmlWebpackPluginIds: [stylesHtmlWebpackPluginId],
            moveHeadAssetsToBody: true
        }));
    }
    if (shouldMoveScriptsAssetsToBody) {
        plugins.push(new CustomizeAssetsHtmlWebpackPlugin({
            targetHtmlWebpackPluginIds: [scriptsHtmlWebpackPluginId],
            moveHeadAssetsToBody: true
        }));
    }

    // remove starting slash
    plugins.push(new CustomizeAssetsHtmlWebpackPlugin({
        removeStartingSlash: true
    }));

    return plugins;
}

function getChunkPlugins(angularBuildContext: AppBuildContext): webpack.Plugin[] {
    const plugins: webpack.Plugin[] = [];
    const appConfig = angularBuildContext.projectConfig as AppProjectConfigInternal;

    if (!appConfig.entry) {
        return plugins;
    }

    const environment = angularBuildContext.environment;

    const vendorChunkName = appConfig.vendorChunkName || 'vendor';
    const commonChunkName = appConfig.commonChunkName || 'common';
    const inlineChunkName = appConfig.inlineChunkName || 'inline';
    const mainChunkName = appConfig.mainEntryChunkName || 'main';

    let inlineChunk = appConfig.inlineChunk;
    if (typeof inlineChunk === 'undefined') {
        inlineChunk = true;
    }

    let commonChunk = appConfig.commonChunk;
    if (typeof commonChunk === 'undefined') {
        commonChunk = true;
    }

    let vendorChunk = appConfig.vendorChunk;
    if (typeof vendorChunk === 'undefined' && !appConfig.referenceDll && !environment.prod) {
        vendorChunk = true;
    }

    // vendor
    if (vendorChunk && !appConfig.referenceDll) {
        // This enables tree shaking of the vendor modules
        plugins.push(new webpack.optimize.CommonsChunkPlugin({
            name: vendorChunkName,
            chunks: [mainChunkName],
            minChunks: (module: any) => module.resource && /(\\|\/)node_modules(\\|\/)/.test(module.resource)
        }));
    }

    // common
    if (commonChunk) {
        plugins.push(new webpack.optimize.CommonsChunkPlugin({
            name: mainChunkName,
            async: commonChunkName,
            children: true,
            minChunks: 2
        }));
    }

    // inline
    if (inlineChunk) {
        plugins.push(new webpack.optimize.CommonsChunkPlugin({
            minChunks: Infinity,
            name: inlineChunkName
        }));
    }

    return plugins;
}

function packageChunkSort(packages: string[]): HtmlWebpackPlugin.ChunkComparator {
    return (left: any, right: any) => {
        const leftIndex = packages.indexOf(left.names[0]);
        const rightindex = packages.indexOf(right.names[0]);

        if (leftIndex < 0 || rightindex < 0) {
            // unknown packages are loaded last
            return 1;
        }

        if (leftIndex > rightindex) {
            return 1;
        }

        return -1;
    };
}
