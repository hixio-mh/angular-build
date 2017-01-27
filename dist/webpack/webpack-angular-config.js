"use strict";
// Ref: https://webpack.js.org/configuration/
// ReSharper disable InconsistentNaming
const path = require("path");
const fs = require("fs");
// Webpack built-in plugins
const ContextReplacementPlugin = require('webpack/lib/ContextReplacementPlugin');
const NormalModuleReplacementPlugin = require('webpack/lib/NormalModuleReplacementPlugin');
const LoaderOptionsPlugin = require('webpack/lib/LoaderOptionsPlugin');
// Typescript plugins
// ReSharper disable CommonJsExternalModule
//import { AotPlugin } from '@ngtools/webpack';
const AotPlugin = require('@ngtools/webpack').AotPlugin;
const CheckerPlugin = require('awesome-typescript-loader').CheckerPlugin;
const TsConfigPathsPlugin = require('awesome-typescript-loader').TsConfigPathsPlugin;
const NgcWebpackPlugin = require('ngc-webpack').NgcWebpackPlugin;
const webpackMerge = require('webpack-merge');
const helpers_1 = require("./helpers");
const webpack_common_config_1 = require("./webpack-common-config");
function getWebpackAngularConfig(projectRoot, appConfig, buildOptions) {
    const emptyModulePath = require.resolve('../empty.js');
    const appRoot = path.resolve(projectRoot, appConfig.root);
    const env = helpers_1.getEnv(buildOptions.debug);
    const entryPoints = {};
    const plugins = [];
    const mainEntry = buildOptions.aot && appConfig.mainAot ? appConfig.mainAot : appConfig.main;
    if (mainEntry) {
        const appMain = path.resolve(projectRoot, appConfig.root, mainEntry);
        const dllEntries = helpers_1.parseDllEntries(appRoot, appConfig.dlls, appConfig.target, env);
        if (dllEntries && dllEntries.find(e => e.importToMain)) {
            const entries = [];
            dllEntries.filter(e => e.importToMain).forEach(de => {
                if (Array.isArray(de.entry)) {
                    entries.push(...de.entry);
                }
                else {
                    entries.push(de.entry);
                }
            });
            entryPoints['main'] = entries.concat([appMain]);
        }
        else {
            entryPoints['main'] = [appMain];
        }
    }
    // Fix angular 2 plugins
    //
    // TODO: to review for aot
    const angular2fixPlugins = [
        // see:  https://github.com/angular/angular/issues/11580
        new ContextReplacementPlugin(
        // The (\\|\/) piece accounts for path separators in *nix and Windows
        /angular(\\|\/)core(\\|\/)(esm(\\|\/)src|src)(\\|\/)linker/, appRoot),
        new NormalModuleReplacementPlugin(/facade(\\|\/)async/, path.resolve(projectRoot, 'node_modules/@angular/core/src/facade/async.js')),
        new NormalModuleReplacementPlugin(/facade(\\|\/)collection/, path.resolve(projectRoot, 'node_modules/@angular/core/src/facade/collection.js')),
        new NormalModuleReplacementPlugin(/facade(\\|\/)errors/, path.resolve(projectRoot, 'node_modules/@angular/core/src/facade/errors.js')),
        new NormalModuleReplacementPlugin(/facade(\\|\/)lang/, path.resolve(projectRoot, 'node_modules/@angular/core/src/facade/lang.js')),
        new NormalModuleReplacementPlugin(/facade(\\|\/)math/, path.resolve(projectRoot, 'node_modules/@angular/core/src/facade/math.js'))
    ];
    plugins.push(...angular2fixPlugins);
    // Production replacement plugins
    //
    if (buildOptions.aot || !buildOptions.debug) {
        const prodPlugins = [
            new NormalModuleReplacementPlugin(/zone\.js(\\|\/)dist(\\|\/)long-stack-trace-zone/, emptyModulePath),
            // AoT
            // problem with platformUniversalDynamic on the server/client
            new NormalModuleReplacementPlugin(/@angular(\\|\/)compiler/, emptyModulePath),
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
            new LoaderOptionsPlugin({
                options: {
                    /**
                    * Static analysis linter for TypeScript advanced options configuration
                    * Description: An extensible linter for the TypeScript language.
                    *
                    * See: https://github.com/wbuchwalter/tslint-loader
                    */
                    tslint: {
                        emitErrors: true,
                        failOnHint: true,
                        resourcePath: 'src'
                    },
                    /**
                     * Html loader advanced options
                     *
                     * See: https://github.com/webpack/html-loader#advanced-options
                     */
                    // TODO: Need to workaround Angular 2's html syntax => #id [bind] (event) *ngFor
                    htmlLoader: {
                        minimize: true,
                        removeAttributeQuotes: false,
                        caseSensitive: true,
                        customAttrSurround: [
                            [/#/, /(?:)/],
                            [/\*/, /(?:)/],
                            [/\[?\(?/, /(?:)/]
                        ],
                        customAttrAssign: [/\)?\]?=/]
                    }
                }
            })
        ];
        if (buildOptions.aot) {
            const aotProdPlugins = [];
            prodPlugins.push(...aotProdPlugins);
        }
        //if (typeof buildOptions.replaceHmrOnProduction === 'undefined' || buildOptions.replaceHmrOnProduction) {
        //  prodPlugins.push(new NormalModuleReplacementPlugin(
        //    /angular2-hmr/,
        //    emptyModulePath
        //  ));
        //}
        plugins.push(...prodPlugins);
    }
    //if (buildOptions.aot && appConfig.mainAoT && commonConfig.entry && commonConfig.entry['main']) {
    //    const appAoTMain = path.resolve(projectRoot, appConfig.root, appConfig.mainAoT);
    //    commonConfig.entry['main'] = [appAoTMain];
    //}
    let baseConfig = {};
    const webpackCommonConfig = webpack_common_config_1.getWebpackCommonConfig(projectRoot, appConfig, buildOptions);
    if (!buildOptions.dll) {
        const webpackTsConfigPartial = getWebpackTypescriptConfigPartial(projectRoot, appConfig, buildOptions);
        baseConfig = webpackMerge(webpackCommonConfig, webpackTsConfigPartial);
    }
    else {
        baseConfig = webpackCommonConfig;
    }
    const angularWebpackConfig = webpackMerge(baseConfig, {
        resolve: {
            extensions: buildOptions.dll ? ['.js'] : ['.ts', '.js', '.json']
        },
        entry: entryPoints,
        plugins: plugins
    });
    return angularWebpackConfig;
}
exports.getWebpackAngularConfig = getWebpackAngularConfig;
function getWebpackTypescriptConfigPartial(projectRoot, appConfig, buildOptions) {
    const rules = [];
    const plugins = [];
    let tsConfigPath = path.resolve(projectRoot, appConfig.root, appConfig.tsconfig || 'tsconfig.json');
    if (!fs.existsSync(tsConfigPath)) {
        tsConfigPath = path.resolve(projectRoot, 'tsconfig.json');
    }
    if (!fs.existsSync(tsConfigPath)) {
        tsConfigPath = null;
    }
    const aotResourceOverridePath = require.resolve('../resource-override.js');
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
    }
    else {
        const tsRules = [
            {
                test: /\.ts$/,
                use: [
                    {
                        // TODO:
                        loader: '@angularclass/hmr-loader',
                        options: {
                            pretty: buildOptions.debug,
                            prod: !buildOptions.debug
                        }
                    },
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
        }
        ;
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
        }
        else {
            const nonAoTPlugin = new AotPlugin({
                tsConfigPath: tsConfigPath,
                mainPath: path.join(projectRoot, appConfig.root, appConfig.main),
                exclude: excludes,
                skipCodeGeneration: true
            });
            plugins.push(nonAoTPlugin);
        }
    }
    else {
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
exports.getWebpackTypescriptConfigPartial = getWebpackTypescriptConfigPartial;
//# sourceMappingURL=webpack-angular-config.js.map