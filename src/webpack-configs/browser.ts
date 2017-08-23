const fs = require('fs-extra');
import * as path from 'path';
import * as webpack from 'webpack';

import * as HtmlWebpackPlugin from 'html-webpack-plugin';

// ReSharper disable once InconsistentNaming
// ReSharper disable once CommonJsExternalModule
const ConcatPlugin = require('webpack-concat-plugin');

import { CustomizeAssetsHtmlWebpackPlugin } from '../plugins/customize-assets-html-webpack-plugin';
import { DllAssetsReferenceWebpackPlugin } from '../plugins/dll-assets-reference-webpack-plugin';
import { IconWebpackPlugin } from '../plugins/icon-webpack-plugin';
import { InsertConcatAssetsWebpackPlugin } from '../plugins/insert-concat-assets-webpack-plugin';
import {
    DllParsedEntry, getNodeModuleStartPaths, mergeProjectConfigWithEnvOverrides, parseDllEntry, parseIconOptions,
    parseScriptEntry, ScriptParsedEntry
} from '../helpers';
import { AppProjectConfig } from '../models';

import { getGlobalStyleEntries } from './styles';

import { WebpackConfigOptions } from './webpack-config-options';

export function getHtmlInjectWebpackConfigPartial(webpackConfigOptions: WebpackConfigOptions): webpack.Configuration {
    const projectRoot = webpackConfigOptions.projectRoot;
    const buildOptions = webpackConfigOptions.buildOptions;
    const environment = buildOptions.environment || {};
    const appConfig = webpackConfigOptions.projectConfig as AppProjectConfig;

    // browser only
    if (environment.test ||
        environment.dll ||
        appConfig.projectType !== 'app' ||
        (appConfig.platformTarget && appConfig.platformTarget !== 'web')) {
        return {};
    }

    const srcDir = path.resolve(projectRoot, appConfig.srcDir || '');
    const plugins: any[] = [];

    const vendorChunkName = appConfig.vendorChunkName || 'vendor';
    const polyfillsChunkName = appConfig.polyfillsChunkName || 'polyfills';
    const commonChunkName = appConfig.commonChunkName || 'common';
    const inlineChunkName = appConfig.inlineChunkName || 'inline';
    const mainChunkName = 'main';

    const lazyChunks: string[] = [];
    const chunkSortList: string[] = [];

    // prepare global extracted styles
    let globalStyleParsedEntries = getGlobalStyleEntries(projectRoot, appConfig, buildOptions);
    const styleEntryNames: string[] = [];

    if (appConfig.extractCss) {
        styleEntryNames.push(...globalStyleParsedEntries.map(style => style.entry));
        // styleEntryNames.forEach(s => {
        //    if (chunkSortList.indexOf(s) === -1) {
        //        chunkSortList.push(s);
        //    }
        // });
    }

    if (appConfig.referenceDll) {
        chunkSortList.push(polyfillsChunkName);
        chunkSortList.push(vendorChunkName);
        chunkSortList.push('sw-register');
        chunkSortList.push(inlineChunkName);
    } else {
        chunkSortList.push(inlineChunkName);
        chunkSortList.push(polyfillsChunkName);
        chunkSortList.push('sw-register');
    }

    // prepare global non-extracted styles
    if (!appConfig.extractCss) {
        globalStyleParsedEntries.forEach(style => {
            if (chunkSortList.indexOf(style.entry) === -1) {
                chunkSortList.push(style.entry);
            }
        });
    }

    // prepare global scripts
    if (appConfig.scripts && appConfig.scripts.length > 0) {
        const globalScripts = parseScriptEntry(appConfig.scripts, srcDir, 'scripts');

        const globalScriptsByEntry = globalScripts
            .reduce((prev: { entry: string, paths: string[], lazy: boolean }[], curr: ScriptParsedEntry) => {

                const existingEntry = prev.find((el) => el.entry === curr.entry);
                if (existingEntry) {
                    existingEntry.paths.push(curr.path);
                    // All entries have to be lazy for the bundle to be lazy.
                    existingEntry.lazy = existingEntry.lazy && !!curr.lazy;
                } else {
                    prev.push({ entry: curr.entry, paths: [curr.path], lazy: !!curr.lazy });
                }
                return prev;
            }, []);

        // Add a new asset for each entry.
        globalScriptsByEntry.forEach((script) => {
            const fileHashFormat = appConfig.appendOutputHash && !script.lazy
                ? '.[hash]'
                : '';

            plugins.push(new ConcatPlugin({
                // TODO: to review
                uglify: buildOptions.production ? { sourceMapIncludeSources: true } : false,
                sourceMap: appConfig.sourceMap,
                name: script.entry,
                // Lazy scripts don't get a hash, otherwise they can't be loaded by name.
                fileName: `[name]${script.lazy ? '' : fileHashFormat}.js`,
                filesToConcat: script.paths
            }));
        });

        // Insert all the assets created by ConcatPlugin in the right place in index.html.
        plugins.push(new InsertConcatAssetsWebpackPlugin(
            globalScriptsByEntry
                .filter((el) => !el.lazy)
                .map((el) => el.entry)
        ));

        globalScriptsByEntry.forEach((scriptEntry: { entry: string, paths: string[], lazy: boolean }) => {
            if (scriptEntry.lazy) {
                lazyChunks.push(scriptEntry.entry);
            } else {
                if (chunkSortList.indexOf(scriptEntry.entry) === -1) {
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

    const defaultHtmlWebpackPluginId = 'DefaultHtmlWebpackPlugin';
    const stylesHtmlWebpackPluginId = 'StylesHtmlWebpackPlugin';
    const scriptsHtmlWebpackPluginId = 'ScriptsHtmlWebpackPlugin';
    const resourceHintsHtmlWebpackPluginId = 'ResourceHintsHtmlWebpackPlugin';

    appConfig.htmlInjectOptions = appConfig.htmlInjectOptions || {};
    const customLinkAttributes = appConfig.htmlInjectOptions.customLinkAttributes;
    const customScriptAttributes = appConfig.htmlInjectOptions.customScriptAttributes;

    // dll assets
    if (appConfig.referenceDll) {
        const clonedAppConfig = JSON.parse(JSON.stringify(webpackConfigOptions.projectConfigMaster)) as AppProjectConfig;
        mergeProjectConfigWithEnvOverrides(clonedAppConfig, buildOptions);

        const dllOutDir = path.resolve(projectRoot, clonedAppConfig.outDir || '');
        const vendorAssetPath = path.resolve(dllOutDir, `${vendorChunkName}-assets.json`);
        const targetScriptIds = [defaultHtmlWebpackPluginId, scriptsHtmlWebpackPluginId, resourceHintsHtmlWebpackPluginId];
        const targetLinkIds = [defaultHtmlWebpackPluginId, stylesHtmlWebpackPluginId];

        plugins.push(new DllAssetsReferenceWebpackPlugin({
            manifest: vendorAssetPath,
            name: vendorChunkName,
            targetHtmlWebpackPluginIdsForScripts: targetScriptIds,
            targetHtmlWebpackPluginIdsForLinks: targetLinkIds,
            customLinkAttributes: customLinkAttributes,
            customScriptAttributes: customScriptAttributes
        }));
    }

    // default inject
    if (appConfig.htmlInjectOptions.index || appConfig.htmlInjectOptions.indexOut) {
        if (appConfig.htmlInjectOptions.index && appConfig.htmlInjectOptions.index.trim()) {
            plugins.push(new HtmlWebpackPlugin({
                template: path.resolve(srcDir, appConfig.htmlInjectOptions.index),
                filename: path.resolve(projectRoot,
                    appConfig.outDir,
                    appConfig.htmlInjectOptions.indexOut || appConfig.htmlInjectOptions.index),
                chunksSortMode: packageChunkSort(chunkSortList),
                excludeChunks: lazyChunks,
                title: '',
                minify: buildOptions.production
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
                    appConfig.htmlInjectOptions.indexOut || appConfig.htmlInjectOptions.index),
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
    let separateStylesOut = appConfig.htmlInjectOptions.stylesOut &&
        appConfig.htmlInjectOptions.stylesOut !== appConfig.htmlInjectOptions.indexOut &&
        appConfig.htmlInjectOptions.stylesOut !== appConfig.htmlInjectOptions.scriptsOut &&
        appConfig.htmlInjectOptions.stylesOut !== appConfig.htmlInjectOptions.index;
    if (separateStylesOut) {
        plugins.push(new HtmlWebpackPlugin({
            templateContent: ' ',
            filename: path.resolve(projectRoot, appConfig.outDir, appConfig.htmlInjectOptions.stylesOut),
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

    // favicons inject
    const iconOptions = parseIconOptions(projectRoot, appConfig);
    const iconsInjectOutFileName = appConfig.htmlInjectOptions.iconsOut;
    const iconHtmlSeparateOut = iconsInjectOutFileName &&
        iconsInjectOutFileName !== appConfig.htmlInjectOptions.indexOut &&
        iconsInjectOutFileName !== appConfig.htmlInjectOptions.scriptsOut &&
        iconsInjectOutFileName !== appConfig.htmlInjectOptions.stylesOut &&
        iconsInjectOutFileName !== appConfig.htmlInjectOptions.index;
    if ((iconOptions && iconOptions.masterPicture) || iconHtmlSeparateOut) {
        const iconsHtmlWebpackPluginId = iconHtmlSeparateOut
            ? 'IconsHtmlWebpackPlugin'
            : stylesHtmlWebpackPluginId;

        if (iconHtmlSeparateOut) {
            plugins.push(new HtmlWebpackPlugin({
                templateContent: ' ',
                filename: path.resolve(projectRoot, appConfig.outDir, iconsInjectOutFileName),
                chunks: [],
                title: '',
                minify: false,
                xhtml: true,
                inject: true,
                id: iconsHtmlWebpackPluginId
            }));
        }

        if (iconOptions) {
            iconOptions.targetHtmlWebpackPluginIds = [iconsHtmlWebpackPluginId, defaultHtmlWebpackPluginId];

            // favicons plugins
            plugins.push(new IconWebpackPlugin(iconOptions));
        }
    }

    // script inject
    let shouldMoveScriptsAssetsToBody = false;
    if (appConfig.htmlInjectOptions.scriptsOut &&
        appConfig.htmlInjectOptions.scriptsOut !== appConfig.htmlInjectOptions.indexOut &&
        appConfig.htmlInjectOptions.scriptsOut !== appConfig.htmlInjectOptions.index) {
        const excludeChunks = lazyChunks.slice();
        if (separateStylesOut) {
            excludeChunks.push(...styleEntryNames);
        }
        if (appConfig.referenceDll) {
            excludeChunks.push(vendorChunkName);
        }

        plugins.push(new HtmlWebpackPlugin({
            templateContent: ' ',
            filename: path.resolve(projectRoot, appConfig.outDir, appConfig.htmlInjectOptions.scriptsOut),
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
            customLinkAttributes: customLinkAttributes,
            customScriptAttributes: customScriptAttributes,
            removeStartingSlash: true
        }));
    }

    // resource hints
    if (appConfig.htmlInjectOptions.resourceHintsEnabled !== false) {
        const resourceHintsInjectOutFileName = appConfig.htmlInjectOptions.resourceHintsOut;
        const resourceHintsHtmlSeparateOut = !!resourceHintsInjectOutFileName &&
            resourceHintsInjectOutFileName !== appConfig.htmlInjectOptions.indexOut &&
            resourceHintsInjectOutFileName !== appConfig.htmlInjectOptions.index &&
            resourceHintsInjectOutFileName !== appConfig.htmlInjectOptions.scriptsOut &&
            resourceHintsInjectOutFileName !== appConfig.htmlInjectOptions.stylesOut &&
            resourceHintsInjectOutFileName !== appConfig.htmlInjectOptions.iconsOut;

        if (resourceHintsHtmlSeparateOut) {
            const excludeChunks = lazyChunks.slice();
            if (separateStylesOut) {
                excludeChunks.push(...styleEntryNames);
            }
            if (appConfig.referenceDll) {
                excludeChunks.push(vendorChunkName);
            }

            plugins.push(new HtmlWebpackPlugin({
                templateContent: ' ',
                filename: path.resolve(projectRoot, appConfig.outDir, resourceHintsInjectOutFileName),
                chunksSortMode: packageChunkSort(chunkSortList),
                excludeChunks: excludeChunks,
                title: '',
                minify: false,
                xhtml: true,
                inject: true,
                id: resourceHintsHtmlWebpackPluginId
            }));
        }

        plugins.push(new CustomizeAssetsHtmlWebpackPlugin({
            targetHtmlWebpackPluginIds: [resourceHintsHtmlWebpackPluginId],
            preloads: appConfig.htmlInjectOptions.preloads || ['**/*.*'],
            prefetches: appConfig.htmlInjectOptions.prefetches,
            customLinkAttributes: customLinkAttributes,
            clearHeadAssets: resourceHintsHtmlSeparateOut,
            clearBodyAssets: resourceHintsHtmlSeparateOut,
            moveHeadAssetsToBody: resourceHintsHtmlSeparateOut ||
            (resourceHintsInjectOutFileName !== appConfig.htmlInjectOptions.indexOut &&
                resourceHintsInjectOutFileName !== appConfig.htmlInjectOptions.index)
        }));
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

    return {
        plugins: plugins
    };
}

export function getChunksWebpackConfigPartial(webpackConfigOptions: WebpackConfigOptions): webpack.Configuration {
    const projectRoot = webpackConfigOptions.projectRoot;
    const buildOptions = webpackConfigOptions.buildOptions;
    const environment = buildOptions.environment || {};
    const appConfig = webpackConfigOptions.projectConfig as AppProjectConfig;

    // browser only
    if (environment.test ||
        environment.dll ||
        appConfig.projectType !== 'app' ||
        (appConfig.platformTarget && appConfig.platformTarget !== 'web')) {
        return {};
    }

    let entryPoints: { [key: string]: string[] } = {};
    const plugins: any[] = [];

    const srcDir = path.resolve(projectRoot, appConfig.srcDir || '');

    const vendorChunkStartPaths = getNodeModuleStartPaths(projectRoot, appConfig);

    const vendorChunkName = appConfig.vendorChunkName || 'vendor';
    const polyfillsChunkName = appConfig.polyfillsChunkName || 'polyfills';
    const commonChunkName = appConfig.commonChunkName || 'common';
    const inlineChunkName = appConfig.inlineChunkName || 'inline';
    const mainChunkName = 'main';

    let inlineChunk = appConfig.inlineChunk;
    if (typeof inlineChunk === 'undefined') {
        inlineChunk = true;
    }

    let commonChunk = appConfig.commonChunk;
    if (typeof commonChunk === 'undefined') {
        commonChunk = true;
    }

    let vendorChunk = appConfig.vendorChunk;
    if (typeof vendorChunk === 'undefined' && !appConfig.referenceDll && !buildOptions.buildOptimizer) {
        vendorChunk = true;
    }

    // polyfills
    if (appConfig.polyfills && appConfig.polyfills.length && !appConfig.referenceDll) {
        const entries: string[] = [];
        parseDllEntry(projectRoot, srcDir, appConfig.polyfills, environment).forEach(
            (dllParsedEntry: DllParsedEntry) => {
                if (dllParsedEntry.tsPath) {
                    if (entries.indexOf(dllParsedEntry.tsPath) === -1) {
                        entries.push(dllParsedEntry.tsPath);
                    }
                } else {
                    if (Array.isArray(dllParsedEntry.entry)) {
                        entries.push(...dllParsedEntry.entry.filter((ee: string) => entries.indexOf(ee) === -1));
                    } else if (entries.indexOf(dllParsedEntry.entry) === -1) {
                        entries.push(dllParsedEntry.entry);
                    }
                }
            });
        entryPoints[polyfillsChunkName] = entries;
    }

    // service worker
    if (appConfig.experimentalServiceWorker) {
        // Path to a small script to register a service worker.
        const nodeModules = path.resolve(projectRoot, 'node_modules');
        const registerPath = path.resolve(nodeModules, '@angular/service-worker/build/assets/register-basic.min.js');
        if (fs.existsSync(registerPath)) {
            if (entryPoints[polyfillsChunkName]) {
                entryPoints[polyfillsChunkName] = [...entryPoints[polyfillsChunkName], registerPath];
            } else {
                entryPoints['sw-register'] = [registerPath];
            }
        }
    }

    // vendor
    if (vendorChunk && !appConfig.referenceDll) {
        // This enables tree shaking of the vendor modules
        plugins.push(new webpack.optimize.CommonsChunkPlugin({
            name: vendorChunkName,
            chunks: [mainChunkName],
            minChunks: (module: any) => module.resource &&
                vendorChunkStartPaths.reduce(
                    (last: boolean, current: string) => module.resource.startsWith(current) || last,
                    false)
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

    const webpackChunksConfig: webpack.Configuration = {
        entry: entryPoints,
        plugins: plugins
    };

    return webpackChunksConfig;
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
