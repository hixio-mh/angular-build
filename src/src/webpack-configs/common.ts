import * as path from 'path';

// Webpack pligins
// ReSharper disable InconsistentNaming
const LoaderOptionsPlugin = require('webpack/lib/LoaderOptionsPlugin');
const NoEmitOnErrorsPlugin = require('webpack/lib/NoEmitOnErrorsPlugin');
const NormalModuleReplacementPlugin = require('webpack/lib/NormalModuleReplacementPlugin');
const ProgressPlugin = require('webpack/lib/ProgressPlugin');
const UglifyJsPlugin = require('webpack/lib/optimize/UglifyJsPlugin');

// Third-party plugins
const CopyWebpackPlugin = require('copy-webpack-plugin');
// ReSharper restore InconsistentNaming

// Internal plugins
import { CompressionPlugin } from '../plugins/compression-webpack-plugin';

// Models
import { AppConfig, BuildOptions, ModuleReplacementEntry} from '../models';

// Helpers
import { parseCopyAssetEntry } from './helpers';

export function getCommonConfigPartial(projectRoot: string, appConfig: AppConfig, buildOptions: BuildOptions) {
    const appRoot = path.resolve(projectRoot, appConfig.root);
    const commonPlugins: any[] = [];
    const hashFormat = `[chunkhash:${20}]`;

    const emptyModulePath = require.resolve('../../empty.js');

    // ProgressPlugin
    //
    if (buildOptions.progress) {
        commonPlugins.push(new ProgressPlugin({ profile: buildOptions.verbose, colors: true }));
    }

    // Copy assets
    //
    if (typeof appConfig.assets !== 'undefined' && appConfig.assets.length && appConfig.skipCopyAssets !== false) {
        const copyAssetOptions = parseCopyAssetEntry(appRoot, appConfig.assets);
        if (copyAssetOptions && copyAssetOptions.length > 0) {
            commonPlugins.push(new CopyWebpackPlugin(copyAssetOptions,
            {
                ignore: ['**/.gitkeep']
                //copyUnmodified: false
            }));
        }
    }

    // TODO: to review
    if (appConfig.compressAssets) {
        commonPlugins.push(new CompressionPlugin({
            asset: '[path].gz[query]',
            algorithm: 'gzip',
            test: /\.js$|\.html$|\.css$/,
            threshold: 10240
        }));
    }

    // Production replacement modules
    if (appConfig.moduleReplacements && appConfig.moduleReplacements.length) {
        appConfig.moduleReplacements.forEach((entry: ModuleReplacementEntry) => {
            commonPlugins.push(new NormalModuleReplacementPlugin(
                new RegExp(entry.resourceRegExp, 'i'),
                entry.newResource
            ));
        });
    }

    // Production plugins
    //
    if (buildOptions.production) {
        const prodPlugins = [
            new NoEmitOnErrorsPlugin(),
            new LoaderOptionsPlugin({ debug: false, minimize: true }),
            new UglifyJsPlugin({
                beautify: false,
                output: {
                    comments: false
                },
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

            }),
            new NormalModuleReplacementPlugin(
                /zone\.js(\\|\/)dist(\\|\/)long-stack-trace-zone/,
                emptyModulePath
            )
        ];
        commonPlugins.push(...prodPlugins);
    }

    // Config
    //
    const webpackSharedConfig = {
        target: appConfig.target === 'node' ? 'node' : 'web',
        devtool: buildOptions.production ? false : 'source-map',
        context: projectRoot,
        output: {
            path: path.resolve(projectRoot, appConfig.outDir),
            publicPath: appConfig.publicPath,
            filename: appConfig.appendOutputHash
                ? `[name].${hashFormat}.js`
                : '[name].js',
            sourceMapFilename: appConfig.appendOutputHash
                ? `[name].${hashFormat}.map`
                : '[name].map',
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
            assets: true, //buildOptions.debug,
            version: true, //buildOptions.debug,

            publicPath: buildOptions.verbose,
            chunkModules: buildOptions.verbose,
            modules: buildOptions.verbose,
            reasons: buildOptions.verbose,
            children: buildOptions.verbose,
            chunks: buildOptions.verbose // make sure 'chunks' is false or it will add 5-10 seconds to your build and incremental build time, due to excessive output.
        }
    };

    return webpackSharedConfig;
}
