// tslint:disable:no-any
// tslint:disable:no-unsafe-any
// tslint:disable:no-var-requires
// tslint:disable:no-require-imports

import * as path from 'path';

import * as resolve from 'resolve';
import {
    BannerPlugin,
    Configuration,
    EnvironmentPlugin,
    HashedModuleIdsPlugin,
    Options, Plugin,
    ProgressPlugin,
    RuleSetRule, Stats
} from 'webpack';

import { BundleAnalyzerWebpackPlugin } from '../../plugins/bundle-analyzer-webpack-plugin';
import { CleanWebpackPlugin } from '../../plugins/clean-webpack-plugin';
import { CleanCssWebpackPlugin } from '../../plugins/cleancss-webpack-plugin';
import { CopyWebpackPlugin } from '../../plugins/copy-webpack-plugin';

import { AngularBuildContext } from '../../build-context';
import {
    getWebpackToStringStatsOptions,
    isFromWebpackCli,
    isFromWebpackDevServer,
    outputHashFormat,
    prepareCleanOptions,
    resolveLoaderPath
} from '../../helpers';
import { BundleAnalyzerOptions } from '../../models';
import { InternalError } from '../../models/errors';
import { AppProjectConfigInternal } from '../../models/internals';

// tslint:disable:variable-name
const LicenseWebpackPlugin = require('license-webpack-plugin').LicenseWebpackPlugin;
const TerserPlugin = require('terser-webpack-plugin');

// tslint:disable:max-func-body-length
export function getAppCommonWebpackConfigPartial(angularBuildContext: AngularBuildContext<AppProjectConfigInternal>): Configuration {
    const logger = AngularBuildContext.logger;

    const logLevel = angularBuildContext.buildOptions.logLevel;
    const verbose = angularBuildContext.buildOptions.logLevel === 'debug';
    const watch = angularBuildContext.buildOptions.watch;
    const watchOptions = angularBuildContext.buildOptions.watchOptions;
    const appConfig = angularBuildContext.projectConfig;

    if (!appConfig._projectRoot) {
        throw new InternalError("The 'appConfig._projectRoot' is not set.");
    }

    if (!appConfig._outputPath) {
        throw new InternalError("The 'appConfig._outputPath' is not set.");
    }

    const projectRoot = appConfig._projectRoot;
    const outputPath = appConfig._outputPath;
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
    const rules: RuleSetRule[] = [
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
    const statOptions: Options.Stats =
        getWebpackToStringStatsOptions(verbose, appConfig.stats);

    // plugins
    const plugins: Plugin[] = [];

    // progress
    if (angularBuildContext.buildOptions.progress && !isWebpackCli) {
        plugins.push(new ProgressPlugin());
    }

    // clean
    const isReferenceDll = appConfig.referenceDll && !appConfig._isDll;
    let shouldClean = (angularBuildContext.buildOptions.cleanOutDir && !isReferenceDll) ||
        appConfig.clean || (appConfig.clean !== false && !isReferenceDll);
    if (appConfig.clean === false) {
        shouldClean = false;
    }
    if (shouldClean) {
        const cleanOptions = prepareCleanOptions(appConfig);
        const cacheDirs: string[] = [];

        plugins.push(new CleanWebpackPlugin({
            ...cleanOptions,
            workspaceRoot: AngularBuildContext.workspaceRoot,
            outputPath: outputPath,
            cacheDirectries: cacheDirs,
            forceCleanToDisk: isDll,
            host: angularBuildContext.host,
            logLevel: logLevel
        }));
    }

    // copy assets
    if (appConfig.copy && Array.isArray(appConfig.copy) && appConfig.copy.length && !isDll) {
        plugins.push(new CopyWebpackPlugin({
            assets: appConfig.copy,
            baseDir: projectRoot,
            outputPath: outputPath,
            logLevel: logLevel
        }));
    }

    // banner
    if (!isDll &&
        appConfig.banner &&
        appConfig._bannerText &&
        appConfig.entry) {
        const bannerText = appConfig._bannerText;
        plugins.push(new BannerPlugin({
            banner: bannerText,
            raw: true,
            entryOnly: true
        }));
    }

    // source-maps
    let devtool = appConfig.sourceMapDevTool as any;
    if (devtool == null && appConfig.sourceMap) {
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
            // tslint:disable-next-line:non-literal-require
            const pathMapping = require(resolve.sync(rxjsPathMappingImportModuleName,
                { basedir: AngularBuildContext.nodeModulesPath || AngularBuildContext.workspaceRoot }));
            alias = pathMapping();
        } catch (e) {
            logger.warn(`Failed rxjs path alias. ${e.message}`);
        }
    }

    // EnvironmentPlugin
    if (!isDll && appConfig.environmentVariables) {
        const envVariables: { [key: string]: string | boolean } = {};
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
            new EnvironmentPlugin(envVariables)
        );
    }

    // extractLicenses
    if (appConfig.extractLicenses) {
        plugins.push(new LicenseWebpackPlugin({
            stats: {
                warnings: verbose,
                errors: verbose
            },
            suppressErrors: true,
            perChunkOutput: false,
            outputFilename: appConfig.extractLicenseOutputFilename || '3rdpartylicenses.txt'
        }));
    }

    // bundle analyzer report
    let profile = false;
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
                logLevel: 'error',
                stats: appConfig.stats as Stats.ToJsonOptionsObject
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
            '@dagonmetric/angular-build/node_modules');
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

    // mode
    let mode: 'development' | 'production' | 'none' = 'none';
    if (appConfig.optimization) {
        mode = 'production';
    } else {
        mode = 'development';
    }

    const terserOptions = {
        ecma: appConfig._ecmaVersion, // default undefined
        warnings: verbose, // default false
        safari10: true,
        output: {
            ascii_only: true,
            comments: false,
            webkit: true,
        },

        // On server, we don't want to compress anything. We still set the ngDevMode = false for it
        // to remove dev code.
        compress: (appConfig.platformTarget === 'node' ? {
            global_defs: {
                ngDevMode: false
            },
        } : {
                pure_getters: appConfig.buildOptimizer && !isDll,
                // PURE comments work best with 3 passes.
                // See https://github.com/webpack/webpack/issues/2899#issuecomment-317425926.
                passes: appConfig.buildOptimizer && !isDll ? 3 : 1,
                global_defs: {
                    ngDevMode: false
                },
            }),
        ...(appConfig.platformTarget === 'node' ? { mangle: false } : {})
    };

    // webpack config
    // tslint:disable-next-line:no-unnecessary-local-variable
    const webpackCommonConfig: Configuration = {
        name: appConfig.name,
        mode: mode,
        target: appConfig.platformTarget,
        devtool: devtool,
        profile: profile,
        resolve: {
            extensions: ['.ts', '.tsx', '.mjs', '.js'],
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
            libraryTarget: appConfig.libraryTarget,
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
                new HashedModuleIdsPlugin(),
                new CleanCssWebpackPlugin({
                    sourceMap: appConfig.sourceMap,
                    // component styles retain their original file name
                    test: (file) => /\.(?:css|scss|sass|less|styl)$/.test(file),
                }),
                new TerserPlugin({
                    sourceMap: appConfig.sourceMap,
                    parallel: true,
                    cache: true,
                    terserOptions,
                })
            ]
        },
        stats: statOptions,
        watchOptions: watchOptions
    };

    return webpackCommonConfig;
}
