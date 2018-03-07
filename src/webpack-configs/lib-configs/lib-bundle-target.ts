import { existsSync } from 'fs';
import * as path from 'path';

import * as resolve from 'resolve';
import * as webpack from 'webpack';

import { LicenseWebpackPlugin } from 'license-webpack-plugin';

import {
    AngularBuildContext,
    BundleOptionsInternal,
    InternalError,
    InvalidConfigError,
    LibProjectConfigInternal
} from '../../models';

import { getAngularGlobals } from '../../helpers/angular-globals';
import { isWebpackDevServer } from '../../helpers/is-webpack-dev-server';
import { getCustomWebpackConfig } from '../../helpers/get-custom-webpack-config';
import { getRxJsGlobals } from '../../helpers/rxjs-globals';

const UglifyJSPlugin = require('uglifyjs-webpack-plugin');
const nodeExternals = require('webpack-node-externals');
const webpackMerge = require('webpack-merge');

/**
 * Enumerate loaders and their dependencies from this file to let the dependency validator
 * know they are used.
 * require('ts-loader')
 */

type WebpackLibraryTarget = 'var' | 'amd' | 'commonjs' | 'commonjs2' | 'umd';

export function getLibBundleTargetWebpackConfig(angularBuildContext: AngularBuildContext,
    currentBundle: BundleOptionsInternal,
    outputFilePath: string): { [key: string]: any } {
    if (!currentBundle._entryFilePath) {
        throw new InternalError("The 'currentBundle._entryFilePath' is not set.");
    }

    const environment = AngularBuildContext.environment;
    const projectRoot = AngularBuildContext.projectRoot;
    const fromAngularBuildCli = AngularBuildContext.fromAngularBuildCli;
    const logger = AngularBuildContext.logger;
    const verbose = AngularBuildContext.angularBuildConfig.logLevel === 'debug';

    const hot = environment.hot;
    const watch = AngularBuildContext.watch;
    const devServer = isWebpackDevServer();

    const libConfig = angularBuildContext.projectConfig as LibProjectConfigInternal;

    const isTsEntry = /\.ts$/i.test(currentBundle._entryFilePath);
    const moduleName = libConfig.libraryName || angularBuildContext.packageNameWithoutScope;

    // library target
    if (currentBundle.libraryTarget === 'es') {
        throw new InvalidConfigError(
            `The 'libs[${libConfig._index}].bundles[${currentBundle._index
            }].libraryTarget = es' is currently not supported by webpack.`);
    }

    let libraryTarget = currentBundle.libraryTarget as WebpackLibraryTarget;
    if (currentBundle.libraryTarget === 'iife') {
        libraryTarget = 'var';
    } else if (currentBundle.libraryTarget === 'cjs') {
        libraryTarget = 'commonjs2';
    } else if (!currentBundle.libraryTarget) {
        if (libConfig.platformTarget === 'node') {
            libraryTarget = 'commonjs2';
        } else {
            libraryTarget = 'umd';
        }
    }

    // platform target
    let platformTarget = libConfig.platformTarget;
    if (!platformTarget && (libraryTarget === 'commonjs' || libraryTarget === 'commonjs2')) {
        platformTarget = 'node';
    }

    // externals
    const externals: any = [];
    let includeCommonJsModules = true;
    if (currentBundle.nodeModulesAsExternals !== false) {
        externals.push(nodeExternals());
        includeCommonJsModules = false;
    }

    if (typeof currentBundle.externals === 'undefined') {
        if (currentBundle.includeAngularAndGlobals ||
            (currentBundle.includeAngularAndGlobals !== false && !includeCommonJsModules)) {
            externals.push(getAngularGlobals());
            externals.push(getRxJsGlobals());
        }
    } else {
        let noExternals = false;
        if (!currentBundle.externals ||
            (Array.isArray(currentBundle.externals) && !currentBundle.externals.length) ||
            (typeof currentBundle.externals === 'object' && !Object.keys(currentBundle.externals).length)) {
            noExternals = true;
        }

        if (noExternals) {
            if (currentBundle.includeAngularAndGlobals !== false) {
                externals.push(getAngularGlobals());
                externals.push(getRxJsGlobals());
            }
        } else {
            if (Array.isArray(currentBundle.externals)) {
                externals.push(...currentBundle.externals);
            } else {
                externals.push(currentBundle.externals);
            }

            if (currentBundle.includeAngularAndGlobals !== false) {
                externals.push(getAngularGlobals());
                externals.push(getRxJsGlobals());
            }
        }
    }

    const rules: webpack.Rule[] = [];
    const plugins: webpack.Plugin[] = [];
    const resolvePlugins: webpack.Plugin[] = [];

    // progress
    if (AngularBuildContext.progress && fromAngularBuildCli && !devServer && !hot && !watch) {
        plugins.push(new webpack.ProgressPlugin());
    }

    // banner
    if (libConfig.banner &&
        angularBuildContext.bannerText) {
        const bannerText = angularBuildContext.bannerText;
        plugins.push(new webpack.BannerPlugin({
            banner: bannerText,
            raw: true,
            entryOnly: true
        }));
    }

    if (isTsEntry) {
        const tsConfigPath = currentBundle._tsConfigPath;
        const tsLoaderOptions: { [key: string]: any } = {
            instance: `at-${libConfig.name || 'libs[' + libConfig._index + ']'}-loader`,
            transpileOnly: currentBundle.tsconfig ? false : true,
            onlyCompileBundledFiles: currentBundle.tsconfig ? false : true,
            silent: AngularBuildContext.angularBuildConfig.logLevel !== 'debug'
        };

        if (currentBundle.tsconfig && tsConfigPath) {
            tsLoaderOptions.configFile = tsConfigPath;
        }
        if (AngularBuildContext.angularBuildConfig.logLevel) {
            tsLoaderOptions.logLevel = AngularBuildContext.angularBuildConfig.logLevel;
        }

        rules.push({
            test: /\.ts$/,
            use: [
                {
                    loader: 'ts-loader',
                    options: tsLoaderOptions
                }
            ]
        });
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

    let symlinks = true;
    if (isTsEntry &&
        currentBundle._tsConfigPath &&
        currentBundle._tsCompilerConfig &&
        currentBundle._tsCompilerConfig.options.preserveSymlinks) {
        symlinks = false;
    }

    let alias: any = {};
    if (!currentBundle.nodeModulesAsExternals &&
        !currentBundle.includeAngularAndGlobals &&
        AngularBuildContext.nodeModulesPath &&
        existsSync(path.resolve(AngularBuildContext.nodeModulesPath, 'rxjs'))) {
        try {
            const rxjsPathMappingImportModuleName =
                currentBundle._ecmaVersion && currentBundle._ecmaVersion > 5
                    ? 'rxjs/_esm2015/path-mapping'
                    : 'rxjs/_esm5/path-mapping';
            const pathMapping = require(resolve.sync(rxjsPathMappingImportModuleName,
                { basedir: AngularBuildContext.nodeModulesPath || projectRoot }));
            alias = pathMapping();
        } catch (e) {
            logger.warn(`Failed rxjs path alias. ${e.message}`);
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

    const webpackConfig: webpack.Configuration = {
        target: platformTarget,
        devtool: libConfig.sourceMap ? 'source-map' : undefined,
        entry: currentBundle._entryFilePath,
        output: {
            path: path.dirname(outputFilePath),
            filename: path.basename(outputFilePath),
            library: moduleName,
            libraryTarget: libraryTarget,
            umdNamedDefine: libraryTarget === 'umd' && currentBundle.namedExports ? true : undefined
        },
        resolve: {
            extensions: isTsEntry ? ['.ts', '.js'] : ['.js'],
            symlinks: symlinks,
            modules: nodeModulePaths,
            mainFields: currentBundle._nodeResolveFields,
            alias: alias,
            plugins: resolvePlugins
        },
        resolveLoader: {
            modules: loaderModulePaths
        },
        externals: externals,
        context: projectRoot,
        module: {
            rules: rules
        },
        plugins: plugins,
        stats: 'errors-only'
    };

    if (currentBundle.minify) {
        webpackConfig.optimization = {
            minimizer: [
                new webpack.HashedModuleIdsPlugin(),
                new UglifyJSPlugin({
                    // extractComments: true,
                    sourceMap: libConfig.sourceMap,
                    // warningsFilter: (resourceId: string): boolean => {
                    //    return !!resourceId && /(\\|\/)node_modules(\\|\/)/.test(resourceId);
                    // },
                    parallel: true,
                    cache: true,
                    uglifyOptions: {
                        // ie8: true, // default false
                        ecma: currentBundle._ecmaVersion, // default undefined
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
            ]
        };
    }

    if (currentBundle.webpackConfig) {
        const customWebpackConfig =
            getCustomWebpackConfig(path.resolve(projectRoot, currentBundle.webpackConfig), angularBuildContext) || {};
        const mergedConfig = webpackMerge([
            webpackConfig,
            customWebpackConfig
        ]) as webpack.Configuration;
        return mergedConfig;
    }

    return webpackConfig;
}
