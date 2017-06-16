import * as path from 'path';
import * as fs from 'fs-extra';
import * as webpack from 'webpack';

// plugins
import * as HtmlWebpackPlugin from 'html-webpack-plugin';

// internal plugins
import { CustomizeAssetsHtmlWebpackPlugin } from '../plugins/customize-assets-html-webpack-plugin';
import { IconWebpackPlugin } from '../plugins/icon-webpack-plugin';

import {
    DllParsedEntry, getAoTGenDirSync, parseDllEntry, parseIconOptions, parseScriptEntry, parseStyleEntry,
    ScriptParsedEntry, StyleParsedEntry
} from '../helpers';
import { AppProjectConfig } from '../models';

import { WebpackConfigOptions } from './webpack-config-options';

export function getHtmlInjectConfigPartial(webpackConfigOptions: WebpackConfigOptions): webpack.Configuration {
    const projectRoot = webpackConfigOptions.projectRoot;
    const buildOptions = webpackConfigOptions.buildOptions;
    const appConfig = webpackConfigOptions.projectConfig as AppProjectConfig;
    const environment = buildOptions.environment || {};

    // browser only
    if (environment.test ||
        environment.dll ||
        environment.lib ||
        appConfig.projectType !== 'app' ||
        (appConfig.platformTarget && appConfig.platformTarget !== 'web')) {
        return {};
    }

    const srcDir = path.resolve(projectRoot, appConfig.srcDir || '');
    const extraPlugins: any[] = [];

    const vendorChunkName = appConfig.vendorChunkName || 'vendor';
    const polyfillsChunkName = appConfig.polyfillsChunkName || 'polyfills';
    const inlineChunkName = appConfig.inlineChunkName || 'inline';
    const mainChunkName = appConfig.outFileName || 'main';

    const styleEntryNames: string[] = [];
    const chunkSortList = [inlineChunkName, polyfillsChunkName, 'sw-register'];

    appConfig.htmlInjectOptions = appConfig.htmlInjectOptions || {};

    // global styles
    if (appConfig.styles && appConfig.styles.length) {
        parseStyleEntry(appConfig.styles, srcDir, 'styles').forEach((styleEntry: StyleParsedEntry) => {
            if (chunkSortList.indexOf(styleEntry.entry) === -1) {
                chunkSortList.push(styleEntry.entry);
            }
            styleEntryNames.push(styleEntry.entry);
        });
    }

    // global scripts
    const lazyChunks: string[] = [];
    if (appConfig.scripts && appConfig.scripts.length) {
        parseScriptEntry(appConfig.scripts, srcDir, 'scripts').forEach((scriptEntry: ScriptParsedEntry) => {
            if (chunkSortList.indexOf(scriptEntry.entry) === -1) {
                chunkSortList.push(scriptEntry.entry);
            }
            if (scriptEntry.lazy) {
                lazyChunks.push(scriptEntry.entry);
            }
        });
    }

    // vendor chunk
    chunkSortList.push(vendorChunkName);

    // main
    chunkSortList.push(mainChunkName);

    const defaultHtmlWebpackPluginId = 'DefaultHtmlWebpackPlugin';
    const stylesHtmlWebpackPluginId = 'StylesHtmlWebpackPlugin';
    const scriptsHtmlWebpackPluginId = 'ScriptsHtmlWebpackPlugin';

    const manifests: { file: string; chunkName: string; }[] = [];
    if (appConfig.referenceDll) {
        if (appConfig.polyfills && appConfig.polyfills.length > 0) {
            manifests.push({
                file: path.resolve(projectRoot, appConfig.outDir, `${polyfillsChunkName}-manifest.json`),
                chunkName: polyfillsChunkName
            });
        }

        manifests.push(
            {
                file: path.resolve(projectRoot, appConfig.outDir, `${vendorChunkName}-manifest.json`),
                chunkName: vendorChunkName
            }
        );

        const dllRefScripts = manifests.map(manifest => {
            return `${manifest.chunkName}.js`;
        });

        const targetIds = [defaultHtmlWebpackPluginId, scriptsHtmlWebpackPluginId];
        extraPlugins.push(new CustomizeAssetsHtmlWebpackPlugin({
            targetHtmlWebpackPluginIds: targetIds,
            scriptSrcToBodyAssets: dllRefScripts,
            addPublicPath: true
        }));
    }

    // default inject
    if (appConfig.htmlInjectOptions.index || appConfig.htmlInjectOptions.indexOut) {
        const customFilteredAttributes: any[] = appConfig.htmlInjectOptions.customTagAttributes
            ? appConfig.htmlInjectOptions.customTagAttributes
                .filter(a => !a.skipOutFilters ||
                    !a.skipOutFilters.length ||
                    (a.skipOutFilters &&
                        a.skipOutFilters.length &&
                        (a.skipOutFilters.indexOf('index') > -1 || a.skipOutFilters.indexOf('indexOut') > -1)))
            : [];

        if (appConfig.htmlInjectOptions.index && appConfig.htmlInjectOptions.index.trim()) {
            extraPlugins.push(new HtmlWebpackPlugin({
                template: path.resolve(srcDir, appConfig.htmlInjectOptions.index),
                filename: path.resolve(projectRoot,
                    appConfig.outDir,
                    appConfig.htmlInjectOptions.indexOut || appConfig.htmlInjectOptions.index),
                chunksSortMode: packageChunkSort(chunkSortList),
                title: '',
                minify: buildOptions.production
                    ? {
                        caseSensitive: true,
                        collapseWhitespace: true,
                        keepClosingSlash: true
                    }
                    : false,
                customAttributes: customFilteredAttributes,
                id: defaultHtmlWebpackPluginId
            }));
        } else {
            extraPlugins.push(new HtmlWebpackPlugin({
                templateContent: ' ',
                filename: path.resolve(projectRoot,
                    appConfig.outDir,
                    appConfig.htmlInjectOptions.indexOut || appConfig.htmlInjectOptions.index),
                chunksSortMode: packageChunkSort(chunkSortList),
                title: '',
                minify: buildOptions.production
                    ? {
                        caseSensitive: true,
                        collapseWhitespace: true,
                        keepClosingSlash: true
                    }
                    : false,
                customAttributes: customFilteredAttributes,
                id: defaultHtmlWebpackPluginId,
                inject: true
            }));
        }

        // ** Order is import
        // custom script/link attributes
        if (customFilteredAttributes.length) {
            extraPlugins.push(new CustomizeAssetsHtmlWebpackPlugin({
                targetHtmlWebpackPluginIds: [defaultHtmlWebpackPluginId]
            }));
        }
    }

    // styles Inject
    let separateStylesOut = appConfig.htmlInjectOptions.stylesOut &&
        appConfig.htmlInjectOptions.stylesOut !== appConfig.htmlInjectOptions.indexOut &&
        appConfig.htmlInjectOptions.stylesOut !== appConfig.htmlInjectOptions.scriptsOut &&
        appConfig.htmlInjectOptions.stylesOut !== appConfig.htmlInjectOptions.index &&
        appConfig.extractCss &&
        styleEntryNames.length > 0;

    const customStyleAttributes: any[] = appConfig.htmlInjectOptions.customTagAttributes
        ? appConfig.htmlInjectOptions.customTagAttributes
            .filter(a => a.tagName === 'link' &&
                (!a.skipOutFilters ||
                    !a.skipOutFilters.length ||
                    (a.skipOutFilters && a.skipOutFilters.length && a.skipOutFilters.indexOf('stylesOut') > -1)))
        : [];

    if (separateStylesOut ||
        (appConfig.htmlInjectOptions.stylesOut &&
            appConfig.htmlInjectOptions.stylesOut !== appConfig.htmlInjectOptions.indexOut &&
            appConfig.htmlInjectOptions.stylesOut !== appConfig.htmlInjectOptions.scriptsOut &&
            appConfig.htmlInjectOptions.stylesOut !== appConfig.htmlInjectOptions.index)) {
        extraPlugins.push(new HtmlWebpackPlugin({
            templateContent: ' ',
            filename: path.resolve(projectRoot, appConfig.outDir, appConfig.htmlInjectOptions.stylesOut),
            title: '',
            minify: buildOptions.production
                ? {
                    caseSensitive: true,
                    collapseWhitespace: true,
                    keepClosingSlash: true
                }
                : false,
            excludeChunks: lazyChunks,
            chunks: separateStylesOut ? styleEntryNames : [], // [] for clean purpose only
            customAttributes: customStyleAttributes,
            inject: true,
            id: stylesHtmlWebpackPluginId
        }));
    }

    if (separateStylesOut) {
        // custom link attributes
        if (customStyleAttributes.length) {
            extraPlugins.push(new CustomizeAssetsHtmlWebpackPlugin({
                targetHtmlWebpackPluginIds: [stylesHtmlWebpackPluginId]
            }));
        }

        // move head assets to body
        extraPlugins.push(new CustomizeAssetsHtmlWebpackPlugin({
            targetHtmlWebpackPluginIds: [stylesHtmlWebpackPluginId],
            moveHeadAssetsToBody: true
        }));
    }

    // favicons inject
    const iconOptions = parseIconOptions(projectRoot, appConfig);
    if (!!iconOptions && !!iconOptions.masterPicture) {

        const customIconAttributes: any[] = appConfig.htmlInjectOptions.customTagAttributes
            ? appConfig.htmlInjectOptions.customTagAttributes
                .filter(a => !a.skipOutFilters ||
                    !a.skipOutFilters.length ||
                    (a.skipOutFilters && a.skipOutFilters.length && a.skipOutFilters.indexOf('iconsOut') > -1))
            : [];

        let iconsInjectOutFileName = appConfig.htmlInjectOptions.iconsOut;

        const iconHtmlSeparateOut = iconsInjectOutFileName &&
            iconsInjectOutFileName !== appConfig.htmlInjectOptions.indexOut &&
            iconsInjectOutFileName !== appConfig.htmlInjectOptions.scriptsOut &&
            iconsInjectOutFileName !== appConfig.htmlInjectOptions.stylesOut &&
            iconsInjectOutFileName !== appConfig.htmlInjectOptions.index;

        const iconsHtmlWebpackPluginId = iconHtmlSeparateOut
            ? 'IconsHtmlWebpackPlugin'
            : stylesHtmlWebpackPluginId;

        if (iconHtmlSeparateOut) {

            extraPlugins.push(new HtmlWebpackPlugin({
                templateContent: ' ',
                filename: path.resolve(projectRoot, appConfig.outDir, iconsInjectOutFileName),
                chunks: [],
                title: '',
                minify: buildOptions.production
                    ? {
                        caseSensitive: true,
                        collapseWhitespace: true,
                        keepClosingSlash: true
                    }
                    : false,
                customAttributes: customIconAttributes,
                inject: true,
                id: iconsHtmlWebpackPluginId
            }));
        }
        iconOptions.targetHtmlWebpackPluginIds = [iconsHtmlWebpackPluginId, defaultHtmlWebpackPluginId];

        // favicons plugins
        extraPlugins.push(new IconWebpackPlugin(iconOptions));
    }

    // script inject
    if (appConfig.htmlInjectOptions.scriptsOut &&
        appConfig.htmlInjectOptions.scriptsOut !== appConfig.htmlInjectOptions.indexOut &&
        appConfig.htmlInjectOptions.scriptsOut !== appConfig.htmlInjectOptions.index) {
        const excludeChunks = lazyChunks.slice();
        if (separateStylesOut) {
            excludeChunks.push(...styleEntryNames);
        }

        const customScriptAttributes: any[] = appConfig.htmlInjectOptions.customTagAttributes
            ? appConfig.htmlInjectOptions.customTagAttributes
                .filter(a => a.tagName === 'script' &&
                    (!a.skipOutFilters ||
                        !a.skipOutFilters.length ||
                        (a.skipOutFilters && a.skipOutFilters.length && a.skipOutFilters.indexOf('scriptsOut') > -1)))
            : [];

        extraPlugins.push(new HtmlWebpackPlugin({
            templateContent: ' ',
            filename: path.resolve(projectRoot, appConfig.outDir, appConfig.htmlInjectOptions.scriptsOut),
            chunksSortMode: packageChunkSort(chunkSortList),
            excludeChunks: excludeChunks,
            title: '',
            minify: buildOptions.production
                ? {
                    caseSensitive: true,
                    collapseWhitespace: true,
                    keepClosingSlash: true
                }
                : false,
            customAttributes: customScriptAttributes,
            id: scriptsHtmlWebpackPluginId,
            inject: true
        }));

        // move head assets to body
        if (customScriptAttributes.length) {
            extraPlugins.push(new CustomizeAssetsHtmlWebpackPlugin({
                targetHtmlWebpackPluginIds: [scriptsHtmlWebpackPluginId],
                moveHeadAssetsToBody: true
            }));
        }

        // ** order is import
        // custom script/link attributes
        if (customScriptAttributes.length) {
            extraPlugins.push(new CustomizeAssetsHtmlWebpackPlugin({
                targetHtmlWebpackPluginIds: [scriptsHtmlWebpackPluginId]
            }));
        }
    }

    // remove starting slash
    extraPlugins.push(new CustomizeAssetsHtmlWebpackPlugin({
        removeStartingSlash: true
    }));

    return {
        plugins: extraPlugins
    };
}

