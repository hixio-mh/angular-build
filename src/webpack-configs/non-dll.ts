import * as path from 'path';
import * as webpack from 'webpack';
import * as chalk from 'chalk';

// ReSharper disable InconsistentNaming
const CommonsChunkPlugin = webpack.optimize.CommonsChunkPlugin;
const DefinePlugin = webpack.DefinePlugin;
const NormalModuleReplacementPlugin = webpack.NormalModuleReplacementPlugin;
const ProvidePlugin = webpack.ProvidePlugin;

const HtmlWebpackPlugin = require('html-webpack-plugin');
const webpackMerge = require('webpack-merge');
// ReSharper restore InconsistentNaming

// Models
import { AppConfig, BuildOptions } from '../models';

// Helpers
import { parseDllEntries, getEnvName, packageChunkSort, isWebpackDevServer, lazyChunksFilter, parseGlobalScopedEntry } from './helpers';

// Internal plugins
import { CustomizeAssetsHtmlWebpackPlugin } from '../plugins/customize-assets-html-webpack-plugin';
import { TryBundleDllWebpackPlugin } from '../plugins/try-bundle-dll-webpack-plugin';

import { getCommonConfigPartial } from './common';
import { getAngularConfigPartial } from './angular';
import { getStylesConfigPartial } from './styles';
import { getDllConfig } from './dll';

import { getFaviconPlugins } from './favicons';

export function getNonDllConfig(projectRoot: string, appConfig: AppConfig, buildOptions: BuildOptions) {
    console.log(`\n${chalk.bgBlue('INFO:')} Using non-dll config, production: ${buildOptions.production}, aot: ${buildOptions
        .aot}, referenceDll: ${appConfig.referenceDll}\n`);
    //console.log(`${chalk.bold('projectRoot')}:\n${projectRoot}\n`);
    //console.log(`${chalk.bold('appConfig')}:\n${JSON.stringify(appConfig, null, 2)}\n`);
    //console.log(`${chalk.bold('buildOptions')}:\n${JSON.stringify(buildOptions, null, 2)}\n`);

    const nodeModulesPath = path.resolve(projectRoot, 'node_modules');
    //const appRoot = path.resolve(projectRoot, appConfig.root);

    const configs = [
        getCommonConfigPartial(projectRoot, appConfig, buildOptions),
        getNonDllConfigPartial(projectRoot, appConfig, buildOptions),
        getAngularConfigPartial(projectRoot, appConfig, buildOptions),
        {
            resolve: {
                extensions: ['.ts', '.js'],
                modules: [nodeModulesPath]
                //modules: [appRoot, nodeModulesPath]
            },
            resolveLoader: {
                modules: [nodeModulesPath]
            }
        }
    ];

    return webpackMerge(configs);
}

