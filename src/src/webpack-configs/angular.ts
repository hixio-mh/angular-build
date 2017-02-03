import * as path from 'path';
import * as fs from 'fs';

// ReSharper disable InconsistentNaming
const ContextReplacementPlugin = require('webpack/lib/ContextReplacementPlugin');
const NormalModuleReplacementPlugin = require('webpack/lib/NormalModuleReplacementPlugin');

const { AotPlugin } = require('@ngtools/webpack');
const CheckerPlugin = require('awesome-typescript-loader').CheckerPlugin;
const TsConfigPathsPlugin = require('awesome-typescript-loader').TsConfigPathsPlugin;
const { NgcWebpackPlugin } = require('ngc-webpack');
const webpackMerge = require('webpack-merge');
// ReSharper restore InconsistentNaming

// Models
import { AppConfig, BuildOptions } from '../models';

export function getAngularConfigPartial(projectRoot: string, appConfig: AppConfig, buildOptions: BuildOptions) {
    const emptyModulePath = require.resolve('../../empty.js');
    const appRoot = path.resolve(projectRoot, appConfig.root);

    const plugins: any = [];

    // Fix angular 2 plugins
    //
    // TODO: to review for aot
    const angular2FixPlugins = [

        // see:  https://github.com/angular/angular/issues/11580
        new ContextReplacementPlugin(
            // The (\\|\/) piece accounts for path separators in *nix and Windows
            /angular(\\|\/)core(\\|\/)(esm(\\|\/)src|src)(\\|\/)linker/,
            appRoot
        ),

        new NormalModuleReplacementPlugin(
            /facade(\\|\/)async/,
            path.resolve(projectRoot, 'node_modules/@angular/core/src/facade/async.js')
        ),
        new NormalModuleReplacementPlugin(
            /facade(\\|\/)collection/,
            path.resolve(projectRoot, 'node_modules/@angular/core/src/facade/collection.js')
        ),
        new NormalModuleReplacementPlugin(
            /facade(\\|\/)errors/,
            path.resolve(projectRoot, 'node_modules/@angular/core/src/facade/errors.js')
        ),
        new NormalModuleReplacementPlugin(
            /facade(\\|\/)lang/,
            path.resolve(projectRoot, 'node_modules/@angular/core/src/facade/lang.js')
        ),
        new NormalModuleReplacementPlugin(
            /facade(\\|\/)math/,
            path.resolve(projectRoot, 'node_modules/@angular/core/src/facade/math.js')
        )
    ];
    plugins.push(...angular2FixPlugins);

    // AoT replacement plugins
    //
      // TODO: to review
    if (buildOptions.aot) {
        const aotProdPlugins: any[] = [
            // problem with platformUniversalDynamic on the server/client
            new NormalModuleReplacementPlugin(
                /@angular(\\|\/)compiler/,
                emptyModulePath
            )
            // AoT
            // new NormalModuleReplacementPlugin(
            //   /@angular(\\|\/)upgrade/,
            //    emptyModulePath
            // ),
            // new NormalModuleReplacementPlugin(
            //   /@angular(\\|\/)platform-browser-dynamic/,
            //    emptyModulePath
            // ),
            // new NormalModuleReplacementPlugin(
            //   /dom(\\|\/)debug(\\|\/)ng_probe/,
            //    emptyModulePath
            // ),
            // new NormalModuleReplacementPlugin(
            //   /dom(\\|\/)debug(\\|\/)by/,
            //    emptyModulePath
            // ),
            // new NormalModuleReplacementPlugin(
            //   /src(\\|\/)debug(\\|\/)debug_node/,
            //    emptyModulePath
            // ),
            // new NormalModuleReplacementPlugin(
            //   /src(\\|\/)debug(\\|\/)debug_renderer/,
            //    emptyModulePath
            // ),
        ];
        plugins.push(...aotProdPlugins);
    }

    if (buildOptions.dll) {
        return {
            plugins: plugins
        };
    } else {

        const webpackTsConfigPartial = getTypescriptConfigPartial(projectRoot, appConfig, buildOptions);
        return webpackMerge(webpackTsConfigPartial, {
            plugins: plugins
        });
    }
}

