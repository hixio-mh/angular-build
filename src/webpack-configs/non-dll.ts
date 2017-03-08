import * as path from 'path';
import * as chalk from 'chalk';
import * as webpack from 'webpack';
const webpackMerge = require('webpack-merge');

// ReSharper disable once InconsistentNaming
const HtmlWebpackPlugin = require('html-webpack-plugin');

// Models
import { AppConfig, BuildOptions, GlobalScopedEntry } from '../models';

// Helpers
import { parseDllEntries, parseGlobalScopedEntry, lazyChunksFilter, packageChunkSort, getIconOptions } from
    '../helpers';

// Internal plugins
import { TryBundleDllWebpackPlugin } from '../plugins/try-bundle-dll-webpack-plugin';
import {CustomizeAssetsHtmlWebpackPlugin} from '../plugins/customize-assets-html-webpack-plugin';
import {IconWebpackPlugin} from '../plugins/icon-webpack-plugin';

// Configs
import { getDllConfig } from './dll';
import {getCommonConfigPartial} from './common';
import {getAngularConfigPartial, getServiceWorkConfigPartial} from './angular';
import {getStylesConfigPartial} from './styles';

/**
 * Enumerate loaders and their dependencies from this file to let the dependency validator
 * know they are used.
 *
  * require('script-loader')
 */

export function getNonDllConfig(projectRoot: string, appConfig: AppConfig, buildOptions: BuildOptions) {
    console.log(`\n${chalk.bgBlue('INFO:')} Getting config, build env: ${JSON
        .stringify(buildOptions.environment)}, app target: ${appConfig
            .target}, main entry: ${appConfig.main}\n`);

    const configs : any[] = [
        getCommonConfigPartial(projectRoot, appConfig, buildOptions),//
        getNonDllConfigPartial(projectRoot, appConfig, buildOptions),
        getAngularConfigPartial(projectRoot, appConfig, buildOptions),
        getStylesConfigPartial(projectRoot, appConfig, buildOptions)
    ];

    if (!appConfig.target || appConfig.target === 'web' || appConfig.target === 'webworker') {
        configs.push(getHtmlInjectConfigPartial(projectRoot, appConfig, buildOptions));

        if (appConfig.serviceWorker) {
            configs.push(getServiceWorkConfigPartial(projectRoot));
        }
    }
    return webpackMerge(configs);
}

