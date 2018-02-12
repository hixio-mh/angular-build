import * as path from 'path';

import * as resolve from 'resolve';
import * as webpack from 'webpack';

import { PurifyPlugin } from '@angular-devkit/build-optimizer';

import { AngularBuildProjectConfigWebpackPlugin } from '../../plugins/angular-build-project-config-webpack-plugin';
import { BundleAnalyzerWebpackPlugin } from '../../plugins/bundle-analyzer-webpack-plugin';
import { CleanWebpackPlugin } from '../../plugins/clean-webpack-plugin';
import { CopyWebpackPlugin } from '../../plugins/copy-webpack-plugin';
import { TelemetryWebpackPlugin } from '../../plugins/telemetry-webpack-plugin';

import {
    AngularBuildContext,
    AppProjectConfigInternal,
    BeforeRunCleanOptions,
    BundleAnalyzerOptions,
    CleanOptions,
    InvalidConfigError,
    PreDefinedEnvironment
} from '../../models';
import { isWebpackDevServer } from '../../helpers/is-webpack-dev-server';
import { getWebpackToStringStatsOptions } from '../../helpers/webpack-to-string-stats-options';

const CircularDependencyPlugin = require('circular-dependency-plugin');
const UglifyJSPlugin = require('uglifyjs-webpack-plugin');

/**
 * Enumerate loaders and their dependencies from this file to let the dependency validator
 * know they are used.
 * require('file-loader')
 * require('raw-loader')
 * require('url-loader')
 */

type WebpackLibraryTarget = 'var' | 'amd' | 'commonjs' | 'commonjs2' | 'umd';