function getTypescriptConfigPartial(projectRoot: string, appConfig: AppConfig, buildOptions: BuildOptions) {
    const rules: any[] = [];
    const plugins: any[] = [];

    let tsConfigPath = path.resolve(projectRoot, appConfig.root, appConfig.tsconfig || 'tsconfig.json');
    if (!fs.existsSync(tsConfigPath)) {
        tsConfigPath = path.resolve(projectRoot, 'tsconfig.json');
    }
    if (!fs.existsSync(tsConfigPath)) {
        tsConfigPath = null;
    }
    const aotResourceOverridePath = require.resolve('../../resource-override.js');

    // TODO:
    const aotGenDir = path.resolve(projectRoot, appConfig.root, appConfig.aotGenDir || 'ngfactory');
    const useNgToolsWebpack = buildOptions.aot;

    const tsLoaderExcludes = [/\.(spec|e2e|e2e-spec)\.ts$/];
    // TODO:
    const ngToolsWebpackLoader = require.resolve('@ngtools/webpack');
    if (useNgToolsWebpack) {
        const tsRules = [
            {
                test: /\.ts$/,
                loader: ngToolsWebpackLoader,
                exclude: tsLoaderExcludes
            }
        ];
        rules.push(...tsRules);
    } else {
        const tsRules = [
            {
                test: /\.ts$/,
                use: [
                    //{
                    //    // TODO:
                    //    loader: '@angularclass/hmr-loader',
                    //    options: {
                    //        pretty: !buildOptions.production,
                    //        prod: buildOptions.production
                    //    }
                    //},
                    {
                        // MAKE SURE TO CHAIN VANILLA JS CODE, I.E. TS COMPILATION OUTPUT.
                        loader: 'ng-router-loader',
                        options: {
                            loader: 'async-import',
                            genDir: aotGenDir,
                            aot: buildOptions.aot
                        }
                    },
                    {
                        loader: 'awesome-typescript-loader',
                        options: {
                            instance: `at-${appConfig.name || 'app'}-loader`,
                            configFileName: tsConfigPath
                        }
                    },
                    {
                        loader: 'string-replace-loader',
                        options: {
                            search: 'moduleId:\s*module.id\s*[,]?',
                            replace: '',
                            flags: 'g'
                        }
                    },
                    {
                        loader: 'angular2-template-loader'
                    }
                ],
                //include: [appRoot]
                exclude: tsLoaderExcludes
            }
        ];
        rules.push(...tsRules);
    }

    if (useNgToolsWebpack) {
        let excludes = ['**/*.spec.ts'];
        if (appConfig.test) {
            excludes.push(path.join(projectRoot, appConfig.root, appConfig.test));
        };

        if (buildOptions.aot) {
            const aotPlugin = new AotPlugin({
                // TODO:
                genDir: aotGenDir,
                tsConfigPath: tsConfigPath,
                mainPath: path.join(projectRoot, appConfig.root, appConfig.main),
                i18nFile: appConfig.i18nFile,
                i18nFormat: appConfig.i18nFormat,
                locale: appConfig.locale,
                exclude: excludes
            });
            plugins.push(aotPlugin);
        } else {
            const nonAoTPlugin = new AotPlugin({
                tsConfigPath: tsConfigPath,
                mainPath: path.join(projectRoot, appConfig.root, appConfig.main),
                exclude: excludes,
                skipCodeGeneration: true
            });
            plugins.push(nonAoTPlugin);
        }
    } else {
        const tsPlugins = [
            new CheckerPlugin()
        ];
        if (buildOptions.aot) {
            const aotPlugin = new NgcWebpackPlugin({
                disabled: !buildOptions.aot,
                tsConfig: tsConfigPath,
                resourceOverride: aotResourceOverridePath
            });
            tsPlugins.push(aotPlugin);
        }
        plugins.push(...tsPlugins);
    }

    //const alias = {};
    //if (fs.existsSync(tsConfigPath)) {
    //    const tsConfigContent = readJsonSync(tsConfigPath);
    //    const compilerOptions = tsConfigContent.compilerOptions || {};
    //    const tsPaths = compilerOptions.paths || {};
    //    for (let prop in tsPaths) {
    //        if (tsPaths.hasOwnProperty(prop)) {
    //            alias[prop] = path.resolve(projectRoot, tsPaths[prop][0]);
    //        }
    //    }
    //}


    const tsWebpackConfig = {
        resolve: {
            extensions: ['.ts', '.js', '.json'],
            // alias: alias,
            // Or
            plugins: [
                // TODO: to review
                new TsConfigPathsPlugin({
                    configFileName: tsConfigPath
                })
            ]
        },
        module: {
            rules: rules
        },
        plugins: plugins
    };

    return tsWebpackConfig;
}