export function getNonDllConfigPartial(projectRoot: string, appConfig: AppConfig, buildOptions: BuildOptions) {
    const nodeModulesPath = path.resolve(projectRoot, 'node_modules');
    const appRoot = path.resolve(projectRoot, appConfig.root);

    let entryPoints: { [key: string]: string[] } = {};
    const extraPlugins: any[] = [];
    const extraRules: any[] = [];

    const env = getEnvName(buildOptions.production);
    const envLong = getEnvName(buildOptions.production, true);

    var metadata = {
        'ENV': JSON.stringify(envLong),
        'process.env': {
            'production': buildOptions.production,
            'ENV': JSON.stringify(envLong),
            'NODE_ENV': JSON.stringify(process.env.NODE_ENV)
        }
    };

    const vendorChunkName = appConfig.dllChunkName || 'vendor';
    const polyfillsChunkName = 'polyfills';
    const manifests: { file: string; chunkName: string; }[] = [];

    // Try bundle dlls
    //
    if (appConfig.referenceDll) {
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

    // figure out which are the lazy loaded entry points
    const allGlobalScopedEntry = [...parseGlobalScopedEntry(appConfig.scripts, appRoot, 'scripts')]
        .concat(parseGlobalScopedEntry(appConfig.styles, appRoot, 'styles'));
    const lazyChunks = lazyChunksFilter(allGlobalScopedEntry);

    // Main and polyfills entries
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
            parseDllEntries(projectRoot, appConfig.root, appConfig.polyfills, envLong).forEach(e => {
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

    if (appConfig.main && appConfig.main.trim().length) {
        const appMain = path.resolve(projectRoot, appConfig.root, appConfig.main);
        if (appConfig.dlls && appConfig.dlls.length) {
            appConfig.dlls.filter(e => typeof e === 'object' && e.importToMain).forEach(e => dllEntries.push(e));
        }

        const entries: string[] = [];
        parseDllEntries(projectRoot, appConfig.root, dllEntries, envLong).forEach(e => {
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

    // Global Styles
    //
    const styleConfig = getStylesConfigPartial(projectRoot, appConfig, buildOptions);
    const styleEntryPoints = styleConfig.entry;
    entryPoints = Object.assign(entryPoints, styleEntryPoints || {});
    extraRules.push(...styleConfig.module.rules);
    extraPlugins.push(...styleConfig.plugins);

    // ['inline', 'styles', 'scripts', appConfig.dllChunkName, 'main']
    const chunkSortList = ['inline', 'styles'];
    Object.keys(styleEntryPoints || {}).forEach((key: string) => {
        if (chunkSortList.indexOf(key) === -1) {
            chunkSortList.push(key);
        }
    });
    chunkSortList.push('scripts');

    // Global scripts
    //
    if (appConfig.scripts && appConfig.scripts.length > 0) {
        const globalScripts = parseGlobalScopedEntry(appConfig.scripts, appRoot, 'scripts');

        // add entry points and lazy chunks
        globalScripts.forEach(script => {
            const scriptPath = `script-loader!${script.path}`;
            //if (script.lazy) {
            //     lazyChunks.push(script.entry);
            //}

            entryPoints[script.entry] = (entryPoints[script.entry] || []).concat(scriptPath);

            if (chunkSortList.indexOf(script.entry) === -1) {
                chunkSortList.push(script.entry);
            }
        });
    }

    chunkSortList.push(polyfillsChunkName);
    chunkSortList.push(vendorChunkName);
    chunkSortList.push('main');

    // Rules
    //
    const rules: any = [
        // js source map
        {
            enforce: 'pre',
            test: /\.js$/,
            use: 'source-map-loader',
            exclude: [nodeModulesPath]
        },

        // .json files are now supported without the json-loader, webpack >= 2.2
        {
            test: /\.json$/,
            use: 'json-loader'
        },

        // html
        {
            test: /\.html$/,
            use: 'raw-loader',
            exclude: [path.resolve(projectRoot, appConfig.root, appConfig.index || 'index.html')]
        },

        // font loaders
        {
            test: /\.(otf|ttf|woff|woff2)(\?v=\d+\.\d+\.\d+)?$/,
            use: 'url-loader?limit=10000&name=assets/[name].[ext]'
        },
        {
            test: /\.eot(\?v=\d+\.\d+\.\d+)?$/,
            use: 'file-loader?name=assets/[name].[ext]'
        },

        // Image loaders
        {
            test: /\.(jpg|png|gif)$/,
            use: 'url-loader?limit=10000&name=assets/[name].[ext]'
        },
        {
            test: /\.(jpe?g|png|gif|svg)(\?{0}(?=\?|$))/,
            use: [
                'file-loader?name=assets/[name].[ext]',
                {
                    loader: 'image-webpack-loader',
                    options: {
                        progressive: true,
                        optimizationLevel: 7,
                        interlaced: false
                    }
                }
            ]
        }
    ].concat(extraRules);

    // Plugins
    const plugins: any = [
    ].concat(extraPlugins);

    // Provide plugin
    //
    if (appConfig.provide && typeof appConfig.provide === 'object' && Object.keys(appConfig.provide).length > 0) {
        plugins.push(
            // NOTE: when adding more properties make sure you include them in custom-typings.d.ts
            new ProvidePlugin(appConfig.provide)
        );
    }

    // DefinePlugin
    //
    plugins.push(
        // NOTE: when adding more properties make sure you include them in custom-typings.d.ts
        new DefinePlugin(metadata)
    );

    // Replace environment
    //
    if (appConfig.environments && (appConfig.environments[env] || appConfig.environments[envLong])) {
        plugins.push(new NormalModuleReplacementPlugin(
            // This plugin is responsible for swapping the environment files.
            // Since it takes a RegExp as first parameter, we need to escape the path.
            // See https://webpack.github.io/docs/list-of-plugins.html#normalmodulereplacementplugin
            new RegExp(path.resolve(appRoot, appConfig.environments['source'])
                .replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, '\\$&')),
            path.resolve(appRoot, appConfig.environments[env] || appConfig.environments[envLong])
        ));
    }

    // Styles Inject
    //
    let separateStylesOut = false;
    if (appConfig.htmlInjectOptions.stylesOutFileName &&
        appConfig.extractCss &&
        styleEntryPoints && Object.keys(styleEntryPoints).length > 0) {
        separateStylesOut = true;
    }

    const stylesHtmlWebpackPluginId = separateStylesOut ? 'StylesHtmlWebpackPlugin' : null;
    if (separateStylesOut || appConfig.htmlInjectOptions.stylesOutFileName) {
        plugins.push(new HtmlWebpackPlugin({
            templateContent: ' ',
            filename: path.resolve(projectRoot, appConfig.outDir, appConfig.htmlInjectOptions.stylesOutFileName),
            title: '',
            excludeChunks: lazyChunks,
            chunks: separateStylesOut ? Object.keys(styleEntryPoints || {}) : [],
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
            plugins.push(new CustomizeAssetsHtmlWebpackPlugin({
                targetHtmlWebpackPluginId: stylesHtmlWebpackPluginId,
                customTagAttributes: customLinkAttributes
            }));
        }

        // move head assets to body
        plugins.push(new CustomizeAssetsHtmlWebpackPlugin({
            targetHtmlWebpackPluginId: stylesHtmlWebpackPluginId,
            moveHeadAssetsToBody: true
        }));
    }

    // Favicons inject
    //
    let skipGenerateIcons = appConfig.skipGenerateIcons;
    if (typeof appConfig.skipGenerateIcons === 'undefined' || appConfig.skipGenerateIcons === null) {
        if (typeof buildOptions.skipGenerateIcons !== 'undefined' && buildOptions.skipGenerateIcons !== null) {
            skipGenerateIcons = buildOptions.skipGenerateIcons;
        } else {
            skipGenerateIcons = !buildOptions.dll && !buildOptions.production && appConfig.referenceDll;
        }
    }

    if (typeof appConfig.faviconConfig !== 'undefined' &&
        appConfig.faviconConfig !== null &&
        !skipGenerateIcons) {
        const faviconPlugins = getFaviconPlugins(projectRoot,
            appConfig,
            stylesHtmlWebpackPluginId);
        if (faviconPlugins.length) {
            plugins.push(...faviconPlugins);
        }
    }

    // Default inject
    if (appConfig.index || appConfig.htmlInjectOptions.indexOutFileName) {
        const defaultHtmlWebpackPluginId = 'DefaultHtmlWebpackPlugin';
        const excludeChunks = lazyChunks.slice();
        if (separateStylesOut) {
            excludeChunks.push(...Object.keys(styleEntryPoints));
        }

        if (appConfig.index && appConfig.index.trim()) {
            plugins.push(new HtmlWebpackPlugin({
                template: path.resolve(appRoot, appConfig.index),
                filename: path.resolve(projectRoot, appConfig.outDir, appConfig.htmlInjectOptions.indexOutFileName || appConfig.index),
                chunksSortMode: packageChunkSort(chunkSortList),
                excludeChunks: excludeChunks,
                title: '',
                isDevServer: isWebpackDevServer(),
                metadata: metadata,
                customAttributes: appConfig.htmlInjectOptions.customTagAttributes,
                id: defaultHtmlWebpackPluginId
                //hash: false,
                //favicon: false,
                //minify: false,
                //cache: true,
                //compile: true,
                //chunks: "all",
                //inject: 'body' //'head' || 'body' || true || false
            }));
        } else {
            plugins.push(new HtmlWebpackPlugin({
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
                plugins.push(new CustomizeAssetsHtmlWebpackPlugin({
                    targetHtmlWebpackPluginId: defaultHtmlWebpackPluginId,
                    moveHeadAssetsToBody: true
                }));
            }
        }

        // add dll entry - polyfills.js and vendor.js
        if (appConfig.referenceDll) {
            const dllRefScripts: string[] = manifests.map(manifest => {
                return `${manifest.chunkName}.js`;
            });

            let customScriptAttributes: any[] = [];
            if (appConfig.htmlInjectOptions.customTagAttributes) {
                customScriptAttributes = appConfig.htmlInjectOptions.customTagAttributes
                    .filter(c => c.tagName === 'script');
            }
            plugins.push(new CustomizeAssetsHtmlWebpackPlugin({
                targetHtmlWebpackPluginId: defaultHtmlWebpackPluginId,
                scriptSrcToBodyAssets: dllRefScripts,
                customTagAttributes: customScriptAttributes,
                addPublicPath: true
            }));

        }

        // ** Order is import
        // custom script/link attributes
        if (appConfig.htmlInjectOptions.customTagAttributes) {
            plugins.push(new CustomizeAssetsHtmlWebpackPlugin({
                targetHtmlWebpackPluginId: defaultHtmlWebpackPluginId,
                customTagAttributes: appConfig.htmlInjectOptions.customTagAttributes
            }));
        }
    }

    // remove starting slash
    plugins.push(new CustomizeAssetsHtmlWebpackPlugin({
        removeStartingSlash: true
    }));

    // DllReferencePlugin, CommonsChunkPlugin
    //
    if (appConfig.referenceDll) {
        plugins.push(new CommonsChunkPlugin({
            minChunks: Infinity,
            name: 'inline'
        }));

    } else {
        plugins.push(new CommonsChunkPlugin({
            minChunks: Infinity,
            name: 'inline'
        }));

        // This enables tree shaking of the vendor modules
        plugins.push(new CommonsChunkPlugin({
            name: vendorChunkName,
            chunks: ['main'],
            minChunks: (module: any) => module.resource && module.resource.startsWith(nodeModulesPath)
            // minChunks: (module: any) => module.userRequest && module.userRequest.startsWith(nodeModulesPath)
            // minChunks: module => /node_modules/.test(module.resource)
        }));
    }

    const webpackNonDllConfig = {
        entry: entryPoints,
        module: {
            rules: rules
        },
        plugins: plugins
    };

    return webpackNonDllConfig;
}