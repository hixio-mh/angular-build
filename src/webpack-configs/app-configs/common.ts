import * as path from 'path';

import * as resolve from 'resolve';
import * as webpack from 'webpack';

import { LicenseWebpackPlugin } from 'license-webpack-plugin';

import { BundleAnalyzerWebpackPlugin } from '../../plugins/bundle-analyzer-webpack-plugin';
import { CleanCssWebpackPlugin } from '../../plugins/cleancss-webpack-plugin';
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
import { outputHashFormat } from '../../helpers/output-hash-format';

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
    env?: PreDefinedEnvironment): { [key: string]: any } {
    const environment = env ? env as PreDefinedEnvironment : AngularBuildContext.environment;
    const projectRoot = AngularBuildContext.projectRoot;
    const fromAngularBuildCli = AngularBuildContext.fromAngularBuildCli;
    const logger = AngularBuildContext.logger;
    const verbose = AngularBuildContext.angularBuildConfig.logLevel === 'debug';

    const hot = environment.hot;
    const watch = AngularBuildContext.watch;
    const devServer = isWebpackDevServer();

    const appConfig = angularBuildContext.projectConfig as AppProjectConfigInternal;
    const isDll = environment.dll;
    const srcDir = path.resolve(projectRoot, appConfig.srcDir || '');
    const outDir = appConfig.outDir ? path.resolve(projectRoot, appConfig.outDir) : undefined;

    const extractedAssetsHashFormat = (!appConfig.platformTarget || appConfig.platformTarget === 'web') &&
        appConfig.extractedAssetsHash !== false
        ? outputHashFormat.extractedAssets
        : '';

    const chunksHashFormat = (!appConfig.platformTarget || appConfig.platformTarget === 'web') &&
        appConfig.chunksHash
        ? outputHashFormat.chunk
        : '';

    const bundleHashFormat = (!appConfig.platformTarget || appConfig.platformTarget === 'web') &&
        appConfig.bundlesHash
        ? outputHashFormat.bundle
        : '';

    const vendorChunkName = appConfig.vendorChunkName || 'vendor';

    // rules
    const rules: webpack.Rule[] = [
        {
            test: /\.html$/,
            loader: 'raw-loader'
        },
        {
            test: /\.(eot|svg|cur)$/,
            loader: 'file-loader',
            options: {
                name: `[name]${extractedAssetsHashFormat}.[ext]`,
                limit: 10000
            }
        },
        {
            test: /\.(jpg|png|webp|gif|otf|ttf|woff|woff2|ani)$/,
            loader: 'url-loader',
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
    if (AngularBuildContext.progress && fromAngularBuildCli && !devServer && !hot && !watch) {
        plugins.push(new webpack.ProgressPlugin());
    }
    // clean
    let shouldClean = outDir &&
        (AngularBuildContext.cleanOutDirs || appConfig.clean);
    if (appConfig.clean === false) {
        shouldClean = false;
    }
    if (shouldClean) {
        let cleanOptions: CleanOptions = {};
        if (typeof appConfig.clean === 'object') {
            cleanOptions = { ...cleanOptions, ...appConfig.clean };
        }

        let beforeRunOptionsUndefined = false;
        if (typeof cleanOptions.beforeRun === 'undefined') {
            beforeRunOptionsUndefined = true;
        }

        cleanOptions.beforeRun = cleanOptions.beforeRun || {} as BeforeRunCleanOptions;
        const beforeRunOption = cleanOptions.beforeRun;
        if (beforeRunOptionsUndefined && AngularBuildContext.cleanOutDirs) {
            beforeRunOption.cleanOutDir = true;
        }

        if (!isDll && appConfig.referenceDll && beforeRunOption.cleanOutDir) {
            // logger.debug(
            //    `The 'apps[${projectConfig._index
            //    }].clean.beforeCompileOption.cleanOutDir' will be disabled when 'referenceDll' is true`);
            beforeRunOption.cleanOutDir = false;
        }

        plugins.push(new CleanWebpackPlugin({
            ...cleanOptions,
            projectRoot: projectRoot,
            outputPath: outDir,
            forceCleanToDisk: isDll,
            loggerOptions: {
                logLevel: AngularBuildContext.angularBuildConfig.logLevel
            }
        }));
    }

    // copy assets
    if (appConfig.copy && appConfig.copy.length && !isDll) {
        plugins.push(new CopyWebpackPlugin({
            assets: appConfig.copy,
            baseDir: srcDir,
            outputPath: outDir,
            loggerOptions: {
                logLevel: AngularBuildContext.angularBuildConfig.logLevel
            }
        }));
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
    if (typeof devtool === 'undefined' && AngularBuildContext.commandOptions.devtool) {
        devtool = AngularBuildContext.commandOptions.devtool;
    }
    if (typeof devtool === 'undefined' && appConfig.sourceMap) {
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
            const moduleFilenameTemplate =
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

    if (!isDll) {
        // EnvironmentPlugin
        let shouldDefineEnvVar = true;
        if (appConfig.environmentVariables === false) {
            shouldDefineEnvVar = false;
        }
        if (shouldDefineEnvVar) {
            const envVariables: { [key: string]: any } = {};
            if (AngularBuildContext.isProductionMode) {
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
    }

    if (AngularBuildContext.isProductionMode && !devServer) {
        plugins.push(new LicenseWebpackPlugin({
            pattern: /^(MIT|ISC|BSD.*)$/,
            suppressErrors: true,
            perChunkOutput: false,
            outputFilename: '3rdpartylicenses.txt'
        }));
    }

    let concatenateModules = false;
    if (AngularBuildContext.isProductionMode &&
        !devServer &&
        appConfig.platformTarget !== 'node' &&
        appConfig.concatenateModules !== false) {
        concatenateModules = true;
    }

    // bundle analyzer report
    let profile = AngularBuildContext.commandOptions.profile ? true : false;
    if (appConfig.bundleAnalyzer) {
        let hasEntry = false;
        if (isDll) {
            if (appConfig.dlls) {
                const dllEntry = appConfig.dlls;
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
            let bundleAnalyzerOptions: BundleAnalyzerOptions = {};
            if (typeof appConfig.bundleAnalyzer === 'object') {
                bundleAnalyzerOptions = { ...bundleAnalyzerOptions, ...appConfig.bundleAnalyzer };
            }

            if (devServer || hot || watch) {
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
                outputPath: outDir,
                loggerOptions: {
                    logLevel: 'error'
                },
                stats: appConfig.stats as webpack.Stats.ToJsonOptionsObject
            }));
        }
    }

    // telemetry plugin
    if (!AngularBuildContext.telemetryPluginAdded) {
        AngularBuildContext.telemetryPluginAdded = true;
        plugins.push(new TelemetryWebpackPlugin());
    }

    const nodeModulePaths = ['node_modules'];
    if (AngularBuildContext.nodeModulesPath) {
        nodeModulePaths.push(AngularBuildContext.nodeModulesPath);
    }
    if (appConfig.moduleRoots && appConfig.moduleRoots.length) {
        appConfig.moduleRoots.forEach(p => {
            if (path.isAbsolute(p)) {
                nodeModulePaths.push(path.resolve(p));
            } else {
                nodeModulePaths.push(path.resolve(projectRoot, p));
            }
        });
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
    const webpackCommonConfig = {
        name: appConfig.name,
        mode: AngularBuildContext.isProductionMode
            ? 'production'
            : AngularBuildContext.commandOptions.mode
                ? AngularBuildContext.commandOptions.mode
                : 'development',
        target: appConfig.platformTarget,
        devtool: (devtool as any),
        profile: profile,
        resolve: {
            extensions: ['.ts', '.js'],
            symlinks: symlinks,
            modules: [srcDir, ...nodeModulePaths],
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
            filename: `[name]${bundleHashFormat}.js`,
            chunkFilename: `[id]${chunksHashFormat}.chunk.js`,
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
            concatenateModules: concatenateModules,
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
                        // ie8: true, // default false
                        ecma: appConfig._ecmaVersion, // default undefined
                        safari10: true,
                        compress: {
                            pure_getters: true,
                            passes: 3
                        },
                        warnings: verbose, // default false
                        output: {
                            ascii_only: true, // default false
                            // comments: false, // default false
                            beautify: false, // default true
                            comments: false,
                            webkit: true
                        }
                    }
                })
            ],
        },
        stats: statOptions,
        watchOptions: AngularBuildContext.angularBuildConfig.watchOptions
    };

    // devServer
    if (devServer) {
        let outDirRel = appConfig.outDir || '';
        if (!outDirRel.endsWith('/')) {
            outDirRel = outDirRel + '/';
        }
        (webpackCommonConfig as any).devServer = {
            historyApiFallback: true,
            contentBase: path.join(projectRoot, outDirRel),
            stats: statOptions
        };
    }

    return webpackCommonConfig;
}