export function getChunksConfigPartial(webpackConfigOptions: WebpackConfigOptions): webpack.Configuration {
    const projectRoot = webpackConfigOptions.projectRoot;
    const buildOptions = webpackConfigOptions.buildOptions;
    const appConfig = webpackConfigOptions.projectConfig as AppProjectConfig;
    const environment = buildOptions.environment || {};

    // browser only
    if (environment.test ||
        environment.dll ||
        appConfig.projectType !== 'app' ||
        (appConfig.platformTarget && appConfig.platformTarget !== 'web')) {
        return {};
    }

    const srcDir = path.resolve(projectRoot, appConfig.srcDir || '');
    let entryPoints: { [key: string]: string[] } = {};
    const rules: any[] = [];
    const plugins: any[] = [];

    // Separate modules from node_modules into a vendor chunk.
    const nodeModulesPath = path.resolve(projectRoot, 'node_modules');
    // Resolves all symlink to get the actual node modules folder.
    const realNodeModules = fs.realpathSync(nodeModulesPath);

    // --aot puts the generated *.ngfactory.ts in src/$$_gendir/node_modules.
    const vendorChunkStartPaths: string[] = [
        nodeModulesPath,
        realNodeModules,

        path.resolve(srcDir, '$$_gendir', 'node_modules'),
        path.resolve(projectRoot, '$$_gendir', 'node_modules'),

        path.resolve(srcDir, 'aot-browser-compiled', 'node_modules'),
        path.resolve(projectRoot, 'aot-browser-compiled', 'node_modules'),

        path.resolve(srcDir, 'browser-aot-compiled', 'node_modules'),
        path.resolve(projectRoot, 'browser-aot-compiled', 'node_modules'),

        path.resolve(srcDir, 'aot-compiled', 'node_modules'),
        path.resolve(projectRoot, 'aot-compiled', 'node_modules')
    ];

    let tsConfigPath = path.resolve(projectRoot, appConfig.srcDir || '', appConfig.tsconfig || 'tsconfig.json');
    const aotGenDirAbs = getAoTGenDirSync(tsConfigPath);
    if (tsConfigPath && aotGenDirAbs) {
        vendorChunkStartPaths.push(path.resolve(aotGenDirAbs, 'node_modules'));
    }
    if (appConfig.vendorChunkPaths && appConfig.vendorChunkPaths.length) {
        appConfig.vendorChunkPaths.forEach(p => {
            const resolvedPath = path.resolve(srcDir, p);
            if (vendorChunkStartPaths.indexOf(resolvedPath) === -1) {
                vendorChunkStartPaths.push(resolvedPath);
            }
        });
    }

    const vendorChunkName = appConfig.vendorChunkName || 'vendor';
    const polyfillsChunkName = appConfig.polyfillsChunkName || 'polyfills';
    const inlineChunkName = appConfig.inlineChunkName || 'inline';
    const mainChunkName = appConfig.outFileName || 'main';

    // polyfills
    const dllEntries: any[] = [];
    if (appConfig.polyfills && appConfig.polyfills.length) {
        if (appConfig.referenceDll) {
            Array.isArray(appConfig.polyfills)
                ? dllEntries.push(...appConfig.polyfills)
                : dllEntries.push(appConfig.polyfills);

        } else {
            const entries: string[] = [];
            parseDllEntry(projectRoot, appConfig.srcDir || '', appConfig.polyfills, environment).forEach(
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
            if (entries.length === 0) {
                throw new Error(`No polyfills entry.`);
            }
            entryPoints[polyfillsChunkName] = entries;
        }
    }

    let inlineChunk = appConfig.inlineChunk;
    if ((typeof inlineChunk === 'undefined' || inlineChunk == null) &&
        !environment.test &&
        appConfig.platformTarget === 'web') {
        inlineChunk = true;
    }

    let vendorChunk = appConfig.vendorChunk;
    if ((typeof vendorChunk === 'undefined' || vendorChunk == null) &&
        !environment.test &&
        appConfig.platformTarget === 'web' && !appConfig.referenceDll) {
        vendorChunk = true;
    }

    // inline
    if (inlineChunk) {
        plugins.push(new webpack.optimize.CommonsChunkPlugin({
            minChunks: Infinity,
            name: inlineChunkName
        }));
    }

    // vendor
    if (!appConfig.referenceDll && vendorChunk) {
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

    const webpackNonDllConfig: webpack.Configuration = {
        entry: entryPoints,
        module: {
            rules: rules
        },
        plugins: plugins
    };

    return webpackNonDllConfig;
}

export function getGlobalScriptsConfigPartial(webpackConfigOptions: WebpackConfigOptions): webpack.Configuration {
    const projectRoot = webpackConfigOptions.projectRoot;
    const buildOptions = webpackConfigOptions.buildOptions;
    const appConfig = webpackConfigOptions.projectConfig as AppProjectConfig;
    const environment = buildOptions.environment || {};

    // browser only
    if (environment.test ||
        environment.dll ||
        appConfig.projectType !== 'app' ||
        (appConfig.platformTarget && appConfig.platformTarget !== 'web')) {
        return {};
    }

    const srcDir = path.resolve(projectRoot, appConfig.srcDir || '');
    const entryPoints: { [key: string]: string[] } = {};

    // global scripts
    if (appConfig.scripts && appConfig.scripts.length > 0) {
        const globalScripts = parseScriptEntry(appConfig.scripts, srcDir, 'scripts');

        // add entry points and lazy chunks
        globalScripts.forEach((scriptParsedEntry: ScriptParsedEntry) => {
            const scriptPath = `script-loader!${scriptParsedEntry.path}`;
            entryPoints[scriptParsedEntry.entry] = (entryPoints[scriptParsedEntry.entry] || []).concat(scriptPath);
        });
    }


    const webpackNonDllConfig: webpack.Configuration = {
        entry: entryPoints
    };

    return webpackNonDllConfig;
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
