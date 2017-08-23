import * as path from 'path';
import * as webpack from 'webpack';

import { PurifyPlugin } from '@angular-devkit/build-optimizer';

// ReSharper disable InconsistentNaming
// ReSharper disable CommonJsExternalModule
const CircularDependencyPlugin = require('circular-dependency-plugin');
const UglifyJSPlugin = require('uglifyjs-webpack-plugin');
// const OptimizeJsPlugin = require('optimize-js-plugin');
// ReSharper restore InconsistentNaming
// ReSharper restore CommonJsExternalModule

import { BundleAnalyzerPlugin } from '../plugins/bundle-analyzer-webpack-plugin';
import { NamedLazyChunksWebpackPlugin } from '../plugins/named-lazy-chunks-webpack-plugin';

import { getWebpackToStringStatsOptions, getNodeModuleStartPaths, prepareBannerSync } from '../helpers';
import { AppProjectConfig } from '../models';

import { WebpackConfigOptions } from './webpack-config-options';

/**
 * Enumerate loaders and their dependencies from this file to let the dependency validator
 * know they are used.
 * require('file-loader')
 * require('raw-loader')
 * require('source-map-loader')
 * require('url-loader')
 */

export function getCommonWebpackConfigPartial(webpackConfigOptions: WebpackConfigOptions): webpack.Configuration {
    const projectRoot = webpackConfigOptions.projectRoot;
    const buildOptions = webpackConfigOptions.buildOptions;
    const projectConfig = webpackConfigOptions.projectConfig;
    const environment = buildOptions.environment || {};
    const isAngularBuildCli = (buildOptions as any).isAngularBuildCli;
    const cliIsLocal = (buildOptions as any).cliIsLocal !== false;

    const srcDir = path.resolve(projectRoot, projectConfig.srcDir || '');
    const nodeModulesPath = path.resolve(projectRoot, 'node_modules');
    const nodeModuleStartPaths = getNodeModuleStartPaths(projectRoot, projectConfig);

    const fileHashFormat = projectConfig.projectType === 'app' &&
        projectConfig.platformTarget === 'web' &&
        (projectConfig as AppProjectConfig).appendOutputHash
        ? '.[hash]'
        : '';
    const chunkHashFormat = projectConfig.projectType === 'app' &&
        projectConfig.platformTarget === 'web' &&
        (projectConfig as AppProjectConfig).appendOutputHash
        ? '.[chunkhash]'
        : '';

    const bundleOutDir = path.resolve(projectRoot, projectConfig.outDir, webpackConfigOptions.bundleOutDir || '');
    const bundleOutFileName = webpackConfigOptions.bundleOutFileName ||
        `[name]${chunkHashFormat}.js`;

    const fileLoader = cliIsLocal ? 'file-loader' : require.resolve('file-loader');
    const rawLoader = cliIsLocal ? 'raw-loader' : require.resolve('raw-loader');
    const sourceMapLoader = cliIsLocal ? 'source-map-loader' : require.resolve('source-map-loader');
    const urlLoader = cliIsLocal ? 'url-loader' : require.resolve('url-loader');

    const isDevServer = environment.hot || environment.hmr || environment.devServer;
    let profile = buildOptions.profile && !isDevServer;

    const statOptions: webpack.Options.Stats =
        getWebpackToStringStatsOptions(isDevServer ? 'none' : (projectConfig.stats || buildOptions.stats),
            buildOptions.verbose);

    // rules
    const rules: any[] = [
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
            test: /\.(jpg|png|webp|gif|ani)$/,
            use: `${urlLoader}?limit=25000&name=assets/[name]${fileHashFormat}.[ext]`
        },
        // SVG files
        // {
        //    test: /\.svg(\?v=\d+\.\d+\.\d+)?$/,
        //    use: `url-loader?limit=25000&mimetype=image/svg+xml`
        // },
        {
            test: /\.(svg|cur)(\?v=\d+\.\d+\.\d+)?$/,
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
    if (projectConfig.sourceMap) {
        const sourceMapExcludes: string[] = [];
        if (projectConfig.projectType === 'app') {
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
        }

        rules.push({
            enforce: 'pre',
            test: /\.js$/,
            use: sourceMapLoader,
            exclude: sourceMapExcludes
        });
    }

    // plugins
    const plugins: any[] = [
        new webpack.NoEmitOnErrorsPlugin()
    ];

    // BannerPlugin
    let banner = projectConfig.banner;
    if (banner && !isDevServer) {
        banner = prepareBannerSync(projectRoot, srcDir, banner);
        if (banner) {
            const bannerOptions: webpack.BannerPlugin.Options = {
                banner: banner,
                raw: true,
                entryOnly: true
            };
            plugins.push(new webpack.BannerPlugin(bannerOptions));
        }
    }

    // ProgressPlugin
    if (!isDevServer && buildOptions.progress && isAngularBuildCli) {
        plugins.push(new (webpack as any).ProgressPlugin({ profile: buildOptions.verbose }));
    }

    // BundleAnalyzerPlugin
    if (!isDevServer && projectConfig.bundleAnalyzerOptions &&
        (projectConfig.bundleAnalyzerOptions.generateAnalyzerReport ||
            projectConfig.bundleAnalyzerOptions.generateStatsFile)) {
        profile = true;
        const bundleAnalyzerOptions = Object.assign({}, projectConfig.bundleAnalyzerOptions);
        bundleAnalyzerOptions.reportFilename = bundleAnalyzerOptions.reportFilename || 'stats-report.html';
        plugins.push(
            new BundleAnalyzerPlugin(bundleAnalyzerOptions));
    }

    if ((projectConfig as AppProjectConfig).namedLazyChunks) {
        plugins.push(new NamedLazyChunksWebpackPlugin());
    }

    // production plugins
    if (buildOptions.production) {
        const prodPlugins: any[] = [
            new webpack.LoaderOptionsPlugin({ minimize: true }),
            new (webpack as any).HashedModuleIdsPlugin()
        ];

        // webpack 3
        if (projectConfig.experimentalScopeHoisting && !environment.dll) {
            prodPlugins.push(new (webpack as any).optimize.ModuleConcatenationPlugin());
        }

        const uglifyCompressOptions: any = { };

        // build-optimizer
        if (buildOptions.buildOptimizer) {
            // This plugin must be before webpack.optimize.UglifyJsPlugin.
            prodPlugins.push(new PurifyPlugin());
            uglifyCompressOptions.pure_getters = true;
        }

        // TODO: to review
        // if (projectConfig.projectType === 'app' &&
        //    projectConfig.platformTarget === 'web' && !projectConfig.sourceMap) {
        //   prodPlugins.push(new OptimizeJsPlugin({
        //       sourceMap: projectConfig.sourceMap
        //   }));
        // }

        // ReSharper disable once InconsistentNaming
        prodPlugins.push(new UglifyJSPlugin({
            extractComments: true,
            // Defaults to preserving comments containing /*!, /**!, @preserve or @license
            comments: /^\**!|@preserve|@license/,
            sourceMap: projectConfig.sourceMap,
            warningsFilter: (resourceId: string): boolean => {
                const isNodeModule = nodeModuleStartPaths.reduce(
                    (last: boolean, current: string) => resourceId.startsWith(current) || last,
                    false);
                return buildOptions.verbose || !isNodeModule;
            },
            parallel: true,
            uglifyOptions: {
                compress: uglifyCompressOptions,
                warnings: buildOptions.verbose, // default false
            },
            output: {
                beautify: false
            }
        }));

        plugins.push(...prodPlugins);
    } else if (!environment.dll) {
        const devPlugins: any[] = [
            new webpack.NamedModulesPlugin()
        ];

        plugins.push(...devPlugins);
    }

    // source-maps
    let devtool: any = projectConfig.sourceMapDevTool;
    if (typeof projectConfig.sourceMapDevTool === 'undefined') {
        if (!projectConfig.sourceMap) {
            devtool = environment.test ? 'eval' : false;
        } else if (environment.test ||
            (projectConfig.projectType === 'app' &&
                (projectConfig.platformTarget === 'node' || projectConfig.platformTarget === 'async-node'))) {
            devtool = 'inline-source-map';
        } else if (projectConfig.projectType === 'lib') {
            devtool = 'source-map';
        } else if (projectConfig.projectType === 'app' &&
            (!projectConfig.platformTarget || projectConfig.platformTarget === 'web')) {
            devtool = undefined;
            // '[absolute-resource-path]'
            // Or
            let defaultModuleFilenameTemplate = path.relative(projectConfig.srcDir || '', '[resourcePath]');
            plugins.push(new webpack.SourceMapDevToolPlugin({
                // if no value is provided the sourcemap is inlined
                filename: '[file].map[query]',
                // default: "webpack:///[resourcePath]"
                moduleFilenameTemplate: projectConfig.sourceMapModuleFilenameTemplate || defaultModuleFilenameTemplate
                // default: "webpack:///[resourcePath]?[hash]"
                // fallbackModuleFilenameTemplate: projectConfig.sourceMapFallbackModuleFilenameTemplate ||
                //    defaultModuleFilenameTemplate
            }));
        }
    }

    // global environments
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
        plugins.push(
            // NOTE: when adding more properties make sure you include them in custom-typings.d.ts
            new webpack.DefinePlugin(globalConstants)
        );
    }

    // Provide plugin
    if ((projectConfig as AppProjectConfig).provides) {
        var provideConfig = (projectConfig as AppProjectConfig).provides as any;
        if (Object.keys(provideConfig).length > 0) {
            plugins.push(
                // NOTE: when adding more properties make sure you include them in custom-typings.d.ts
                new webpack.ProvidePlugin((projectConfig as AppProjectConfig).provides as any)
            );
        }
    }

    // performance options
    let performanceOptions =
        (projectConfig as AppProjectConfig).performanceOptions as any;
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

    let externals = projectConfig.externals as any;
    if (externals && typeof projectConfig.externals === 'string') {
        externals = new RegExp(externals, 'i');
    }

    // CircularDependencyPlugin
    if (buildOptions.showCircularDependencies) {
        plugins.push(new CircularDependencyPlugin({
            exclude: /(\\|\/)node_modules(\\|\/)/
        }));
    }

    // webpack config
    const webpackCommonConfig: webpack.Configuration = {
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
            library: libraryName,
            devtoolModuleFilenameTemplate: devtool ? projectConfig.sourceMapModuleFilenameTemplate : undefined,
            devtoolFallbackModuleFilenameTemplate: devtool
                ? projectConfig.sourceMapFallbackModuleFilenameTemplate
                : undefined
        },
        externals: externals,
        module: {
            rules: rules
        },
        plugins: plugins,
        performance: performanceOptions,
        node: {
            global: true, // default: true
            process: projectConfig.projectType !== 'lib', // default: true
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
        webpackCommonConfig.devServer = {
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

    // mainFields
    if (projectConfig.mainFields && projectConfig.mainFields.length) {
        webpackCommonConfig.resolve = webpackCommonConfig.resolve || {};
        (webpackCommonConfig as any).resolve.mainFields = projectConfig.mainFields;
    }

    if (libraryTarget === 'umd' && webpackCommonConfig.output) {
        webpackCommonConfig.output.umdNamedDefine = true;
    }

    return webpackCommonConfig;
}

export function getWebpackLibTargetName(libraryTarget?: string,
    platformTarget?: string,
    defaultTarget?: string): any {

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
