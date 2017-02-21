import * as path from 'path';
import * as webpack from 'webpack';

// Webpack pligins
// ReSharper disable InconsistentNaming
const LoaderOptionsPlugin = webpack.LoaderOptionsPlugin;
const NoEmitOnErrorsPlugin = webpack.NoEmitOnErrorsPlugin;
const NormalModuleReplacementPlugin = webpack.NormalModuleReplacementPlugin;
const UglifyJsPlugin = webpack.optimize.UglifyJsPlugin;
const ProgressPlugin = require('webpack/lib/ProgressPlugin');

// Third-party plugins
const OptimizeJsPlugin = require('optimize-js-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
// ReSharper restore InconsistentNaming

// Internal plugins
import { CompressionPlugin } from '../plugins/compression-webpack-plugin';

// Models
import { AppConfig, BuildOptions, ModuleReplacementEntry } from '../models';

// Helpers
import { parseCopyAssetEntry, getWebpackStatsConfig } from './helpers';

export function getCommonConfigPartial(projectRoot: string, appConfig: AppConfig, buildOptions: BuildOptions) {
    const appRoot = path.resolve(projectRoot, appConfig.root);
    const hashFormat = `[chunkhash:${20}]`;
    const emptyModulePath = require.resolve('../../empty.js');

    const commonPlugins: any[] = [
        new NoEmitOnErrorsPlugin()
    ];

    // ProgressPlugin
    //
    if (buildOptions.progress) {
        commonPlugins.push(new ProgressPlugin({ profile: buildOptions.verbose, colors: true }));
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

    if (appConfig.compressAssets) {
        commonPlugins.push(new CompressionPlugin({
            asset: '[path].gz[query]',
            algorithm: 'gzip',
            test: /\.js$|\.html$|\.css$/,
            threshold: 10240
        }));
    }

    // Production replacement modules
    if (appConfig.moduleReplacements && appConfig.moduleReplacements.length > 0) {
        appConfig.moduleReplacements
            .filter((entry: ModuleReplacementEntry) => entry.resourceRegExp)
            .forEach((entry: ModuleReplacementEntry) => {
                let newPath = emptyModulePath;
                if (entry.newResource) {
                    newPath = path.resolve(projectRoot, entry.newResource);
                }
                commonPlugins.push(new NormalModuleReplacementPlugin(
                    new RegExp(entry.resourceRegExp, 'i'),
                    newPath
                ));
            });
    }

    // Production plugins
    //
    if (buildOptions.production) {
        const prodPlugins: any[] = [
            new LoaderOptionsPlugin({ debug: false, minimize: true }),
            new NormalModuleReplacementPlugin(
                /zone\.js(\\|\/)dist(\\|\/)long-stack-trace-zone/,
                emptyModulePath
            )
        ];

        if (!appConfig.target || appConfig.target === 'web') {
            prodPlugins.push(new OptimizeJsPlugin({
                sourceMap: false
            }));

            prodPlugins.push(new UglifyJsPlugin({
                beautify: false,
                //output: {
                //    comments: false
                //},
                mangle: {
                    screw_ie8: true,
                    keep_fnames: true
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

    const statsConfig = getWebpackStatsConfig(buildOptions.verbose);

    // Config
    //
    const webpackSharedConfig = {
        target: appConfig.target === 'node' ? 'node' : 'web',
        devtool: appConfig.target === 'node' ? 'inline-source-map' : undefined, //buildOptions.production ? false : 'source-map',
        context: projectRoot,
        output: {
            path: path.resolve(projectRoot, appConfig.outDir),
            publicPath: appConfig.publicPath,
            filename: appConfig.appendOutputHash
                ? `[name].${hashFormat}.js`
                : '[name].js',
            //sourceMapFilename: appConfig.appendOutputHash
            //    ? `[name].${hashFormat}.map`
            //    : '[name].map',
            chunkFilename: appConfig.appendOutputHash
                ? `[id].${hashFormat}.js`
                : '[id].js',
            // The name of the global variable which the library's
            // require() function will be assigned to
            library: appConfig.appendOutputHash ? `[name]_${hashFormat}` : '[name]_lib'
        },
        plugins: commonPlugins,
        // >= version 2.2
        performance: {
            hints: buildOptions.performanceHint ? 'warning' : false, // boolean | "error" | "warning"
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
            process: true,
            module: false,
            clearImmediate: false,
            setImmediate: false
        },
        stats: statsConfig
    };

    return webpackSharedConfig;
}
