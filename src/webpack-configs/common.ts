import * as path from 'path';
import * as webpack from 'webpack';

// plugins
import * as CopyWebpackPlugin from 'copy-webpack-plugin';

// ReSharper disable InconsistentNaming
// ReSharper disable CommonJsExternalModule
const OptimizeJsPlugin = require('optimize-js-plugin');
const UglifyJSPlugin = require('uglifyjs-webpack-plugin');
// ReSharper restore InconsistentNaming
// ReSharper restore CommonJsExternalModule

// internal plugins
import { BundleAnalyzerPlugin } from '../plugins';

import { getWebpackToStringStatsOptions, parseAssetEntry, prepareBannerSync } from '../helpers';
import { AppProjectConfig } from '../models';

import { WebpackConfigOptions } from './webpack-config-options';

/**
 * Enumerate loaders and their dependencies from this file to let the dependency validator
 * know they are used.
 * require('file-loader')
 * require('json-loader')
 * require('raw-loader')
 * require('source-map-loader')
 * require('url-loader')
 */

export function getCommonConfigPartial(webpackConfigOptions: WebpackConfigOptions): webpack.Configuration {
    const projectRoot = webpackConfigOptions.projectRoot;
    const buildOptions = webpackConfigOptions.buildOptions;
    const projectConfig = webpackConfigOptions.projectConfig;
    const environment = buildOptions.environment || {};

    const srcDir = path.resolve(projectRoot, projectConfig.srcDir || '');
    const nodeModulesPath = path.resolve(projectRoot, 'node_modules');

    const fileHashFormat = projectConfig.projectType === 'app' &&
        !environment.lib &&
        projectConfig.platformTarget === 'web' &&
        (projectConfig as AppProjectConfig).appendOutputHash
        ? '.[hash]'
        : '';
    const chunkHashFormat = projectConfig.projectType === 'app' &&
        !environment.lib &&
        projectConfig.platformTarget === 'web' &&
        (projectConfig as AppProjectConfig).appendOutputHash
        ? '.[chunkhash]'
        : '';

    const webpackIsGlobal = (buildOptions as any).webpackIsGlobal || !(buildOptions as any).cliIsLocal;
    const fileLoader = webpackIsGlobal ? require.resolve('file-loader') : 'file-loader';
    const jsonLoader = webpackIsGlobal ? require.resolve('json-loader') : 'json-loader';
    const rawLoader = webpackIsGlobal ? require.resolve('raw-loader') : 'raw-loader';
    const sourceMapLoader = webpackIsGlobal ? require.resolve('source-map-loader') : 'source-map-loader';
    const urlLoader = webpackIsGlobal ? require.resolve('url-loader') : 'url-loader';

    // rules
    const commonRules: any[] = [
        {
            test: /\.json$/,
            use: jsonLoader
        },
        {
            test: /\.html$/,
            use: rawLoader,
            exclude: [path.resolve(srcDir, 'index.html')]
        },
        // Font files of all types
        {
            test: /\.(otf|ttf|woff|woff2)(\?v=\d+\.\d+\.\d+)?$/,
            use: `${urlLoader}?limit=10000&name=assets/[name]${fileHashFormat}.[ext]`
        },
        {
            test: /\.eot(\?v=\d+\.\d+\.\d+)?$/,
            use: `${fileLoader}?name=assets/[name]${fileHashFormat}.[ext]`
        },
        // Image loaders
        {
            test: /\.(jpg|png|webp|gif|cur|ani)$/,
            use: `${urlLoader}?limit=25000&name=assets/[name]${fileHashFormat}.[ext]`
        },
        // SVG files
        // {
        //    test: /\.svg(\?v=\d+\.\d+\.\d+)?$/,
        //    use: `url-loader?limit=25000&mimetype=image/svg+xml`
        // },
        {
            test: /\.svg(\?v=\d+\.\d+\.\d+)?$/,
            use: `${fileLoader}?name=assets/[name]${fileHashFormat}.[ext]`
        }
        // {
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
        // }
    ];

    // source-map-loader
    if (projectConfig.projectType === 'app' && !environment.dll) {
        const sourceMapExcludes: string[] = [];
        const appJsSourceMapExcludes = (projectConfig as AppProjectConfig).jsSourceMapExcludes || [];
        if (typeof (projectConfig as AppProjectConfig).jsSourceMapExcludes !== 'undefined' &&
            appJsSourceMapExcludes.length) {
            appJsSourceMapExcludes.forEach((e: string) => {
                const p = path.resolve(projectRoot, e);
                sourceMapExcludes.push(p);
            });
        } else {
            sourceMapExcludes.push(nodeModulesPath);
        }

        commonRules.push({
            enforce: 'pre',
            test: /\.js$/,
            use: sourceMapLoader,
            exclude: sourceMapExcludes
        });
    }

    // plugins
    const commonPlugins: any[] = [
        new webpack.NoEmitOnErrorsPlugin()
    ];

    const statOptions: webpack.Options.Stats = getWebpackToStringStatsOptions(projectConfig.stats, buildOptions.verbose);
    let profile = (buildOptions as any).profile;
    const hot = environment.hot || environment.devServer;

    // TODO: to review still necessary? Please define in moduleReplacements!
    // if (projectConfig.projectType === 'app') {
    //    // es6-promise
    //    // Workaround for https://github.com/stefanpenner/es6-promise/issues/100
    //    commonPlugins.push(new webpack.IgnorePlugin(/^vertx$/));

    //    // Workaround for https://github.com/andris9/encoding/issues/16
    //    // commonPlugins.push(new webpack.NormalModuleReplacementPlugin(/\/iconv-loader$/, require.resolve('node-noop'))));
    // }

    // BannerPlugin
    let banner: string | null = null;
    if (projectConfig.banner) {
        banner = prepareBannerSync(projectRoot, srcDir, projectConfig.banner);
        const bannerOptions: webpack.BannerPlugin.Options = {
            banner: banner,
            raw: true,
            entryOnly: true
        };
        commonPlugins.push(new webpack.BannerPlugin(bannerOptions));
    }

    // ProgressPlugin
    if (!hot && (buildOptions as any).progress) {
        commonPlugins.push(new (webpack as any).ProgressPlugin({ profile: buildOptions.verbose }));
    }

    // BundleAnalyzerPlugin
    if (!hot && projectConfig.bundleAnalyzerOptions &&
        (projectConfig.bundleAnalyzerOptions.generateAnalyzerReport ||
            projectConfig.bundleAnalyzerOptions.generateStatsFile)) {
        profile = true;
        const bundleAnalyzerOptions = Object.assign({}, projectConfig.bundleAnalyzerOptions);
        bundleAnalyzerOptions.reportFilename = bundleAnalyzerOptions.reportFilename || 'stats-report.html';
        commonPlugins.push(
            new BundleAnalyzerPlugin(bundleAnalyzerOptions));
    }

    // copy assets
    const skipCopyAssets = !environment.dll &&
        !buildOptions.production &&
        (projectConfig as AppProjectConfig).referenceDll;
    if (projectConfig.assets &&
        projectConfig.assets.length > 0 &&
        projectConfig.projectType !== 'lib' &&
        !skipCopyAssets) {
        const copyAssetOptions = parseAssetEntry(srcDir, projectConfig.assets);
        if (copyAssetOptions && copyAssetOptions.length > 0) {
            commonPlugins.push(new CopyWebpackPlugin(copyAssetOptions,
                {
                    ignore: ['**/.gitkeep']
                    // copyUnmodified: false
                }));
        }
    }

    // production plugins
    if (buildOptions.production) {
        const prodPlugins: any[] = [
            // webpack 3
            new (webpack as any).optimize.ModuleConcatenationPlugin(),
            // webpack.LoaderOptionsPlugin({ debug: false, minimize: true }) -> debug will be removed as of webpack 3.
            new webpack.LoaderOptionsPlugin({ minimize: true })
            // new (webpack as any).HashedModuleIdsPlugin()
        ];

        if (projectConfig.projectType === 'app' &&
            projectConfig.platformTarget === 'web' &&
            !environment.dll) {
            prodPlugins.push(new OptimizeJsPlugin({
                sourceMap: projectConfig.sourceMap
            }));
        }

        // new webpack.optimize.UglifyJsPlugin
        // we use standaline plugin
        // ReSharper disable once InconsistentNaming
        prodPlugins.push(new UglifyJSPlugin({
            warnings: buildOptions.verbose, // default false
            ie8: true, // default false
            compress: {
                passes: 3, // default 1,
                negate_iife: false // we need this for lazy v8
            },

            // plugin's output is different with original.
            // output: {
            //    beautify: false, // default true
            //    preamble: banner
            // },
            // plugin's sourceMap is different with original.
            // sourceMap: projectConfig.sourceMap
            //    ? {
            //        // filename: outputFileName,
            //        url: outputFileName + '.map'
            //    }
            //    : null,

            // plugin specific
            beautify: false, // default false
            // Defaults to preserving comments containing /*!, /**!, @preserve or @license
            comments: projectConfig.preserveLicenseComments !== false ? undefined : false,
            sourceMap: projectConfig.sourceMap
        }));

        commonPlugins.push(...prodPlugins);
    } else if (!environment.dll) {
        const devPlugins: any[] = [
            new webpack.NamedModulesPlugin()
        ];

        commonPlugins.push(...devPlugins);
    }

    // source-maps
    let devtool: any = projectConfig.sourceMapDevTool;
    if (!projectConfig.sourceMap) {
        devtool = environment.test ? 'eval' : false;
    } else if (typeof projectConfig.sourceMapDevTool === 'undefined' &&
        !environment.test &&
        projectConfig.projectType === 'lib') {
        devtool = 'source-map';
    } else if (typeof projectConfig.sourceMapDevTool === 'undefined' &&
        !buildOptions.production &&
        !environment.test &&
        projectConfig.projectType === 'app' &&
        !environment.dll &&
        (!projectConfig.platformTarget || projectConfig.platformTarget === 'web')) {
        devtool = undefined;
        commonPlugins.push(new webpack.SourceMapDevToolPlugin({
            // if no value is provided the sourcemap is inlined
            filename: '[file].map[query]',
            moduleFilenameTemplate: projectConfig.sourceMapModuleFilenameTemplate || '[absolute-resource-path]',
            fallbackModuleFilenameTemplate: projectConfig.sourceMapFallbackModuleFilenameTemplate ||
            '[absolute-resource-path]',
            sourceRoot: projectConfig.sourceMapSourceRoot // 'webpack:///'
        }));
    } else if (environment.test) {
        devtool = 'inline-source-map';
    } else {
        devtool = false;
    }

    if (projectConfig.projectType === 'app' && !environment.dll) {
        const env: any = {
            prod: buildOptions.production,
            production: buildOptions.production
        };
        Object.keys(environment).filter((key: string) => key !== 'production' &&
            key !== 'prod').forEach((key: string) => {
                let value = environment[key];
                if (value && typeof value === 'string' && (value as string).toUpperCase() === 'TRUE') {
                    value = true;
                } else if (value && typeof value === 'string' && (value as string).toUpperCase() === 'FALSE') {
                    value = false;
                }
                if (key === 'development' || key === 'dev') {
                    env.dev = value;
                    env.development = value;
                } else {
                    env[key] = value;
                }
            });

        const defaultGlobalConstants: { [key: string]: any } = {
            'ENV': JSON.stringify(env),
            'PRODUCTION': JSON.stringify(buildOptions.production),
            'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV),
            'process.env.DEBUG': JSON.stringify(process.env.DEBUG)
        };
        const globalConstants = Object.assign({}, defaultGlobalConstants);
        if ((projectConfig as AppProjectConfig).globalConstants) {
            const appGlobalConstants = (projectConfig as AppProjectConfig).globalConstants || {};
            Object.keys(appGlobalConstants)
                .filter((key: string) => !(key in defaultGlobalConstants))
                .forEach((key: string) => {
                    globalConstants[key] = JSON.stringify(appGlobalConstants[key]);
                });
        }

        // DefinePlugin
        commonPlugins.push(
            // NOTE: when adding more properties make sure you include them in custom-typings.d.ts
            new webpack.DefinePlugin(globalConstants)
        );

        // Provide plugin
        if ((projectConfig as AppProjectConfig).globalProvides &&
            typeof (projectConfig as AppProjectConfig).globalProvides === 'object' &&
            Object.keys((projectConfig as AppProjectConfig).globalProvides).length > 0) {
            commonPlugins.push(
                // NOTE: when adding more properties make sure you include them in custom-typings.d.ts
                new webpack.ProvidePlugin((projectConfig as AppProjectConfig).globalProvides as any)
            );
        }
    }

    // performance options
    let performanceOptions =
        (projectConfig as AppProjectConfig).performanceOptions as (webpack.PerformanceOptions | undefined);
    if (performanceOptions) {
        if (!performanceOptions.hints) {
            performanceOptions = undefined;
        } else {
            performanceOptions.assetFilter = (assetFilename: string) => {
                // Function predicate that provides asset filenames
                return assetFilename.endsWith('.css') || assetFilename.endsWith('.js');
            };
        }
    }

    let libraryTarget = getWebpackLibTargetName(webpackConfigOptions.bundleLibraryTarget || projectConfig.libraryTarget,
        projectConfig.platformTarget);

    let libraryName = projectConfig.libraryName;
    if (!libraryName && projectConfig.projectType === 'lib' && webpackConfigOptions.packageName) {
        libraryName = webpackConfigOptions.packageName;
    }

    const bundleOutDir = path.resolve(projectRoot, projectConfig.outDir, webpackConfigOptions.bundleOutDir || '');
    const bundleOutFileName = webpackConfigOptions.bundleOutFileName || `[name]${chunkHashFormat}.js`;

    let externals = projectConfig.externals as any;
    if (externals && typeof projectConfig.externals === 'string') {
        // TODO: to review
        externals = new RegExp(externals, 'i');
    }

    // webpack config
    const webpackSharedConfig: webpack.Configuration = {
        target: (projectConfig.platformTarget as any),
        devtool: (devtool as any),
        profile: profile,
        resolve: {
            extensions: ['.ts', '.js', '.json'],
            symlinks: projectConfig.preserveSymlinks,
            modules: ['node_modules', nodeModulesPath]
        },
        resolveLoader: {
            modules: [nodeModulesPath, 'node_modules']
        },
        context: projectRoot,
        output: {
            path: bundleOutDir,
            filename: bundleOutFileName,
            publicPath: (projectConfig as AppProjectConfig).publicPath,
            chunkFilename: `[id]${chunkHashFormat}.chunk.js`,
            libraryTarget: libraryTarget,
            library: libraryName
        },
        externals: externals,
        module: {
            rules: commonRules
        },
        plugins: commonPlugins,
        performance: performanceOptions,
        node: {
            global: true, // default: true
            process: !(environment.dll ||
                projectConfig.projectType === 'lib'), // default: true
            fs: 'empty', // default: 'empty'
            setImmediate: false, // default: true
            module: false,
            crypto: 'empty',
            tls: 'empty',
            net: 'empty',
            clearImmediate: false
        },
        stats: statOptions,
        watchOptions: webpackConfigOptions.angularBuildConfig
            ? webpackConfigOptions.angularBuildConfig.webpackWatchOptions
            : undefined
    };

    // devServer
    if (!buildOptions.production && environment.devServer) {
        webpackSharedConfig.devServer = {
            contentBase: path.join(projectRoot,
                projectConfig.outDir && projectConfig.outDir.endsWith('/') ? projectConfig.outDir : projectConfig.outDir + '/'),
            historyApiFallback: true,
            watchOptions: {
                aggregateTimeout: 300,
                poll: 1000
            },
            stats: Object.assign({}, statOptions, { children: true })
        };
    }

    // When the target property is set to webworker, web, or left unspecified:
    if (environment.dll &&
        projectConfig.projectType === 'app' &&
        projectConfig.platformTarget === 'node') {
        webpackSharedConfig.resolve = webpackSharedConfig.resolve || {};
        // (webpackSharedConfig as any).resolve.mainFields = ["module", "main"];
        // TODO: to review to remove
        (webpackSharedConfig as any).resolve.mainFields = ['main'];
    }

    if (libraryTarget === 'umd' && webpackSharedConfig.output) {
        webpackSharedConfig.output.umdNamedDefine = true;
    }

    return webpackSharedConfig;
}

export function getWebpackLibTargetName(libraryTarget?: string,
    platformTarget?: string,
    defaultTarget?: string): string | undefined {

    if (libraryTarget === 'iife') {
        return 'var';
    }

    if (!libraryTarget &&
        platformTarget === 'node' ||
        platformTarget === 'async-node' ||
        platformTarget === 'node-webkit') {
        return defaultTarget || 'commonjs2';
    }

    if (!libraryTarget) {
        return defaultTarget;
    }

    return libraryTarget;
}
