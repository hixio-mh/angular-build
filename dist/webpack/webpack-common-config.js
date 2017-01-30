// see: https://webpack.js.org/configuration/
// Ref: https://github.com/AngularClass/angular2-webpack-starter
// Ref: https://github.com/MarkPieszak/aspnetcore-angular2-universal
// Ref: https://github.com/aspnet/JavaScriptServices/tree/dev/templates/Angular2Spa
// Ref: https://github.com/angular/angular-cli
"use strict";
const path = require("path");
const fs = require("fs");
// ReSharper disable InconsistentNaming
// Webpack built-in plugins
const CommonsChunkPlugin = require('webpack/lib/optimize/CommonsChunkPlugin');
const DefinePlugin = require('webpack/lib/DefinePlugin');
const DllPlugin = require('webpack/lib/DllPlugin');
const DllReferencePlugin = require('webpack/lib/DllReferencePlugin');
const IgnorePlugin = require('webpack/lib/IgnorePlugin');
const LoaderOptionsPlugin = require('webpack/lib/LoaderOptionsPlugin');
const NormalModuleReplacementPlugin = require('webpack/lib/NormalModuleReplacementPlugin');
const ProgressPlugin = require('webpack/lib/ProgressPlugin');
const ProvidePlugin = require('webpack/lib/ProvidePlugin');
const UglifyJsPlugin = require('webpack/lib/optimize/UglifyJsPlugin');
// Thrid-party plugins
const autoprefixer = require('autoprefixer');
const postcssDiscardComments = require('postcss-discard-comments');
const ExtractTextPlugin = require('extract-text-webpack-plugin');
const CompressionPlugin = require('compression-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const WebpackMd5Hash = require('webpack-md5-hash');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const webpackMerge = require('webpack-merge');
//var StatsPlugin = require('stats-webpack-plugin');
// ReSharper restore InconsistentNaming
// Internal plugins
//import { ResolvePublicPathHtmlWebpackPlugin } from './plugins/resolve-public-path-html-webpack-plugin';
const icon_webpack_plugin_1 = require("./plugins/icon-webpack-plugin");
const suppress_entry_chunks_webpack_plugin_1 = require("./plugins/suppress-entry-chunks-webpack-plugin");
const customize_assets_html_webpack_plugin_1 = require("./plugins/customize-assets-html-webpack-plugin");
const try_bundle_dll_webpack_plugin_1 = require("./plugins/try-bundle-dll-webpack-plugin");
const helpers_1 = require("./helpers");
const utils_1 = require("../utils");
function getWebpackCommonConfig(projectRoot, appConfig, buildOptions) {
    return buildOptions.dll ? getWebpackDllConfig(projectRoot, appConfig, buildOptions) : getWebpackNonDllConfig(projectRoot, appConfig, buildOptions);
}
exports.getWebpackCommonConfig = getWebpackCommonConfig;
function getWebpackDllConfig(projectRoot, appConfig, buildOptions) {
    const webpackSharedConfig = getWebpackSharedConfigPartial(projectRoot, appConfig, buildOptions);
    return webpackMerge(webpackSharedConfig, getWebpackDllConfigPartial(projectRoot, appConfig, buildOptions));
}
exports.getWebpackDllConfig = getWebpackDllConfig;
function getWebpackNonDllConfig(projectRoot, appConfig, buildOptions) {
    const ebpackSharedConfig = getWebpackSharedConfigPartial(projectRoot, appConfig, buildOptions);
    return webpackMerge(ebpackSharedConfig, getWebpackNonDllConfigPartial(projectRoot, appConfig, buildOptions));
}
exports.getWebpackNonDllConfig = getWebpackNonDllConfig;
// Partials
function getWebpackSharedConfigPartial(projectRoot, appConfig, buildOptions) {
    const appRoot = path.resolve(projectRoot, appConfig.root);
    const commonPlugins = [];
    // ProgressPlugin
    //
    if (buildOptions.progress) {
        commonPlugins.push(new ProgressPlugin());
    }
    // Generate stats
    //
    //if (emitStats) {
    //  commonPlugins.push(new StatsPlugin(path.resolve(appConfig.outDir, 'webpack-stats.json'),
    //    {
    //      chunkModules: true
    //    }));
    //}
    // Copy assets
    //
    if (typeof appConfig.assets !== 'undefined' && appConfig.assets.length && appConfig.skipCopyAssets !== false) {
        commonPlugins.push(getCopyAssetPlugin(appRoot, appConfig.assets));
    }
    // Production plugins
    //
    if (buildOptions.production) {
        const prodPlugins = [
            new WebpackMd5Hash(),
            new LoaderOptionsPlugin({ debug: false, minimize: true }),
            new UglifyJsPlugin({
                beautify: false,
                mangle: {
                    screw_ie8: true,
                    keep_fnames: true
                },
                compress: {
                    screw_ie8: true
                },
                comments: false,
                sourceMap: appConfig.sourceMap
            })
        ];
        if (appConfig.compressAssets) {
            prodPlugins.push(new CompressionPlugin({
                asset: '[path].gz[query]',
                algorithm: 'gzip',
                test: /\.js$|\.html$|\.css$/,
                threshold: 10240,
                minRatio: 0.8
            }));
        }
        // Production replacement modules
        if (appConfig.moduleReplacements && appConfig.moduleReplacements.length) {
            appConfig.moduleReplacements.forEach((entry) => {
                prodPlugins.push(new NormalModuleReplacementPlugin(new RegExp(entry.resourceRegExp, 'i'), entry.newResource));
            });
        }
        commonPlugins.push(...prodPlugins);
    }
    const webpackSharedConfig = {
        target: appConfig.target === 'node' ? 'node' : 'web',
        devtool: buildOptions.production ? false : 'source-map',
        context: projectRoot,
        output: {
            path: path.resolve(projectRoot, appConfig.outDir),
            publicPath: appConfig.publicPath,
            filename: appConfig.appendVersionHash
                ? '[name].[chunkhash].js'
                : '[name].js',
            sourceMapFilename: appConfig.appendVersionHash
                ? '[name].[chunkhash].map'
                : '[name].map',
            chunkFilename: appConfig.appendVersionHash
                ? '[id].[chunkhash].js'
                : '[id].js',
            // For dll only
            // The name of the global variable which the library's
            // require() function will be assigned to
            library: '[name]_[chunkhash]' //'[name]_lib' || '[name]_[hash]'
        },
        plugins: commonPlugins,
        // >= version 2.2
        performance: {
            hints: buildOptions.performanceHint ? 'warning' : false,
            maxAssetSize: 320000,
            maxEntrypointSize: 400000,
            assetFilter(assetFilename) {
                // Function predicate that provides asset filenames
                return assetFilename.endsWith('.css') || assetFilename.endsWith('.js');
            }
        },
        node: {
            fs: 'empty',
            global: true,
            crypto: 'empty',
            tls: 'empty',
            net: 'empty',
            process: true,
            module: false,
            clearImmediate: false,
            setImmediate: false
        },
        stats: {
            //modules: true,
            colors: true,
            hash: true,
            timings: true,
            errors: true,
            errorDetails: true,
            warnings: true,
            assets: true,
            version: true,
            publicPath: false,
            chunkModules: false,
            reasons: buildOptions.verbose,
            children: buildOptions.verbose,
            chunks: buildOptions.verbose // make sure 'chunks' is false or it will add 5-10 seconds to your build and incremental build time, due to excessive output.
        }
    };
    return webpackSharedConfig;
}
exports.getWebpackSharedConfigPartial = getWebpackSharedConfigPartial;
function getWebpackDllConfigPartial(projectRoot, appConfig, buildOptions) {
    const appRoot = path.resolve(projectRoot, appConfig.root);
    // Entry
    const entries = [];
    const dllParsedResult = helpers_1.parseDllEntries(appRoot, appConfig.dlls, buildOptions.production);
    dllParsedResult.entries.forEach((e) => {
        if (Array.isArray(e.entry)) {
            entries.push(...e.entry);
        }
        else {
            entries.push(e.entry);
        }
    });
    // TODO: add file deps
    const entryPoints = {};
    entryPoints[appConfig.dllOutChunkName] = entries;
    // Rules
    const rules = [];
    // Plugins
    const plugins = [
        new DllPlugin({
            path: path.resolve(projectRoot, appConfig.outDir, `[name]-manifest.json`),
            name: '[name]_[chunkhash]' //'[name]_lib' || [name]_[chunkhash]' || '[name]_[hash]'
        }),
        // Workaround for https://github.com/stefanpenner/es6-promise/issues/100
        new IgnorePlugin(/^vertx$/)
    ];
    // Favicons plugins
    if (typeof appConfig.faviconConfig !== 'undefined' &&
        appConfig.faviconConfig !== null &&
        appConfig.skipGenerateIcons !== false) {
        const faviconPlugins = getFaviconPlugins(projectRoot, appConfig, buildOptions.production, false);
        if (faviconPlugins.length) {
            plugins.push(...faviconPlugins);
            // remove starting slash
            plugins.push(new customize_assets_html_webpack_plugin_1.CustomizeAssetsHtmlWebpackPlugin({
                removeStartingSlash: true
            }));
        }
    }
    const webpackDllConfig = {
        resolve: {
            extensions: ['.js']
        },
        entry: entryPoints,
        output: {
            libraryTarget: appConfig.target === 'node' ? 'commonjs2' : 'var'
        },
        module: {
            rules: rules
        },
        plugins: plugins
    };
    return webpackDllConfig;
}
exports.getWebpackDllConfigPartial = getWebpackDllConfigPartial;
function getWebpackNonDllConfigPartial(projectRoot, appConfig, buildOptions) {
    let entryPoints = {};
    let extraPlugins = [];
    let extraRules = [];
    let lazyChunks = [];
    // Try bundle dlls
    if (appConfig.referenceDll) {
        // TODO: to review
        const dllManifestFile = path.resolve(projectRoot, appConfig.outDir, `${appConfig.dllOutChunkName || 'vendor'}-manifest.json`);
        const webpackDllConfig = getWebpackDllConfig(projectRoot, appConfig, buildOptions);
        extraPlugins.push(new try_bundle_dll_webpack_plugin_1.TryBundleDllWebpackPlugin({
            debug: !buildOptions.production,
            manifestFile: dllManifestFile,
            webpackDllConfig: webpackDllConfig
        }));
    }
    const nodeModulesPath = path.resolve(projectRoot, 'node_modules');
    const appRoot = path.resolve(projectRoot, appConfig.root);
    const env = helpers_1.getEnvName(buildOptions.production);
    const envLong = helpers_1.getEnvName(buildOptions.production, true);
    const metadata = {
        'ENV': JSON.stringify(envLong),
        'process.env': {
            ENV: JSON.stringify(envLong),
            NODE_ENV: JSON.stringify(process.env.NODE_ENV)
        }
    };
    // Global scripts
    //
    if (appConfig.scripts && appConfig.scripts.length > 0) {
        const globalScripts = parseGlobalScopedEntry(appConfig.scripts, appRoot, 'scripts');
        // Add entry points and lazy chunks
        globalScripts.forEach(script => {
            if (script.lazy) {
                lazyChunks.push(script.entry);
            }
            entryPoints[script.entry] = (entryPoints[script.entry] || []).concat(script.path);
        });
        // Load global scripts using script-loader
        extraRules.push({
            include: globalScripts.map((script) => script.path),
            test: /\.js$/,
            loader: 'script-loader'
        });
    }
    // Global styles
    //
    if (appConfig.styles && appConfig.styles.length > 0) {
        const globalStyles = parseGlobalScopedEntry(appConfig.styles, appRoot, 'styles');
        let extractedCssEntryPoints = [];
        // Add entry points and lazy chunks
        globalStyles.forEach(style => {
            if (style.lazy) {
                lazyChunks.push(style.entry);
            }
            if (!entryPoints[style.entry]) {
                // Since this entry point doesn't exist yet, it's going to only have
                // extracted css and we can supress the entry point
                extractedCssEntryPoints.push(style.entry);
                entryPoints[style.entry] = (entryPoints[style.entry] || []).concat(style.path);
            }
            else {
                // Existing entry point, just push the css in
                entryPoints[style.entry].push(style.path);
            }
        });
        // Create css loaders for component css and for global css
        extraRules.push(...makeCssLoaders(globalStyles.map((style) => style.path)));
        if (extractedCssEntryPoints.length > 0) {
            // Don't emit the .js entry point for extracted styles
            extraPlugins.push(new suppress_entry_chunks_webpack_plugin_1.SuppressEntryChunksWebpackPlugin({
                chunks: extractedCssEntryPoints,
                supressPattern: /\.js$/i,
                assetTagsFilterFunc: (tag) => !(tag.tagName === 'script' && tag.attributes.src && tag.attributes.src.match(/\.css$/i))
            }));
        }
    }
    else {
        // Non global styles
        // create css loaders for component css
        extraRules.push(...makeCssLoaders());
    }
    // Main entry
    //
    // Rules
    const rules = [
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
    const plugins = [
        new ExtractTextPlugin({
            filename: appConfig.appendVersionHash
                ? '[name].[chunkhash].css'
                : '[name].css',
            disable: false,
            allChunks: true
        }),
        new LoaderOptionsPlugin({
            test: /\.(css|scss|sass|less|styl)$/,
            options: {
                postcss: !buildOptions.production
                    ? [autoprefixer()]
                    : [
                        autoprefixer(),
                        postcssDiscardComments
                    ],
                cssLoader: { sourceMap: appConfig.sourceMap },
                sassLoader: { sourceMap: appConfig.sourceMap },
                lessLoader: { sourceMap: appConfig.sourceMap },
                stylusLoader: { sourceMap: appConfig.sourceMap },
                // context needed as a workaround https://github.com/jtangelder/sass-loader/issues/285
                context: projectRoot
            }
        })
    ].concat(extraPlugins);
    // Provide plugin
    //
    if (appConfig.provide && typeof appConfig.provide === 'object') {
        plugins.push(
        // NOTE: when adding more properties make sure you include them in custom-typings.d.ts
        new ProvidePlugin(appConfig.provide));
    }
    // DefinePlugin
    //
    plugins.push(
    // NOTE: when adding more properties make sure you include them in custom-typings.d.ts
    new DefinePlugin(metadata));
    // Replace environment
    //
    if (appConfig.environments && appConfig.environments[env]) {
        plugins.push(new NormalModuleReplacementPlugin(
        // This plugin is responsible for swapping the environment files.
        // Since it takes a RegExp as first parameter, we need to escape the path.
        // See https://webpack.github.io/docs/list-of-plugins.html#normalmodulereplacementplugin
        new RegExp(path.resolve(appRoot, appConfig.environments['source'])
            .replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, '\\$&')), path.resolve(appRoot, appConfig.environments[env])));
    }
    // Styles Inject
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
            plugins.push(new customize_assets_html_webpack_plugin_1.CustomizeAssetsHtmlWebpackPlugin({
                targetHtmlWebpackPluginId: stylesHtmlWebpackPluginId,
                customAttributes: customLinkAttributes
            }));
        }
        // move head assets to body
        plugins.push(new customize_assets_html_webpack_plugin_1.CustomizeAssetsHtmlWebpackPlugin({
            targetHtmlWebpackPluginId: stylesHtmlWebpackPluginId,
            moveHeadAssetsToBody: true
        }));
    }
    // Favicons inject
    if (typeof appConfig.faviconConfig !== 'undefined' &&
        appConfig.faviconConfig !== null &&
        appConfig.skipGenerateIcons !== false) {
        const faviconPlugins = getFaviconPlugins(projectRoot, appConfig, buildOptions.production, false, stylesHtmlWebpackPluginId);
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
                chunksSortMode: helpers_1.packageChunkSort(['inline', 'styles', 'scripts', appConfig.dllOutChunkName, 'main']),
                excludeChunks: excludeChunks,
                title: '',
                isDevServer: helpers_1.isWebpackDevServer(),
                metadata: metadata,
                customAttributes: appConfig.htmlInjectOptions.customTagAttributes,
                id: defaultHtmlWebpackPluginId
            }));
        }
        else {
            plugins.push(new HtmlWebpackPlugin({
                templateContent: ' ',
                filename: path.resolve(projectRoot, appConfig.outDir, appConfig.htmlInjectOptions.indexOutFileName || appConfig.index),
                chunksSortMode: helpers_1.packageChunkSort(['inline', 'styles', 'scripts', appConfig.dllOutChunkName, 'main']),
                excludeChunks: excludeChunks,
                title: '',
                customAttributes: appConfig.htmlInjectOptions.customTagAttributes,
                id: defaultHtmlWebpackPluginId,
                inject: true
            }));
            // move head assets to body
            if (appConfig.htmlInjectOptions.customTagAttributes) {
                plugins.push(new customize_assets_html_webpack_plugin_1.CustomizeAssetsHtmlWebpackPlugin({
                    targetHtmlWebpackPluginId: defaultHtmlWebpackPluginId,
                    moveHeadAssetsToBody: true
                }));
            }
        }
        // add dll entry - vendor.js
        if (appConfig.referenceDll) {
            const dllRefScript = `${appConfig.dllOutChunkName}.js`;
            let customScriptAttributes = [];
            if (appConfig.htmlInjectOptions.customTagAttributes) {
                customScriptAttributes = appConfig.htmlInjectOptions.customTagAttributes
                    .filter(c => c.tagName === 'script');
            }
            plugins.push(new customize_assets_html_webpack_plugin_1.CustomizeAssetsHtmlWebpackPlugin({
                targetHtmlWebpackPluginId: defaultHtmlWebpackPluginId,
                scriptSrcToBodyAssets: [dllRefScript],
                customAttributes: customScriptAttributes,
                addPublicPath: true
            }));
        }
        // ** Order is import
        // custom script/link attributes
        if (appConfig.htmlInjectOptions.customTagAttributes) {
            plugins.push(new customize_assets_html_webpack_plugin_1.CustomizeAssetsHtmlWebpackPlugin({
                targetHtmlWebpackPluginId: defaultHtmlWebpackPluginId,
                customAttributes: appConfig.htmlInjectOptions.customTagAttributes
            }));
        }
    }
    // remove starting slash
    plugins.push(new customize_assets_html_webpack_plugin_1.CustomizeAssetsHtmlWebpackPlugin({
        removeStartingSlash: true
    }));
    // DllReferencePlugin, CommonsChunkPlugin
    //
    if (appConfig.referenceDll) {
        if (appConfig.target === 'node') {
            plugins.push(new DllReferencePlugin({
                context: projectRoot,
                sourceType: 'commonjs2',
                manifest: require(path.resolve(projectRoot, appConfig.outDir, `${appConfig.dllOutChunkName}-manifest.json`)),
                name: `./${appConfig.dllOutChunkName}`
            }));
        }
        else {
            plugins.push(new DllReferencePlugin({
                context: projectRoot,
                manifest: require(path.resolve(projectRoot, appConfig.outDir, `${appConfig.dllOutChunkName}-manifest.json`))
            }));
        }
        plugins.push(new CommonsChunkPlugin({
            minChunks: Infinity,
            name: 'inline'
        }));
    }
    else {
        plugins.push(new CommonsChunkPlugin({
            minChunks: Infinity,
            name: 'inline'
        }));
        // This enables tree shaking of the vendor modules
        plugins.push(new CommonsChunkPlugin({
            name: appConfig.dllOutChunkName,
            chunks: ['main'],
            minChunks: (module) => module.userRequest && module.userRequest.startsWith(nodeModulesPath)
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
exports.getWebpackNonDllConfigPartial = getWebpackNonDllConfigPartial;
// Private methods
function getFaviconPlugins(projectRoot, appConfig, isProduction, emitStats, targetHtmlWebpackPluginId) {
    const appRoot = path.resolve(projectRoot, appConfig.root);
    const plugins = [];
    let iconConfig = null;
    if (typeof appConfig.faviconConfig === 'string' && appConfig.faviconConfig.match(/\.json$/i)) {
        iconConfig = utils_1.readJsonSync(path.resolve(appRoot, appConfig.faviconConfig));
    }
    if (!iconConfig || !iconConfig.masterPicture) {
        return plugins;
    }
    iconConfig.masterPicture = path.resolve(appRoot, iconConfig.masterPicture);
    if (!iconConfig.iconsPath) {
        iconConfig.iconsPath = appConfig.appendVersionHash
            ? 'icons-[hash]/'
            : 'icons/';
    }
    if (!iconConfig.statsFilename) {
        iconConfig.statsFilename = appConfig.appendVersionHash
            ? 'iconstats-[hash].json'
            : 'iconstats.json';
    }
    if (typeof iconConfig.emitStats === 'undefined') {
        iconConfig.emitStats = emitStats;
    }
    let iconsInjectOutFileName = null;
    if (appConfig.htmlInjectOptions && appConfig.htmlInjectOptions.iconsOutFileName) {
        iconsInjectOutFileName = appConfig.htmlInjectOptions.iconsOutFileName;
    }
    const iconHtmlSeparateOut = iconsInjectOutFileName !== null &&
        ((iconsInjectOutFileName !== appConfig.htmlInjectOptions.indexOutFileName) ||
            (iconsInjectOutFileName !== appConfig.index));
    if (typeof iconConfig.inject === 'undefined') {
        if (appConfig.index || appConfig.htmlInjectOptions.indexOutFileName || iconHtmlSeparateOut) {
            iconConfig.inject = true;
        }
        else {
            iconConfig.inject = true;
        }
    }
    const iconsHtmlWebpackPluginId = (iconConfig.inject && iconHtmlSeparateOut)
        ? 'IconsHtmlWebpackPlugin'
        : targetHtmlWebpackPluginId;
    let seperateOutput = false;
    // Seperate inject output
    if (iconConfig.inject && iconHtmlSeparateOut) {
        seperateOutput = true;
        plugins.push(new HtmlWebpackPlugin({
            templateContent: ' ',
            filename: path.resolve(projectRoot, appConfig.outDir, iconsInjectOutFileName),
            chunks: [],
            title: '',
            customAttributes: appConfig.htmlInjectOptions.customTagAttributes,
            inject: true,
            id: iconsHtmlWebpackPluginId
        }));
    }
    iconConfig.targetHtmlWebpackPluginId = iconsHtmlWebpackPluginId;
    iconConfig.seperateOutput = seperateOutput;
    plugins.push(new icon_webpack_plugin_1.IconWebpackPlugin(iconConfig));
    return plugins;
}
function getCopyAssetPlugin(baseDir, assetEntry) {
    let assets = [];
    const prepareFormGlob = (p) => {
        if (!p) {
            return '';
        }
        if (p.lastIndexOf('*') === -1 && !path.isAbsolute(p) &&
            fs.existsSync(path.resolve(baseDir, p)) &&
            fs.statSync(path.resolve(baseDir, p)).isDirectory()) {
            if (p.lastIndexOf('/') > -1) {
                p = p.substring(0, p.length - 1);
            }
            p += '/**/*';
        }
        return p;
    };
    if (Array.isArray(assetEntry)) {
        assets = assetEntry.map((asset) => {
            if (typeof asset === 'string') {
                const fromGlob = prepareFormGlob(asset);
                return {
                    from: {
                        glob: fromGlob,
                        dot: true
                    },
                    context: baseDir
                };
            }
            else if (typeof asset === 'object' && asset.from) {
                if (!asset.context) {
                    asset.context = baseDir;
                }
                if (typeof asset.from === 'string') {
                    const fromGlob = prepareFormGlob(asset.from);
                    asset.from = {
                        glob: fromGlob,
                        dot: true
                    };
                }
                return asset;
            }
            else {
                throw new Error(`Invalid 'assets' value in appConfig.`);
            }
        });
    }
    else if (typeof assetEntry === 'string') {
        const fromGlob = prepareFormGlob(assetEntry);
        assets = [{
                from: {
                    glob: fromGlob,
                    dot: true
                },
                context: baseDir
            }];
    }
    const plugin = new CopyWebpackPlugin(assets, {
        ignore: ['**/.gitkeep']
    });
    return plugin;
}
// create array of css loaders
// Ref: https://github.com/angular/angular-cli
function makeCssLoaders(stylePaths = []) {
    const baseRules = [
        { test: /\.css$/, loaders: [] },
        { test: /\.scss$|\.sass$/, loaders: ['sass-loader'] },
        { test: /\.less$/, loaders: ['less-loader'] },
        { test: /\.styl$/, loaders: ['stylus-loader'] }
    ];
    const commonLoaders = ['postcss-loader'];
    // load component css as raw strings
    const cssLoaders = baseRules.map(({ test, loaders }) => ({
        exclude: stylePaths, test, loaders: ['raw-loader'].concat(commonLoaders).concat(loaders)
    }));
    if (stylePaths && stylePaths.length > 0) {
        // load global css as css files
        cssLoaders.push(...baseRules.map(({ test, loaders }) => ({
            include: stylePaths, test, loaders: ExtractTextPlugin.extract({
                remove: false,
                loader: ['css-loader'].concat(commonLoaders).concat(loaders),
                fallbackLoader: 'style-loader'
            })
        })));
    }
    return cssLoaders;
}
// convert all extra entries into the object representation, fill in defaults
// Ref: https://github.com/angular/angular-cli
function parseGlobalScopedEntry(extraEntries, appRoot, defaultEntry) {
    if (!extraEntries || !extraEntries.length) {
        return [];
    }
    const arrayEntries = Array.isArray(extraEntries) ? extraEntries : [extraEntries];
    return arrayEntries
        .map((extraEntry) => typeof extraEntry === 'string' ? { input: extraEntry } : extraEntry)
        .map((extraEntry) => {
        extraEntry.path = path.resolve(appRoot, extraEntry.input);
        if (extraEntry.output) {
            extraEntry.entry = extraEntry.output.replace(/\.(js|css)$/i, '');
        }
        else if (extraEntry.lazy) {
            extraEntry.entry = extraEntry.input.replace(/\.(js|css|scss|sass|less|styl)$/i, '');
        }
        else {
            extraEntry.entry = defaultEntry;
        }
        return extraEntry;
    });
}
//# sourceMappingURL=webpack-common-config.js.map