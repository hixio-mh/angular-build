import { existsSync } from 'fs';
import * as path from 'path';

import * as resolve from 'resolve';
import * as webpack from 'webpack';

import { PurifyPlugin } from '@angular-devkit/build-optimizer';

import {
    AngularBuildContext,
    BundleOptionsInternal,
    InternalError,
    InvalidConfigError,
    LibProjectConfigInternal
} from '../../models';
import { defaultAngularAndRxJsExternals } from '../../helpers/angular-rxjs-externals';
import { isWebpackDevServer } from '../../helpers/is-webpack-dev-server';
import { getCustomWebpackConfig } from '../../helpers/get-custom-webpack-config';

const UglifyJSPlugin = require('uglifyjs-webpack-plugin');
const nodeExternals = require('webpack-node-externals');
const webpackMerge = require('webpack-merge');

/**
 * Enumerate loaders and their dependencies from this file to let the dependency validator
 * know they are used.
 * require('awesome-typescript-loader')
 */

type WebpackLibraryTarget = 'var' | 'amd' | 'commonjs' | 'commonjs2' | 'umd';

export function getLibBundleTargetWebpackConfig(angularBuildContext: AngularBuildContext,
    currentBundle: BundleOptionsInternal,
    outputFilePath: string): webpack.Configuration {
    if (!currentBundle._entryFilePath) {
        throw new InternalError(`The 'currentBundle._entryFilePath' is not set.`);
    }

    const environment = AngularBuildContext.environment;
    const projectRoot = AngularBuildContext.projectRoot;
    const cliIsGlobal = AngularBuildContext.cliIsGlobal;
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
    if (currentBundle.nodeModulesAsExternals !== false) {
        externals.push(nodeExternals());
    }

    if (typeof currentBundle.externals === 'undefined') {
        if (currentBundle.angularAndRxJsAsExternals ||
            (currentBundle.angularAndRxJsAsExternals !== false && !(currentBundle.nodeModulesAsExternals !== false))) {
            externals.push(Object.assign({}, defaultAngularAndRxJsExternals));
        }
    } else {
        let noExternals = false;
        if (!currentBundle.externals ||
            (Array.isArray(currentBundle.externals) && !currentBundle.externals.length) ||
            (typeof currentBundle.externals === 'object' && !Object.keys(currentBundle.externals).length)) {
            noExternals = true;
        }

        if (noExternals) {
            if (currentBundle.angularAndRxJsAsExternals !== false) {
                const defaultExternals = Object.assign({}, defaultAngularAndRxJsExternals);
                externals.push(defaultExternals);
            }
        } else {
            if (Array.isArray(currentBundle.externals)) {
                externals.push(...currentBundle.externals);
            } else {
                externals.push(currentBundle.externals);
            }

            if (currentBundle.angularAndRxJsAsExternals !== false) {
                const defaultExternals = Object.assign({}, defaultAngularAndRxJsExternals);
                externals.push(defaultExternals);
            }
        }
    }

    const rules: webpack.Rule[] = [];
    const plugins: webpack.Plugin[] = [new webpack.NoEmitOnErrorsPlugin()];
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

    if (environment.prod) {
        plugins.push(new webpack.HashedModuleIdsPlugin());
    } else {
        plugins.push(new webpack.NamedModulesPlugin());
    }

    if (isTsEntry) {
        const tsLoader = cliIsGlobal ? require.resolve('awesome-typescript-loader') : 'awesome-typescript-loader';
        const tsConfigPath = currentBundle._tsConfigPath;

        rules.push({
            test: /\.ts$/,
            use: [
                {
                    loader: tsLoader,
                    options: {
                        instance: `at-${libConfig.name || 'libs[' + libConfig._index + ']'}-loader`,
                        configFileName: tsConfigPath,
                        silent: true
                    }
                }
            ]
        });

        // `CheckerPlugin` is optional. Use it if you want async error reporting.
        // We need this plugin to detect a `--watch` mode. It may be removed later
        // after https://github.com/webpack/webpack/issues/3460 will be resolved.
        const { CheckerPlugin, TsConfigPathsPlugin } = require('awesome-typescript-loader');
        plugins.push(new CheckerPlugin());

        resolvePlugins.push(new TsConfigPathsPlugin(tsConfigPath));
    }

    if (currentBundle.minify) {
        // This plugin must be before webpack.optimize.UglifyJsPlugin.
        plugins.push(new PurifyPlugin());

        plugins.push(new UglifyJSPlugin({
            extractComments: true,
            sourceMap: libConfig.sourceMap,
            warningsFilter: (resourceId: string): boolean => {
                return !!resourceId && /(\\|\/)node_modules(\\|\/)/.test(resourceId);
            },
            parallel: true,
            cache: true,
            uglifyOptions: {
                // ie8: true, // default false
                ecma: currentBundle._ecmaVersion, // default undefined
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

    const nodeModulePaths = ['node_modules', AngularBuildContext.nodeModulesPath];

    const loaderModulePaths = [...nodeModulePaths];
    if (AngularBuildContext.angularBuildCliRootPath) {
        loaderModulePaths.push(path.resolve(AngularBuildContext.angularBuildCliRootPath, 'node_modules'));
    } else {
        loaderModulePaths.push(path.resolve(AngularBuildContext.nodeModulesPath,
            '@bizappframework/angular-build/node_modules'));
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
        !currentBundle.angularAndRxJsAsExternals &&
        existsSync(path.resolve(AngularBuildContext.nodeModulesPath, 'rxjs'))) {
        try {
            const rxjsPathMappingImportModuleName =
                currentBundle._ecmaVersion && currentBundle._ecmaVersion > 5
                    ? 'rxjs/_esm2015/path-mapping'
                    : 'rxjs/_esm5/path-mapping';
            const rxPaths = require(resolve.sync(rxjsPathMappingImportModuleName, { basedir: projectRoot }));
            alias = rxPaths(AngularBuildContext.nodeModulesPath);
        } catch (e) {
            logger.warn(`Failed rxjs path alias. ${e.message}`);
        }
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