export function getNonDllConfigPartial(projectRoot: string, appConfig: AppConfig, buildOptions: BuildOptions) {
    const appRoot = path.resolve(projectRoot, appConfig.root);
    let entryPoints: { [key: string]: string[] } = {};
    const extraRules: any[] = [];
    const extraPlugins: any[] = [];
    const nodeModulesPath = path.resolve(projectRoot, 'node_modules');
    const polyfillsChunkName = 'polyfills';
    const vendorChunkName = appConfig.dllChunkName || 'vendor';
    //const envLong = getEnvName(buildOptions.production, true);


    // Try bundle dlls
    //
    if (appConfig.referenceDll) {
        const manifests: { file: string; chunkName: string; }[] = [];
        manifests.push(
            {
                file: path.resolve(projectRoot, appConfig.outDir, `${vendorChunkName}-manifest.json`),
                chunkName: vendorChunkName
            }
        );

        if (appConfig.polyfills && appConfig.polyfills.length > 0) {
            manifests.push({
                file: path.resolve(projectRoot, appConfig.outDir, `${polyfillsChunkName}-manifest.json`),
                chunkName: polyfillsChunkName
            });
        }

        const cloneAppConfig = Object.assign({}, appConfig);
        const cloneBuildOptions = Object.assign({}, buildOptions);
        cloneBuildOptions.dll = true;
        extraPlugins.push(new TryBundleDllWebpackPlugin({
            context: projectRoot,
            debug: cloneBuildOptions.verbose,
            manifests: manifests,
            getDllConfigFunc: () => getDllConfig(projectRoot, cloneAppConfig, cloneBuildOptions)
        }));
    }

    // Polyfills entries
    //
    const dllEntries: any[] = [];
    if (appConfig.polyfills && appConfig.polyfills.length) {
        if (appConfig.referenceDll) {
            if (Array.isArray(appConfig.polyfills)) {
                dllEntries.push(...appConfig.polyfills);
            } else {
                dllEntries.push(appConfig.polyfills);
            }
        } else {
            const entries: string[] = [];
            parseDllEntries(projectRoot, appConfig.root, appConfig.polyfills, buildOptions.environment).forEach(e => {
                if (e.tsPath) {
                    if (entries.indexOf(e.tsPath) === -1) {
                        entries.push(e.tsPath);
                    }
                } else {
                    if (Array.isArray(e.entry)) {
                        entries.push(...e.entry.filter((ee: string) => entries.indexOf(ee) === -1));
                    } else if (entries.indexOf(e.entry) === -1) {
                        entries.push(e.entry);
                    }
                }
            });
            if (entries.length === 0) {
                throw new Error(`No polyfills entry.`);
            }
            entryPoints[polyfillsChunkName] = entries;
        }
    }

    // Main entry
    //
    if (appConfig.main && appConfig.main.trim().length) {
        const appMain = path.resolve(projectRoot, appConfig.root, appConfig.main);
        if (appConfig.dlls && appConfig.dlls.length) {
            appConfig.dlls.filter(e => typeof e === 'object' && e.importToMain).forEach(e => dllEntries.push(e));
        }

        const entries: string[] = [];
        parseDllEntries(projectRoot, appConfig.root, dllEntries, buildOptions.environment).forEach(e => {
            if (e.tsPath && e.tsPath.length) {
                if (entries.indexOf(e.tsPath) === -1) {
                    entries.push(e.tsPath);
                }
            } else {
                if (Array.isArray(e.entry)) {
                    entries.push(...e.entry.filter((ee: string) => entries.indexOf(ee) === -1));
                } else if (entries.indexOf(e.entry) === -1) {
                    entries.push(e.entry);
                }
            }
        });

        entryPoints['main'] = entries.concat([appMain]);
    }

    // Global scripts
    //
    if (appConfig.scripts && appConfig.scripts.length > 0) {
        const globalScripts = parseGlobalScopedEntry(appConfig.scripts, appRoot, 'scripts');

        // add entry points and lazy chunks
        globalScripts.forEach((script: GlobalScopedEntry & { path?: string; entry?: string; }) => {
            const scriptPath = `script-loader!${script.path}`;
            entryPoints[script.entry] = (entryPoints[script.entry] || []).concat(scriptPath);
        });
    }

    // CommonsChunkPlugin
    //
    let inlineChunk = appConfig.inlineChunk;
    if (typeof inlineChunk == 'undefined' || inlineChunk == null) {
        if (!buildOptions.test && appConfig.target !== 'web' && appConfig.target !== 'webworker') {
            inlineChunk = true;
        }
    }
    let vendorChunk = appConfig.vendorChunk;
    if (typeof vendorChunk == 'undefined' || vendorChunk == null) {
        if (!buildOptions.test && appConfig.target !== 'web' && appConfig.target !== 'webworker') {
            vendorChunk = true;
        }
    }

    if (appConfig.referenceDll) {
        if (inlineChunk) {
            extraPlugins.push(new webpack.optimize.CommonsChunkPlugin({
                minChunks: Infinity,
                name: 'inline'
            }));
        }

    } else {
        if (inlineChunk) {
            extraPlugins.push(new webpack.optimize.CommonsChunkPlugin({
                minChunks: Infinity,
                name: 'inline'
            }));
        }

        if (vendorChunk) {
            // This enables tree shaking of the vendor modules
            extraPlugins.push(new webpack.optimize.CommonsChunkPlugin({
                name: vendorChunkName,
                chunks: ['main'],
                minChunks: (module: any) => module.resource && module.resource.startsWith(nodeModulesPath)
                // minChunks: (module: any) => module.userRequest && module.userRequest.startsWith(nodeModulesPath)
                // minChunks: module => /node_modules/.test(module.resource)
            }));
        }
    }

    const webpackNonDllConfig : any = {
        entry: entryPoints,
        module: {
            rules: extraRules
        },
        plugins: extraPlugins
    };

    // Node specific
    if (appConfig.target && appConfig.target !== 'web' && appConfig.target !== 'webworker') {
        webpackNonDllConfig.output = webpackNonDllConfig.output || {};
        webpackNonDllConfig.output.libraryTarget = 'commonjs';
    }

    return webpackNonDllConfig;
}

