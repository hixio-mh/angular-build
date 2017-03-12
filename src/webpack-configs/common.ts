import * as path from 'path';
import * as fs from 'fs';
import * as webpack from 'webpack';

// Plugins
// ReSharper disable InconsistentNaming
const OptimizeJsPlugin = require('optimize-js-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
// ReSharper restore InconsistentNaming

// Models
import { AppConfig, BuildOptions, ModuleReplacementEntry } from '../models';

// Helpers
import { parseCopyAssetEntry, getWebpackStatsConfig, isWebpackDevServer } from '../helpers';


/**
 * Enumerate loaders and their dependencies from this file to let the dependency validator
 * know they are used.
 *
 * require('source-map-loader')
 * require('raw-loader')
 * require('url-loader')
 * require('file-loader')
 */

export function getCommonConfigPartial(projectRoot: string, appConfig: AppConfig, buildOptions: BuildOptions) {
    const appRoot = path.resolve(projectRoot, appConfig.root);

    const nodeModulesPath = path.resolve(projectRoot, 'node_modules');
    let emptyModulePath = path.resolve(projectRoot, 'empty.js');
    if (!fs.existsSync(emptyModulePath)) {
        emptyModulePath = require.resolve('../../empty.js');
    }

    const fileHashFormat = appConfig.appendOutputHash ? '.[hash]' : '';
    const chunkHashFormat = appConfig.appendOutputHash ? '.[chunkhash]' : '';

    var metadata = {
        'ENV': JSON.stringify(buildOptions.environment),
        'process.env': {
            'production': buildOptions.production,
            'ENV': JSON.stringify(buildOptions.environment),
            'NODE_ENV': JSON.stringify(process.env.NODE_ENV)
        }
    };


    const commonRules: any[] = [
        {
            enforce: 'pre',
            test: /\.js$/,
            use: 'source-map-loader',
            exclude: [nodeModulesPath]
        },
        //{
        //    test: /\.json$/,
        //    use: 'json-loader',
        //    exclude: [path.resolve(projectRoot, appConfig.root, 'index.html')]
        //},
        {
            test: /\.html$/,
            use: 'raw-loader',
            exclude: [path.resolve(projectRoot, appConfig.root, 'index.html')]
        },
        // Font files of all types
        {
            test: /\.(otf|ttf|woff|woff2)(\?v=\d+\.\d+\.\d+)?$/,
            use: `url-loader?limit=10000&name=assets/[name]${fileHashFormat}.[ext]`
        },
        {
            test: /\.eot(\?v=\d+\.\d+\.\d+)?$/,
            use: `file-loader?name=assets/[name]${fileHashFormat}.[ext]`
        },
        // Image loaders
        {
            test: /\.(jpg|png|gif|cur|ani)$/,
            use: `url-loader?limit=25000&name=assets/[name]${fileHashFormat}.[ext]`
        },
        // SVG files
        //{
        //    test: /\.svg(\?v=\d+\.\d+\.\d+)?$/,
        //    use: `url-loader?limit=25000&mimetype=image/svg+xml`
        //},
        {
            test: /\.svg(\?v=\d+\.\d+\.\d+)?$/,
            use: `file-loader?name=assets/[name]${fileHashFormat}.[ext]`
        }
        //{
        //    test: /\.(jpe?g|png|gif|svg)(\?{0}(?=\?|$))/,
        //    use: [
        //        'file-loader?name=assets/[name].[ext]',
        //        {
        //            loader: 'image-webpack-loader',
        //            options: {
        //                progressive: true,
        //                optimizationLevel: 7,
        //                interlaced: false
        //            }
        //        }
        //    ]
        //}
    ];

    const commonPlugins: any[] = [
        new webpack.NoEmitOnErrorsPlugin()
    ];

    // ProgressPlugin
    //
    if (buildOptions.progress) {
        commonPlugins.push(new (<any>webpack).ProgressPlugin({ profile: buildOptions.verbose, colors: true }));
    }

    // Copy assets
    //
    let skipCopyAssets = appConfig.skipCopyAssets;
    if (typeof skipCopyAssets === 'undefined' || skipCopyAssets === null) {
        if (typeof buildOptions.skipCopyAssets !== 'undefined' && buildOptions.skipCopyAssets !== null) {
            skipCopyAssets = buildOptions.skipCopyAssets;
        } else {
            skipCopyAssets = !buildOptions.dll && !buildOptions.production && appConfig.referenceDll;
        }
    }
    if (typeof appConfig.assets !== 'undefined' && appConfig.assets.length > 0 && !skipCopyAssets) {
        const copyAssetOptions = parseCopyAssetEntry(appRoot, appConfig.assets);
        if (copyAssetOptions && copyAssetOptions.length > 0) {
            commonPlugins.push(new CopyWebpackPlugin(copyAssetOptions,
                {
                    ignore: ['**/.gitkeep']
                    //copyUnmodified: false
                }));
        }
    }

    //if (appConfig.compressAssets) {
    //    commonPlugins.push(new CompressionPlugin({
    //        asset: '[path].gz[query]',
    //        algorithm: 'gzip',
    //        test: /\.js$|\.html$|\.css$/,
    //        threshold: 10240
    //    }));
    //}

    // module replacement
    //
    if (appConfig.moduleReplacements && appConfig.moduleReplacements.length > 0) {
        appConfig.moduleReplacements
            .filter((entry: ModuleReplacementEntry) => entry.resourceRegExp)
            .forEach((entry: ModuleReplacementEntry) => {
                let newPath = emptyModulePath;
                if (entry.newResource) {
                    newPath = path.resolve(projectRoot, entry.newResource);
                }
                commonPlugins.push(new webpack.NormalModuleReplacementPlugin(
                    new RegExp(entry.resourceRegExp, 'i'),
                    newPath
                ));
            });
    }

    // Production plugins
    //
    if (buildOptions.production) {
        const prodPlugins: any[] = [
            new webpack.LoaderOptionsPlugin({ debug: false, minimize: true }),
            //new webpack.NormalModuleReplacementPlugin(
            //    /zone\.js(\\|\/)dist(\\|\/)long-stack-trace-zone/,
            //    emptyModulePath
            //),
            // TODO: to review
            new (<any>webpack).HashedModuleIdsPlugin()
        ];

        if (!appConfig.target || appConfig.target === 'web' || appConfig.target === 'webworker') {
            prodPlugins.push(new OptimizeJsPlugin({
                sourceMap: appConfig.sourceMap
            }));

            prodPlugins.push(new webpack.optimize.UglifyJsPlugin({
                beautify: false,
                //output: {
                //    comments: false
                //},
                mangle: {
                    screw_ie8: true
                    //keep_fnames: true
                },
                compress: {
                    screw_ie8: true,

                    warnings: buildOptions.verbose,
                    conditionals: true,
                    unused: true,
                    comparisons: true,
                    sequences: true,
                    dead_code: true,
                    evaluate: true,
                    if_return: true,
                    join_vars: true,
                    negate_iife: false // we need this for lazy v8
                },
                comments: false,
                sourceMap: appConfig.sourceMap

            }));
        }

        commonPlugins.push(...prodPlugins);
    }

    // Source-map
    //
    if (appConfig.sourceMap) {
        const relOutDir = path.relative(projectRoot, path.resolve(projectRoot, appConfig.outDir));
        commonPlugins.push(new webpack.SourceMapDevToolPlugin({
            // if no value is provided the sourcemap is inlined
            filename: buildOptions.test || (appConfig.target && appConfig.target !== 'web' && appConfig.target !== 'webworker') ? null : '[file].map',
            test: /\.(ts|js)($|\?)/i, // process .js and .ts files only
            moduleFilenameTemplate: path.relative(relOutDir, '[resourcePath]') // Point sourcemap entries to the original file locations on disk
        }));
    }

    // DefinePlugin
    if (!buildOptions.dll) {
        // DefinePlugin
        //
        commonPlugins.push(
            // NOTE: when adding more properties make sure you include them in custom-typings.d.ts
            new webpack.DefinePlugin(metadata)
        );

        // Provide plugin
        //
        if (appConfig.provide && typeof appConfig.provide === 'object' && Object.keys(appConfig.provide).length > 0) {
            commonPlugins.push(
                // NOTE: when adding more properties make sure you include them in custom-typings.d.ts
                new webpack.ProvidePlugin(appConfig.provide)
            );
        }
    }

    const statsConfig = getWebpackStatsConfig(buildOptions.verbose);
    let devtool: string;
    if (buildOptions.test || (appConfig.target && appConfig.target !== 'web' && appConfig.target !== 'webworker')) {
        devtool = appConfig.sourceMap ? 'inline-source-map' : ''; // '' or 'eval'
    }

    // Config
    //
    const webpackSharedConfig : any = {
        target: appConfig.target || 'web',
        devtool: devtool,
        resolve: {
            extensions: ['.ts', '.js','.json'],
            modules: [nodeModulesPath]
        },
        //resolveLoader: {
        //    modules: [nodeModulesPath]
        //},
        context: projectRoot,
        output: {
            path: path.resolve(projectRoot, appConfig.outDir),
            publicPath: appConfig.publicPath,
            filename: `[name]${chunkHashFormat}.js`,
            //sourceMapFilename: appConfig.appendOutputHash
            //    ? `[name].[chunkhash].map`
            //    : '[name].map',
            chunkFilename: `[id]${chunkHashFormat}.chunk.js`
        },
        module: {
            rules: commonRules
        },
        plugins: commonPlugins,
        performance: {
            hints: !buildOptions.test && !buildOptions.dll && buildOptions.performanceHint ? 'warning' : false, // boolean | "error" | "warning"
            maxAssetSize: 320000, // int (in bytes),
            maxEntrypointSize: 400000, // int (in bytes)
            assetFilter(assetFilename: string) {
                // Function predicate that provides asset filenames
                return assetFilename.endsWith('.css') || assetFilename.endsWith('.js');
            }
        },
        node: {
            global: true,
            fs: 'empty',
            crypto: 'empty',
            tls: 'empty',
            net: 'empty',
            process: true, // false
            module: false,
            clearImmediate: false,
            setImmediate: false
        },
        stats: statsConfig
    };

    // devServer
    if (!buildOptions.production &&
        isWebpackDevServer() &&
        (appConfig.target === 'web' || appConfig.target === 'webworker')) {
        webpackSharedConfig.devServer = {
            contentBase: path.join(projectRoot, appConfig.outDir + '/'),
            historyApiFallback: true,
            watchOptions: {
                aggregateTimeout: 300,
                poll: 1000
            },
            stats: Object.assign({}, statsConfig, { children: true })
        };
    }

    // Node specific
    if (appConfig.target && appConfig.target !== 'web' && appConfig.target !== 'webworker') {
        webpackSharedConfig.resolve = webpackSharedConfig.resolve || {};
        webpackSharedConfig.resolve.mainFields = ['main'];
    }

    return webpackSharedConfig;
}
