import * as path from 'path';

// ReSharper disable InconsistentNaming
const CommonsChunkPlugin = require('webpack/lib/optimize/CommonsChunkPlugin');
const DefinePlugin = require('webpack/lib/DefinePlugin');
const NormalModuleReplacementPlugin = require('webpack/lib/NormalModuleReplacementPlugin');
const ProvidePlugin = require('webpack/lib/ProvidePlugin');

const HtmlWebpackPlugin = require('html-webpack-plugin');
const webpackMerge = require('webpack-merge');

// ReSharper restore InconsistentNaming

// Models
import { AppConfig, BuildOptions} from '../models';

// Helpers
import { parseDllEntries, getEnvName, packageChunkSort, isWebpackDevServer, lazyChunksFilter, parseGlobalScopedEntry} from './helpers';

// Internal plugins
import { CustomizeAssetsHtmlWebpackPlugin } from '../plugins/customize-assets-html-webpack-plugin';
import { TryBundleDllWebpackPlugin } from '../plugins/try-bundle-dll-webpack-plugin';

import { getCommonConfigPartial } from './common';
import { getAngularConfigPartial } from './angular';
import { getStylesConfigPartial } from './styles';
import { getDllConfig } from './dll';

import { getFaviconPlugins } from './favicons';


export function getNonDllConfig(projectRoot: string, appConfig: AppConfig, buildOptions: BuildOptions) {
    const configs = [
        getCommonConfigPartial(projectRoot, appConfig, buildOptions),
        getNonDllConfigPartial(projectRoot, appConfig, buildOptions),
        getAngularConfigPartial(projectRoot, appConfig, buildOptions),
        getStylesConfigPartial(projectRoot, appConfig, buildOptions)
    ];

    return webpackMerge(configs);
}