export function getHtmlInjectConfigPartial(projectRoot: string, appConfig: AppConfig, buildOptions: BuildOptions) {
    const appRoot = path.resolve(projectRoot, appConfig.root);
    const extraPlugins: any[] = [];
    const vendorChunkName = appConfig.dllChunkName || 'vendor';
    const polyfillsChunkName = 'polyfills';
    const styleEntryNames: string[] = [];
    const allGlobalScopedEntry: any[] = [];
    const chunkSortList = ['inline', polyfillsChunkName, 'sw-register'];

    appConfig.htmlInjectOptions = appConfig.htmlInjectOptions || {};

    // Global scripts
    //
    if (appConfig.scripts) {
        parseGlobalScopedEntry(appConfig.scripts, appRoot, 'scripts').forEach((extraEntry: GlobalScopedEntry & { path?: string; entry?: string; }) => {
            if (chunkSortList.indexOf(extraEntry.entry) === -1) {
                chunkSortList.push(extraEntry.entry);
            }
            allGlobalScopedEntry.push(extraEntry);
        });
    }

    // Global styles
    //
    if (appConfig.styles) {
        parseGlobalScopedEntry(appConfig.scripts, appRoot, 'styles').forEach((extraEntry: GlobalScopedEntry & { path?: string; entry?: string; }) => {
            if (chunkSortList.indexOf(extraEntry.entry) === -1) {
                chunkSortList.push(extraEntry.entry);
            }
            allGlobalScopedEntry.push(extraEntry);
            styleEntryNames.push(extraEntry.entry);
        });
    }
    const lazyChunks = lazyChunksFilter(allGlobalScopedEntry);

    // Vendor chunk
    chunkSortList.push(vendorChunkName);

    // Main
    chunkSortList.push('main');

    const defaultHtmlWebpackPluginId = 'DefaultHtmlWebpackPlugin';

    // Styles Inject
    //
    let separateStylesOut = appConfig.htmlInjectOptions.stylesOutFileName &&
        appConfig.htmlInjectOptions.stylesOutFileName !== appConfig.htmlInjectOptions.indexOutFileName &&
        appConfig.htmlInjectOptions.stylesOutFileName !== appConfig.index &&
        appConfig.extractCss &&
        styleEntryNames.length > 0;

    const stylesHtmlWebpackPluginId = separateStylesOut ? 'StylesHtmlWebpackPlugin' : null;
    if (separateStylesOut ||
    (appConfig.htmlInjectOptions.stylesOutFileName &&
        appConfig.htmlInjectOptions.stylesOutFileName !== appConfig.htmlInjectOptions.indexOutFileName &&
        appConfig.htmlInjectOptions.stylesOutFileName !== appConfig.index)) {
        extraPlugins.push(new HtmlWebpackPlugin({
            templateContent: ' ',
            filename: path.resolve(projectRoot, appConfig.outDir, appConfig.htmlInjectOptions.stylesOutFileName),
            title: '',
            excludeChunks: lazyChunks,
            chunks: separateStylesOut ? styleEntryNames : [], // [] for clean purpose only
            customAttributes: appConfig.htmlInjectOptions.customTagAttributes,
            inject: true,
            id: stylesHtmlWebpackPluginId
        }));
    }

    if (separateStylesOut) {
        // custom link attributes
        if (appConfig.htmlInjectOptions.customTagAttributes && appConfig.htmlInjectOptions.customTagAttributes.find(c => c.tagName === 'link')) {
            const customLinkAttributes = appConfig.htmlInjectOptions.customTagAttributes
                .filter(c => c.tagName === 'link');
            extraPlugins.push(new CustomizeAssetsHtmlWebpackPlugin({
                targetHtmlWebpackPluginId: stylesHtmlWebpackPluginId,
                customTagAttributes: customLinkAttributes
            }));
        }

        // move head assets to body
        extraPlugins.push(new CustomizeAssetsHtmlWebpackPlugin({
            targetHtmlWebpackPluginId: stylesHtmlWebpackPluginId,
            moveHeadAssetsToBody: true
        }));
    }

    // Favicons inject
    //
    const iconOptions = getIconOptions(projectRoot, appConfig);
    if (iconOptions) {

        let iconsInjectOutFileName = appConfig.htmlInjectOptions.iconsOutFileName;

        const iconHtmlSeparateOut = iconsInjectOutFileName &&
            iconsInjectOutFileName !== appConfig.htmlInjectOptions.indexOutFileName &&
            iconsInjectOutFileName !== appConfig.htmlInjectOptions.stylesOutFileName &&
            iconsInjectOutFileName !== appConfig.index;

        const iconsHtmlWebpackPluginId = iconHtmlSeparateOut
            ? 'IconsHtmlWebpackPlugin'
            : stylesHtmlWebpackPluginId;

        if (iconHtmlSeparateOut) {

            extraPlugins.push(new HtmlWebpackPlugin({
                templateContent: ' ',
                filename: path.resolve(projectRoot, appConfig.outDir, iconsInjectOutFileName),
                chunks: [],
                title: '',
                customAttributes: appConfig.htmlInjectOptions.customTagAttributes,
                inject: true,
                id: iconsHtmlWebpackPluginId
            }));
        }
        iconOptions.targetHtmlWebpackPluginId = iconsHtmlWebpackPluginId;

        // TODO:
        // Favicons plugins
        //
        let skipGenerateIcons = appConfig.skipGenerateIcons;
        if (typeof skipGenerateIcons === 'undefined' || skipGenerateIcons === null) {
            if (typeof buildOptions.skipGenerateIcons !== 'undefined' && buildOptions.skipGenerateIcons !== null) {
                skipGenerateIcons = buildOptions.skipGenerateIcons;
            } else {
                skipGenerateIcons = appConfig.referenceDll;
            }
        }
        if (!skipGenerateIcons) {
            extraPlugins.push(new IconWebpackPlugin(iconOptions));
        }
    }

    // Default inject
    //
    if (appConfig.index || appConfig.htmlInjectOptions.indexOutFileName) {
        const excludeChunks = lazyChunks.slice();
        if (separateStylesOut) {
            excludeChunks.push(...styleEntryNames);
        }

        if (appConfig.index && appConfig.index.trim()) {
            extraPlugins.push(new HtmlWebpackPlugin({
                template: path.resolve(appRoot, appConfig.index),
                filename: path.resolve(projectRoot, appConfig.outDir, appConfig.htmlInjectOptions.indexOutFileName || appConfig.index),
                chunksSortMode: packageChunkSort(chunkSortList),
                excludeChunks: excludeChunks,
                title: '',
                customAttributes: appConfig.htmlInjectOptions.customTagAttributes,
                id: defaultHtmlWebpackPluginId
            }));
        } else {
            extraPlugins.push(new HtmlWebpackPlugin({
                templateContent: ' ',
                filename: path.resolve(projectRoot, appConfig.outDir, appConfig.htmlInjectOptions.indexOutFileName || appConfig.index),
                chunksSortMode: packageChunkSort(chunkSortList),
                excludeChunks: excludeChunks,
                title: '',
                customAttributes: appConfig.htmlInjectOptions.customTagAttributes,
                id: defaultHtmlWebpackPluginId,
                inject: true
            }));

            // move head assets to body
            if (appConfig.htmlInjectOptions.customTagAttributes) {
                extraPlugins.push(new CustomizeAssetsHtmlWebpackPlugin({
                    targetHtmlWebpackPluginId: defaultHtmlWebpackPluginId,
                    moveHeadAssetsToBody: true
                }));
            }
        }

        // add dll entry - polyfills.js and vendor.js
        if (appConfig.referenceDll) {
            const manifests: { file: string; chunkName: string; }[] = [];
            manifests.push(
                {
                    file: path.resolve(projectRoot, appConfig.outDir, `${vendorChunkName}-manifest.json`),
                    chunkName: vendorChunkName
                }
            );

            if (appConfig.polyfills && appConfig.polyfills.length > 0) {
                manifests.push({
                    file: path.resolve(projectRoot, appConfig.outDir, `${polyfillsChunkName}-manifest.json`),
                    chunkName: polyfillsChunkName
                });
            }

            const dllRefScripts: string[] = manifests.map(manifest => {
                return `${manifest.chunkName}.js`;
            });

            let customScriptAttributes: any[] = [];
            if (appConfig.htmlInjectOptions.customTagAttributes) {
                customScriptAttributes = appConfig.htmlInjectOptions.customTagAttributes
                    .filter(c => c.tagName === 'script');
            }
            extraPlugins.push(new CustomizeAssetsHtmlWebpackPlugin({
                targetHtmlWebpackPluginId: defaultHtmlWebpackPluginId,
                scriptSrcToBodyAssets: dllRefScripts,
                customTagAttributes: customScriptAttributes,
                addPublicPath: true
            }));

        }

        // ** Order is import
        // custom script/link attributes
        if (appConfig.htmlInjectOptions.customTagAttributes) {
            extraPlugins.push(new CustomizeAssetsHtmlWebpackPlugin({
                targetHtmlWebpackPluginId: defaultHtmlWebpackPluginId,
                customTagAttributes: appConfig.htmlInjectOptions.customTagAttributes
            }));
        }
    }

    // remove starting slash
    extraPlugins.push(new CustomizeAssetsHtmlWebpackPlugin({
        removeStartingSlash: true
    }));

    const webpackHtmlInjectConfig: any = {
        plugins: extraPlugins
    };

    return webpackHtmlInjectConfig;
}