export function getAppCommonWebpackConfigPartial(angularBuildContext: AngularBuildContext,
    env?: PreDefinedEnvironment): webpack.Configuration {
    const environment = env ? env as PreDefinedEnvironment : AngularBuildContext.environment;
    const projectRoot = AngularBuildContext.projectRoot;
    const cliIsGlobal = AngularBuildContext.cliIsGlobal;
    const fromAngularBuildCli = AngularBuildContext.fromAngularBuildCli;
    const logger = AngularBuildContext.logger;
    const verbose = AngularBuildContext.angularBuildConfig.logLevel === 'debug';

    const hot = environment.hot;
    const watch = AngularBuildContext.watch;
    const devServer = isWebpackDevServer();

    const appConfig = angularBuildContext.projectConfig as AppProjectConfigInternal;
    const isDll = environment.dll;
    const srcDir = path.resolve(projectRoot, appConfig.srcDir || '');
    let outDir = appConfig.outDir ? path.resolve(projectRoot, appConfig.outDir) : undefined;

    const resourceExtractHashFormat = (!appConfig.platformTarget || appConfig.platformTarget === 'web') &&
        appConfig.appendOutputHash !== false
        ? `.[hash:${20}]`
        : '';

    const chunkHashFormat = (!appConfig.platformTarget || appConfig.platformTarget === 'web') &&
        appConfig.appendOutputHash
        ? `.[chunkhash:${20}]`
        : '';

    const vendorChunkName = appConfig.vendorChunkName || 'vendor';

    let profile = false;

    const fileLoader = cliIsGlobal ? require.resolve('file-loader') : 'file-loader';
    const rawLoader = cliIsGlobal ? require.resolve('raw-loader') : 'raw-loader';
    const urlLoader = cliIsGlobal ? require.resolve('url-loader') : 'url-loader';

    // rules
    const rules: webpack.Rule[] = [
        {
            test: /\.html$/,
            loader: rawLoader
        },
        {
            test: /\.(jpg|png|webp|gif|otf|ttf|woff|woff2|ani)$/,
            loader: urlLoader,
            options: {
                name: `[name]${resourceExtractHashFormat}.[ext]`,
                limit: 10000
            }
        },
        {
            test: /\.(eot|svg|cur)$/,
            loader: fileLoader,
            options: {
                name: `[name]${resourceExtractHashFormat}.[ext]`,
                limit: 10000
            }
        }
    ];

    // hot || devServer ? 'errors-only'
    const statOptions: webpack.Options.Stats =
        getWebpackToStringStatsOptions(verbose, appConfig.stats);

    // plugins
    const plugins: webpack.Plugin[] = [new webpack.NoEmitOnErrorsPlugin()];

    // progress
    if (AngularBuildContext.progress && fromAngularBuildCli && !devServer && !hot && !watch) {
        plugins.push(new webpack.ProgressPlugin());
    }

    // angular-build bind
    if (!isDll) {
        plugins.push(new AngularBuildProjectConfigWebpackPlugin({
            configPath: AngularBuildContext.angularBuildConfig._configPath,
            environment: environment as { [key: string]: boolean | string; },

            initialProjectConfig: appConfig,
            configName: appConfig.name,
            projectType: appConfig._projectType,

            schema: AngularBuildContext.angularBuildConfig._schema,
            validateSchema: true,

            loggerOptions: {
                logLevel: AngularBuildContext.angularBuildConfig.logLevel
            }
        }));
    }

    // clean
    let shouldClean = outDir &&
        (AngularBuildContext.cleanOutDirs ||
            (appConfig.clean && Object.keys(appConfig.clean).length));
    if (shouldClean) {
        const cleanOptions = Object.assign({}, appConfig.clean || {}) as CleanOptions;
        cleanOptions.beforeRun = cleanOptions.beforeRun || {} as BeforeRunCleanOptions;
        const beforeRunOption = cleanOptions.beforeRun;
        if (typeof beforeRunOption.cleanOutDir === 'undefined' &&
            AngularBuildContext.cleanOutDirs) {
            beforeRunOption.cleanOutDir = true;
        }
        if (!isDll && appConfig.referenceDll && beforeRunOption.cleanOutDir) {
            // logger.debug(
            //    `The 'apps[${projectConfig._index
            //    }].clean.beforeCompileOption.cleanOutDir' will be disabled when 'referenceDll' is true`);
            beforeRunOption.cleanOutDir = false;
        }

        plugins.push(new CleanWebpackPlugin(Object.assign(cleanOptions,
            {
                forceCleanToDisk: isDll,
                loggerOptions: {
                    logLevel: AngularBuildContext.angularBuildConfig.logLevel
                }
            })));
    }

    // copy assets
    if (appConfig.copy && appConfig.copy.length && !isDll) {
        plugins.push(new CopyWebpackPlugin({
            assets: appConfig.copy,
            baseDir: srcDir,
            loggerOptions: {
                logLevel: AngularBuildContext.angularBuildConfig.logLevel
            }
        }));
    }

    // bundle analyzer report
    if (appConfig.bundleAnalyzer) {
        let hasEntry = false;
        if (isDll) {
            if (appConfig.dll) {
                const dllEntry = appConfig.dll;
                if ((Array.isArray(dllEntry) && dllEntry.length > 0) ||
                    (typeof dllEntry === 'object' && Object.keys(dllEntry).length > 0)) {
                    hasEntry = true;
                }
            }
        } else {
            if (appConfig.entry) {
                hasEntry = true;
            } else if (appConfig.polyfills) {
                const polyfills = appConfig.polyfills as string[];
                hasEntry = polyfills.length > 0;
            }
        }

        if (hasEntry) {
            profile = true;
            const bundleAnalyzerOptions = Object.assign({},
                typeof appConfig.bundleAnalyzer === 'object' ? appConfig.bundleAnalyzer : {}) as
                BundleAnalyzerOptions;
            if (devServer || hot || watch) {
                bundleAnalyzerOptions.openAnalyzer = false;
            }

            if (isDll) {
                const vendorStatsFile = `${vendorChunkName}-stats.json`;
                const vendorStatsReportFile = `${vendorChunkName}-stats-report.html`;
                bundleAnalyzerOptions.statsFilename = bundleAnalyzerOptions.statsFilename || vendorStatsFile;
                bundleAnalyzerOptions.reportFilename = bundleAnalyzerOptions.reportFilename || vendorStatsReportFile;
            }

            plugins.push(new BundleAnalyzerWebpackPlugin(Object.assign({
                loggerOptions: {
                    logLevel: 'error'
                }
            },
                bundleAnalyzerOptions)));
        }
    }

    // banner
    if (!isDll &&
        appConfig.banner &&
        angularBuildContext.bannerText &&
        appConfig.entry) {
        const bannerText = angularBuildContext.bannerText;
        plugins.push(new webpack.BannerPlugin({
            banner: bannerText,
            raw: true,
            entryOnly: true
        }));
    }

    // source-maps
    let devtool: any = appConfig.sourceMapDevTool;
    if (typeof appConfig.sourceMapDevTool === 'undefined' && appConfig.sourceMap) {
        if (devServer) {
            plugins.push(new webpack.EvalSourceMapDevToolPlugin({
                moduleFilenameTemplate: '[resource-path]',
                sourceRoot: 'webpack:///'
            }));
        } else if (appConfig.platformTarget === 'node') {
            devtool = 'inline-source-map';
        } else if ((!appConfig.platformTarget || appConfig.platformTarget === 'web')) {
            devtool = undefined;
            // TODO: to review - '[resource-path]' or path.relative(appConfig.outDir || '', '[resourcePath]')
            let moduleFilenameTemplate =
                path.relative(appConfig.outDir || '', '[resourcePath]').replace(/\\/g, '/');
            plugins.push(new webpack.SourceMapDevToolPlugin({
                filename: '[file].map', // default: [file].map[query]
                // default: "webpack:///[resourcePath]"
                moduleFilenameTemplate: appConfig.sourceMapDevToolModuleFilenameTemplate || moduleFilenameTemplate,
                // default: "webpack:///[resourcePath]?[hash]"
                // fallbackModuleFilenameTemplate: projectConfig.sourceMapFallbackModuleFilenameTemplate ||
                //    defaultModuleFilenameTemplate
                // sourceRoot: 'webpack:///'
            }));
        }
    }

    // CircularDependencyPlugin
    let showCircularDependencies = appConfig.showCircularDependencies;
    if (typeof showCircularDependencies === 'undefined') {
        showCircularDependencies = environment.prod;
    }
    if (showCircularDependencies && !isDll) {
        plugins.push(new CircularDependencyPlugin({
            exclude: /(\\|\/)node_modules(\\|\/)/
        }));
    }

    // Load rxjs path aliases.
    // https://github.com/ReactiveX/rxjs/blob/master/doc/lettable-operators.md#build-and-treeshaking
    let alias: any = {};
    if (!isDll) {
        try {
            const rxjsPathMappingImportModuleName =
                appConfig._ecmaVersion && appConfig._ecmaVersion > 5
                    ? 'rxjs/_esm2015/path-mapping'
                    : 'rxjs/_esm5/path-mapping';
            const rxPaths = require(resolve.sync(rxjsPathMappingImportModuleName, { basedir: projectRoot }));
            alias = rxPaths(AngularBuildContext.nodeModulesPath);
        } catch (e) {
            logger.warn(`Failed rxjs path alias. ${e.message}`);
        }
    }

    // production plugins
    if (environment.prod) {
        plugins.push(new webpack.HashedModuleIdsPlugin());

        if (!devServer) {
            if (appConfig.platformTarget !== 'node') {
                plugins.push(new webpack.optimize.ModuleConcatenationPlugin());
            }

            // This plugin must be before webpack.optimize.UglifyJsPlugin.
            plugins.push(new PurifyPlugin());

            plugins.push(new UglifyJSPlugin({
                extractComments: true,
                sourceMap: appConfig.sourceMap,
                warningsFilter: (resourceId: string): boolean => {
                    return !!resourceId && /(\\|\/)node_modules(\\|\/)/.test(resourceId);
                },
                parallel: true,
                cache: true,
                uglifyOptions: {
                    // ie8: true, // default false
                    ecma: appConfig._ecmaVersion, // default undefined
                    compress: {
                        passes: 3,
                        pure_getters: true,
                        // Disabled because of an issue with Mapbox GL when using the Webpack node global and UglifyJS:
                        // https://github.com/mapbox/mapbox-gl-js/issues/4359#issuecomment-303880888
                        // https://github.com/angular/angular-cli/issues/5804
                        // https://github.com/angular/angular-cli/pull/7931
                        typeofs: false
                    },
                    warnings: verbose, // default false
                    output: {
                        ascii_only: true, // default false
                        // comments: false, // default false
                        beautify: false // default true
                    }
                }
            }));
        }
    } else {
        plugins.push(new webpack.NamedModulesPlugin());
    }

    // telemetry plugin
    if (!AngularBuildContext.telemetryPluginAdded) {
        AngularBuildContext.telemetryPluginAdded = true;
        plugins.push(new TelemetryWebpackPlugin());
    }

    const nodeModulePaths = ['node_modules', AngularBuildContext.nodeModulesPath];

    const loaderModulePaths = [...nodeModulePaths];
    if (AngularBuildContext.angularBuildCliRootPath) {
        loaderModulePaths.push(path.resolve(AngularBuildContext.angularBuildCliRootPath, 'node_modules'));
    } else {
        loaderModulePaths.push(path.resolve(AngularBuildContext.nodeModulesPath,
            '@bizappframework/angular-build/node_modules'));
    }

    // symlinks
    let symlinks = true;
    if (appConfig._tsConfigPath &&
        appConfig._tsCompilerConfig &&
        appConfig._tsCompilerConfig.options.preserveSymlinks) {
        symlinks = false;
    }

    // library target
    if ((appConfig.libraryTarget as any) === 'es') {
        throw new InvalidConfigError(
            `The 'apps[${appConfig._index}].libraryTarget = es' is currently not supported by webpack.`);
    }
    let libraryTarget = appConfig.libraryTarget as WebpackLibraryTarget;
    if (appConfig.libraryTarget === 'iife') {
        libraryTarget = 'var';
    } else if (appConfig.libraryTarget === 'cjs') {
        libraryTarget = 'commonjs2';
    } else if (!appConfig.libraryTarget) {
        if (appConfig.platformTarget === 'node') {
            libraryTarget = 'commonjs2';
        } else {
            libraryTarget = 'var';
        }
    }

    // webpack config
    const webpackCommonConfig: webpack.Configuration = {
        name: appConfig.name,
        target: appConfig.platformTarget,
        devtool: (devtool as any),
        profile: profile,
        resolve: {
            extensions: ['.ts', '.js'],
            symlinks: symlinks,
            modules: nodeModulePaths,
            mainFields: appConfig._nodeResolveFields,
            alias: alias
        },
        resolveLoader: {
            modules: loaderModulePaths
        },
        externals: appConfig.platformTarget === 'node' ? appConfig.externals as any : undefined,
        context: projectRoot,
        output: {
            libraryTarget: libraryTarget,
            path: outDir,
            filename: `[name]${chunkHashFormat}.js`,
            chunkFilename: `[id]${chunkHashFormat}.chunk.js`,
            devtoolModuleFilenameTemplate: devtool ? appConfig.sourceMapDevToolModuleFilenameTemplate : undefined,
            devtoolFallbackModuleFilenameTemplate: devtool
                ? appConfig.sourceMapDevToolFallbackModuleFilenameTemplate
                : undefined
        },
        module: {
            rules: rules
        },
        plugins: plugins,
        stats: statOptions,
        watchOptions: AngularBuildContext.angularBuildConfig.watchOptions
    };

    // devServer
    if (devServer) {
        let outDirRel = appConfig.outDir || '';
        if (!outDirRel.endsWith('/')) {
            outDirRel = outDirRel + '/';
        }
        webpackCommonConfig.devServer = {
            historyApiFallback: true,
            contentBase: path.join(projectRoot, outDirRel),
            stats: statOptions
        };
    }

    return webpackCommonConfig;
}