export function getNonDllConfigPartial(projectRoot: string, appConfig: AppConfig, buildOptions: BuildOptions) {
    const nodeModulesPath = path.resolve(projectRoot, 'node_modules');
    const appRoot = path.resolve(projectRoot, appConfig.root);

    const entryPoints: { [key: string]: string[] } = {};
    const extraPlugins: any[] = [];
    const extraRules: any[] = [];

    const env = getEnvName(buildOptions.production);
    const envLong = getEnvName(buildOptions.production, true);
    const metadata = {
        'ENV': JSON.stringify(envLong),
        'process.env': {
            ENV: JSON.stringify(envLong),
            NODE_ENV: JSON.stringify(process.env.NODE_ENV)
        }
    };

    // Try bundle dlls
    //
    if (appConfig.referenceDll) {
        const dllManifestFile = path.resolve(projectRoot, appConfig.outDir, `${appConfig.dllChunkName || 'vendor'}-manifest.json`);
        const cloneAppConfig = Object.assign({}, appConfig);
        const cloneBuildOptions = Object.assign({}, buildOptions);
        cloneBuildOptions.dll = true;
        const webpackDllConfig = getDllConfig(projectRoot, cloneAppConfig, cloneBuildOptions);
        extraPlugins.push(new TryBundleDllWebpackPlugin({
            context: projectRoot,
            debug: !cloneBuildOptions.production,
            manifestFile: dllManifestFile,
            webpackDllConfig: webpackDllConfig,
            chunkName: cloneAppConfig.dllChunkName
        }));
    }

    // figure out which are the lazy loaded entry points
    const allGlobalScopedEntry = [...parseGlobalScopedEntry(appConfig.scripts, appRoot, 'scripts')]
        .concat(parseGlobalScopedEntry(appConfig.styles, appRoot, 'styles'));
    const lazyChunks = lazyChunksFilter(allGlobalScopedEntry);

    // Main entry
    if (appConfig.main) {
        const appMain = path.resolve(projectRoot, appConfig.root, appConfig.main);

        const dllEntries: any[] = [];
        if (appConfig.polyfills) {
            if (Array.isArray(appConfig.polyfills)) {
                dllEntries.push(...appConfig.polyfills);
            } else {
                dllEntries.push(appConfig.polyfills);
            }
        }
        if (appConfig.dlls) {
            appConfig.dlls.filter(e => typeof e === 'object' && e.importToMain).forEach(e => dllEntries.push(e));
        }

        const entries: string[] = [];
        parseDllEntries(appRoot, dllEntries, buildOptions.production).forEach(e => {
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

        entryPoints['main'] = entries.concat([appMain]);
    }

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
        });
        //const globalScripts = parseGlobalScopedEntry(appConfig.scripts, appRoot, 'scripts');

        //// Add entry points and lazy chunks
        //globalScripts.forEach(script => {
        //    if (script.lazy) {
        //        lazyChunks.push(script.entry);
        //    }
        //    entryPoints[script.entry] = (entryPoints[script.entry] || []).concat(script.path);
        //});

        //// Load global scripts using script-loader
        //extraRules.push({
        //    include: globalScripts.map((script) => script.path),
        //    test: /\.js$/,
        //    loader: 'script-loader'
        //});
    }

    // Rules
    //
    const rules: any = [
        // js source map
        {
            enforce: 'pre',
            test: /\.js$/,
            loader: 'source-map-loader',
            exclude: [nodeModulesPath]
        },

        // .json files are now supported without the json-loader, webpack >= 2.2
        {
            test: /\.json$/,
            loader: 'json-loader'
        },

        // html
        {
            test: /\.html$/,
            loader: 'raw-loader',
            exclude: [path.resolve(projectRoot, appConfig.root, appConfig.index || 'index.html')]
        },

        // font loaders
        {
            test: /\.(otf|ttf|woff|woff2)(\?v=\d+\.\d+\.\d+)?$/,
            loader: 'url-loader?limit=10000&name=assets/[name].[ext]'
        },
        {
            test: /\.eot(\?v=\d+\.\d+\.\d+)?$/,
            loader: 'file-loader?name=assets/[name].[ext]'
        },

        // Image loaders
        {
            test: /\.(jpg|png|gif)$/,
            loader: 'url-loader?limit=10000&name=assets/[name].[ext]'
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
    if (appConfig.provide && typeof appConfig.provide === 'object') {
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
    const separateStylesOut = appConfig.htmlInjectOptions.stylesOutFileName && entryPoints['styles'];
    const stylesHtmlWebpackPluginId = separateStylesOut ? 'StylesHtmlWebpackPlugin' : null;
    if (separateStylesOut) {
        plugins.push(new HtmlWebpackPlugin({
            templateContent: ' ',
            filename: path.resolve(projectRoot, appConfig.outDir, appConfig.htmlInjectOptions.stylesOutFileName),
            title: '',
            chunks: ['styles'],
            customAttributes: appConfig.htmlInjectOptions.customTagAttributes,
            inject: true,
            id: stylesHtmlWebpackPluginId
        }));

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
    if (typeof appConfig.faviconConfig !== 'undefined' &&
        appConfig.faviconConfig !== null &&
        appConfig.skipGenerateIcons !== false) {
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
        const excludeChunks = lazyChunks;
        if (separateStylesOut) {
            excludeChunks.push('styles');
        }

        if (appConfig.index && appConfig.index.trim()) {
            plugins.push(new HtmlWebpackPlugin({
                template: path.resolve(appRoot, appConfig.index),
                filename: path.resolve(projectRoot, appConfig.outDir, appConfig.htmlInjectOptions.indexOutFileName || appConfig.index),
                chunksSortMode: packageChunkSort(['inline', 'styles', 'scripts', appConfig.dllChunkName, 'main']),
                excludeChunks: excludeChunks,
                title: '',
                isDevServer: isWebpackDevServer(),
                metadata: metadata,
                customAttributes: appConfig.htmlInjectOptions.customTagAttributes,
                id: defaultHtmlWebpackPluginId
                //hot:
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
                chunksSortMode: packageChunkSort(['inline', 'styles', 'scripts', appConfig.dllChunkName, 'main']),
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

        // add dll entry - vendor.js
        if (appConfig.referenceDll) {
            const dllRefScript = `${appConfig.dllChunkName}.js`;
            let customScriptAttributes: any[] = [];
            if (appConfig.htmlInjectOptions.customTagAttributes) {
                customScriptAttributes = appConfig.htmlInjectOptions.customTagAttributes
                    .filter(c => c.tagName === 'script');
            }
            plugins.push(new CustomizeAssetsHtmlWebpackPlugin({
                targetHtmlWebpackPluginId: defaultHtmlWebpackPluginId,
                scriptSrcToBodyAssets: [dllRefScript],
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
            name: appConfig.dllChunkName,
            chunks: ['main'],
            minChunks: (module: any) => module.resource && module.resource.startsWith(nodeModulesPath)
            //minChunks: (module: any) => module.userRequest && module.userRequest.startsWith(nodeModulesPath)
        }));
    }

    const webpackNonDllConfig = {
        resolve: {
            extensions: ['.js', '.json'],
            modules: [appRoot, nodeModulesPath]
        },
        entry: entryPoints,
        module: {
            rules: rules
        },
        plugins: plugins
    };

    return webpackNonDllConfig;
}