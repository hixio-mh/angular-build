import * as path from 'path';
import * as resolve from 'resolve';
import * as webpack from 'webpack';
import { LicenseWebpackPlugin } from 'license-webpack-plugin';

import { BundleAnalyzerWebpackPlugin } from '../../plugins/bundle-analyzer-webpack-plugin';
import { CleanCssWebpackPlugin } from '../../plugins/cleancss-webpack-plugin';
import { CleanWebpackPlugin } from '../../plugins/clean-webpack-plugin';
import { CopyWebpackPlugin } from '../../plugins/copy-webpack-plugin';

import { AngularBuildContext, AppProjectConfigInternal } from '../../build-context';
import { InvalidConfigError } from '../../error-models';
import {
    isFromWebpackCli,
    isFromWebpackDevServer,
    getWebpackToStringStatsOptions,
    outputHashFormat,
    resolveLoaderPath
} from '../../helpers';
import { BeforeBuildCleanOptions, BundleAnalyzerOptions, CleanOptions } from '../../interfaces';

const UglifyJSPlugin = require('uglifyjs-webpack-plugin');

type WebpackLibraryTarget = 'var' | 'amd' | 'commonjs' | 'commonjs2' | 'umd';

export function
    getAppCommonWebpackConfigPartial<TConfig extends AppProjectConfigInternal>(angularBuildContext:
        AngularBuildContext<TConfig>): webpack.Configuration {
    const logger = AngularBuildContext.logger;

    const logLevel = angularBuildContext.buildOptions.logLevel;
    let profile = (angularBuildContext.buildOptions as any).profile ? true : false;
    const verbose = angularBuildContext.buildOptions.logLevel === 'debug';
    const watch = angularBuildContext.buildOptions.watch;
    const watchOptions = angularBuildContext.buildOptions.watchOptions;

    const appConfig = angularBuildContext.projectConfig as AppProjectConfigInternal;

    const projectRoot = path.resolve(AngularBuildContext.workspaceRoot, appConfig.root || '');
    const outputPath = appConfig.outputPath
        ? path.resolve(AngularBuildContext.workspaceRoot, appConfig.outputPath)
        : undefined;
    const isDll = appConfig._isDll;

    const isWebpackCli = isFromWebpackCli();
    const isWebpackDevServer = isFromWebpackDevServer();

    const extractedAssetsHashFormat = (!appConfig.platformTarget || appConfig.platformTarget === 'web') &&
        appConfig._outputHashing &&
        appConfig._outputHashing.extractedAssets !== false
        ? outputHashFormat.extractedAssets
        : '';

    const bundleHashFormat = (!appConfig.platformTarget || appConfig.platformTarget === 'web') &&
        appConfig._outputHashing &&
        appConfig._outputHashing.bundles
        ? outputHashFormat.chunk
        : '';

    const vendorChunkName = appConfig.vendorChunkName || 'vendor';

    const rawLoader = resolveLoaderPath('raw-loader');
    const fileLoader = resolveLoaderPath('file-loader');
    const urlLoader = resolveLoaderPath('url-loader');

    // rules
    const rules: webpack.RuleSetRule[] = [
        {
            test: /\.html$/,
            loader: rawLoader
        },
        {
            test: /\.(eot|svg|cur)$/,
            loader: fileLoader,
            options: {
                name: `[name]${extractedAssetsHashFormat}.[ext]`,
                limit: 10000
            }
        },
        {
            test: /\.(jpg|png|webp|gif|otf|ttf|woff|woff2|ani)$/,
            loader: urlLoader,
            options: {
                name: `[name]${extractedAssetsHashFormat}.[ext]`,
                limit: 10000
            }
        }
    ];

    // hot || devServer ? 'errors-only'
    const statOptions: webpack.Options.Stats =
        getWebpackToStringStatsOptions(verbose, appConfig.stats);

    // plugins
    const plugins: webpack.Plugin[] = [];

    // progress
    if (angularBuildContext.buildOptions.progress && !isWebpackCli) {
        plugins.push(new webpack.ProgressPlugin());
    }

    // clean
    let shouldClean = outputPath &&
        (angularBuildContext.buildOptions.cleanOutDir || appConfig.clean);
    if (appConfig.clean === false) {
        shouldClean = false;
    }
    if (shouldClean) {
        let cleanOptions: CleanOptions = {};
        if (typeof appConfig.clean === 'object') {
            cleanOptions = { ...cleanOptions, ...appConfig.clean };
        }

        cleanOptions.beforeBuild = cleanOptions.beforeBuild || {} as BeforeBuildCleanOptions;
        const beforeBuildOption = cleanOptions.beforeBuild;
        if (typeof cleanOptions.beforeBuild === 'undefined' && angularBuildContext.buildOptions.cleanOutDir) {
            beforeBuildOption.cleanOutDir = true;
        }

        if (!isDll && appConfig.referenceDll && beforeBuildOption.cleanOutDir) {
            beforeBuildOption.cleanOutDir = false;
        }

        if (beforeBuildOption.cleanOutDir && typeof beforeBuildOption.cleanCache === 'undefined') {
            beforeBuildOption.cleanCache = true;
        }

        const cacheDirs: string[] = [];
        if (beforeBuildOption.cleanCache) {
            if (angularBuildContext.buildOptimizerCacheDirectory) {
                cacheDirs.push(angularBuildContext.buildOptimizerCacheDirectory);
            }
            if (angularBuildContext.iconsStatCacheDirectory) {
                cacheDirs.push(angularBuildContext.iconsStatCacheDirectory);
            }
        }

        plugins.push(new CleanWebpackPlugin({
            ...cleanOptions,
            workspaceRoot: AngularBuildContext.workspaceRoot,
            outputPath: outputPath,
            cacheDirectries: cacheDirs,
            forceCleanToDisk: isDll,
            host: angularBuildContext.host,
            loggerOptions: {
                logLevel: logLevel
            }
        }));
    }

    // copy assets
    if (appConfig.copy && Array.isArray(appConfig.copy) && appConfig.copy.length && !isDll) {
        plugins.push(new CopyWebpackPlugin({
            assets: appConfig.copy,
            baseDir: projectRoot,
            outputPath: outputPath,
            loggerOptions: {
                logLevel: logLevel
            }
        }));
    }

    // banner
    if (!isDll &&
        appConfig.banner &&
        appConfig._bannerText &&
        appConfig.entry) {
        const bannerText = appConfig._bannerText;
        plugins.push(new webpack.BannerPlugin({
            banner: bannerText,
            raw: true,
            entryOnly: true
        }));
    }

    // source-maps
    let devtool: any = appConfig.sourceMapDevTool;
    if (typeof devtool === 'undefined' && appConfig.sourceMap) {
        if (isWebpackDevServer) {
            devtool = 'eval';
        } else if (appConfig.platformTarget === 'node') {
            devtool = 'inline-source-map';
        } else if ((!appConfig.platformTarget || appConfig.platformTarget === 'web')) {
            devtool = 'source-map';
        }
    }

    // Load rxjs path aliases.
    // https://github.com/ReactiveX/rxjs/blob/master/doc/lettable-operators.md#build-and-treeshaking
    let alias: any = {};
    if (!isDll) {
        try {
            const rxjsPathMappingImportModuleName =
                appConfig._supportES2015
                    ? 'rxjs/_esm2015/path-mapping'
                    : 'rxjs/_esm5/path-mapping';
            const pathMapping = require(resolve.sync(rxjsPathMappingImportModuleName,
                { basedir: AngularBuildContext.nodeModulesPath || AngularBuildContext.workspaceRoot }));
            alias = pathMapping();
        } catch (e) {
            logger.warn(`Failed rxjs path alias. ${e.message}`);
        }
    }

    // EnvironmentPlugin
    if (!isDll && appConfig.environmentVariables) {
        const envVariables: { [key: string]: any } = {};
        if (appConfig.optimization) {
            envVariables.NODE_ENV = 'production';
        }

        if (appConfig.environmentVariables && typeof appConfig.environmentVariables === 'object') {
            const userEnvVariables = appConfig.environmentVariables as { [key: string]: boolean | string };
            Object.keys(userEnvVariables)
                .filter((key: string) => !(key in envVariables))
                .forEach((key: string) => {
                    let envValue = userEnvVariables[key];
                    const envStr = 'process.env.';
                    if (typeof envValue === 'string' &&
                        envValue.startsWith(envStr) &&
                        envValue.length > envStr.length) {
                        const envKey = envValue.substr(envStr.length);
                        const processEnvValue = process.env[envKey];
                        if (processEnvValue !== undefined) {
                            envValue = processEnvValue;
                        }
                    }

                    envVariables[key] = envValue;
                });
        }

        plugins.push(
            new webpack.EnvironmentPlugin(envVariables)
        );
    }

    // extractLicenses
    if (appConfig.extractLicenses) {
        plugins.push(new LicenseWebpackPlugin({
            pattern: /.*/,
            suppressErrors: true,
            perChunkOutput: false,
            outputFilename: appConfig.extractLicenseOutputFilename || '3rdpartylicenses.txt'
        }));
    }

    // bundle analyzer report
    if (appConfig.bundleAnalyzer) {
        let hasEntry = false;
        if (isDll) {
            if (appConfig.vendors && appConfig.vendors.length > 0) {
                hasEntry = true;
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
            let bundleAnalyzerOptions: BundleAnalyzerOptions = {};
            if (typeof appConfig.bundleAnalyzer === 'object') {
                bundleAnalyzerOptions = { ...bundleAnalyzerOptions, ...appConfig.bundleAnalyzer };
            }

            if (watch || isWebpackDevServer) {
                bundleAnalyzerOptions.openAnalyzer = false;
            }

            if (isDll) {
                const vendorStatsFile = `${vendorChunkName}-stats.json`;
                const vendorStatsReportFile = `${vendorChunkName}-stats-report.html`;
                bundleAnalyzerOptions.statsFilename = bundleAnalyzerOptions.statsFilename || vendorStatsFile;
                bundleAnalyzerOptions.reportFilename = bundleAnalyzerOptions.reportFilename || vendorStatsReportFile;
            }

            plugins.push(new BundleAnalyzerWebpackPlugin({
                ...bundleAnalyzerOptions,
                outputPath: outputPath,
                loggerOptions: {
                    logLevel: 'error'
                },
                stats: appConfig.stats as webpack.Stats.ToJsonOptionsObject
            }));
        }
    }

    const nodeModulePaths = ['node_modules'];
    if (AngularBuildContext.nodeModulesPath) {
        nodeModulePaths.push(AngularBuildContext.nodeModulesPath);
    }

    const loaderModulePaths = [...nodeModulePaths];
    if (AngularBuildContext.cliRootPath) {
        const cliNodeModulePath = path.resolve(AngularBuildContext.cliRootPath, 'node_modules');
        if (!loaderModulePaths.includes(cliNodeModulePath)) {
            loaderModulePaths.push(cliNodeModulePath);
        }
    } else if (AngularBuildContext.nodeModulesPath) {
        const cliNodeModulePath = path.resolve(AngularBuildContext.nodeModulesPath,
            '@bizappframework/angular-build/node_modules');
        if (!loaderModulePaths.includes(cliNodeModulePath)) {
            loaderModulePaths.push(cliNodeModulePath);
        }
    }

    // symlinks
    let symlinks = true;
    if (appConfig._tsConfigPath &&
        appConfig._tsCompilerConfig &&
        appConfig._tsCompilerConfig.options.preserveSymlinks) {
        symlinks = false;
    }

    let projectBaseUrl = projectRoot;
    if (appConfig._tsConfigPath &&
        appConfig._tsCompilerConfig &&
        appConfig._tsCompilerConfig.options.baseUrl) {
        projectBaseUrl = appConfig._tsCompilerConfig.options.baseUrl;
    }

    // library target
    if ((appConfig.libraryTarget as any) === 'es') {
        throw new InvalidConfigError(
            `The 'projects[${appConfig.name || appConfig._index
            }].libraryTarget = es' is currently not supported by webpack.`);
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

    // mode
    let mode: 'development' | 'production' | 'none' = 'none';
    if (appConfig.optimization) {
        mode = 'production';
    } else {
        mode = 'development';
    }

    // webpack config
    const webpackCommonConfig: webpack.Configuration = {
        name: appConfig.name,
        mode: mode,
        target: appConfig.platformTarget,
        devtool: (devtool as any),
        profile: profile,
        resolve: {
            extensions: ['.ts', '.mjs', '.js'],
            symlinks: symlinks,
            modules: [projectBaseUrl, ...nodeModulePaths],
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
            path: outputPath,
            filename: `[name]${bundleHashFormat}.js`,
            devtoolModuleFilenameTemplate: devtool ? appConfig.sourceMapDevToolModuleFilenameTemplate : undefined,
            devtoolFallbackModuleFilenameTemplate: devtool
                ? appConfig.sourceMapDevToolFallbackModuleFilenameTemplate
                : undefined
        },
        module: {
            rules: rules
        },
        plugins: plugins,
        optimization: {
            noEmitOnErrors: true,
            concatenateModules: !isDll && appConfig.concatenateModules,
            minimizer: [
                new webpack.HashedModuleIdsPlugin(),
                new CleanCssWebpackPlugin({
                    sourceMap: appConfig.sourceMap,
                    // component styles retain their original file name
                    test: (file) => /\.(?:css|scss|sass|less|styl)$/.test(file),
                }),
                new UglifyJSPlugin({
                    // extractComments: true,
                    sourceMap: appConfig.sourceMap,
                    // warningsFilter: (resourceId: string): boolean => {
                    //    return !!resourceId && /(\\|\/)node_modules(\\|\/)/.test(resourceId);
                    // },
                    parallel: true,
                    cache: true,
                    uglifyOptions: {
                        warnings: verbose, // default false
                        // ie8: true, // default false
                        ecma: appConfig._ecmaVersion, // default undefined
                        safari10: true,
                        compress: appConfig.platformTarget === 'node' ? false : {
                            pure_getters: appConfig.buildOptimizer && !isDll,
                            passes: appConfig.buildOptimizer && !isDll ? 3 : 1,
                            // Workaround known uglify-es issue
                            // See https://github.com/mishoo/UglifyJS2/issues/2949#issuecomment-368070307
                            inline: appConfig._supportES2015 ? 1 : 3
                        },
                        mangle: !(appConfig.platformTarget === 'node'),
                        output: {
                            ascii_only: true, // default false
                            // comments: false, // default false
                            // beautify: false, // default true
                            comments: false,
                            webkit: true
                        }
                    }
                })
            ]
        },
        stats: statOptions,
        watchOptions: watchOptions
    };

    // devServer
    if (isWebpackDevServer && !isDll) {
        let outDirRel = appConfig.outputPath || '';
        if (!outDirRel.endsWith('/')) {
            outDirRel = outDirRel + '/';
        }
        webpackCommonConfig.devServer = {
            historyApiFallback: true,
            contentBase: path.join(AngularBuildContext.workspaceRoot, outDirRel),
            stats: statOptions
        };
    }

    return webpackCommonConfig;
}
