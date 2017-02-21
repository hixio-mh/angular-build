import * as path from 'path';
import * as fs from 'fs';
import * as webpack from 'webpack';

// ReSharper disable InconsistentNaming
const ContextReplacementPlugin = webpack.ContextReplacementPlugin;
const NormalModuleReplacementPlugin = webpack.NormalModuleReplacementPlugin;

// ReSharper disable CommonJsExternalModule
const { NgcWebpackPlugin } = require('ngc-webpack');
const {CheckerPlugin} = require('awesome-typescript-loader');
const {TsConfigPathsPlugin} = require('awesome-typescript-loader');
// ReSharper restore CommonJsExternalModule
// ReSharper restore InconsistentNaming

import { AppConfig, BuildOptions } from '../models';
import { readJsonSync } from '../utils';
import { getEnvName } from './helpers';

/**
 * Enumerate loaders and their dependencies from this file to let the dependency validator
 * know they are used.
 *
 * require('ng-router-loader')
  * require('awesome-typescript-loader')
 * require('string-replace-loader')
 * require('angular2-template-loader')
 */

export function getAngularConfigPartial(projectRoot: string, appConfig: AppConfig, buildOptions: BuildOptions) {
    if (buildOptions.dll) {
        const angular2FixPlugins = getAngular2FixPlugins(projectRoot, appConfig, buildOptions);
        return {
            plugins: angular2FixPlugins
        };
    } else {
        const useAoTPlugin = !appConfig.referenceDll && !buildOptions.dll && buildOptions.aot && !appConfig.main.match(/aot\.ts$/i);
        return useAoTPlugin
            ? getTypescriptWithAoTPluginConfigPartial(projectRoot, appConfig, buildOptions)
            : getTypescriptNgcPluginConfigPartial(projectRoot, appConfig, buildOptions);
    }
}

function getTypescriptWithAoTPluginConfigPartial(projectRoot: string, appConfig: AppConfig, buildOptions: BuildOptions) {
    const exclude = ['**/*.spec.ts'];
    if (appConfig.test) {
        exclude.push(path.join(projectRoot, appConfig.root, appConfig.test));
    };

    const webpackIsGlobal = (buildOptions as any)['webpackIsGlobal'];
    const ngToolsWebpackLoader = webpackIsGlobal ? require.resolve('@ngtools/webpack') : '@ngtools/webpack';

    const tsRules: any[] = [{
        test: /\.ts$/,
        use: ngToolsWebpackLoader,
        exclude: [/\.(spec|e2e|e2e-spec)\.ts$/]
    }];


    const tsPlugins: any[] = [
        buildOptions.aot
            ? createAotPlugin(projectRoot, appConfig, buildOptions, { exclude })
            : createAotPlugin(projectRoot, appConfig, buildOptions, { exclude, skipCodeGeneration: true })
    ];

    // TODO:
    //const alias : any = {};
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

    return {
        module: {
            rules: tsRules
        },
        plugins: tsPlugins
    };
}

function getTypescriptNgcPluginConfigPartial(projectRoot: string, appConfig: AppConfig, buildOptions: BuildOptions) {
    //const emptyModulePath = require.resolve('../../empty.js');
    let aotGenDir: string = undefined;
    let tsConfigPath = path.resolve(projectRoot, appConfig.root, appConfig.tsconfig || 'tsconfig.json');

    if (!fs.existsSync(tsConfigPath)) {
        tsConfigPath = path.resolve(projectRoot, 'tsconfig.json');
        if (!fs.existsSync(tsConfigPath)) {
            tsConfigPath = null;
        }
    }
    if (tsConfigPath) {
        const tsConfig = readJsonSync(tsConfigPath);
        if (tsConfig.angularCompilerOptions && tsConfig.angularCompilerOptions.genDir) {
            aotGenDir = tsConfig.angularCompilerOptions.genDir;
        }
    }

    // Rules
    //
    const rules = [
        {
            test: /\.ts$/,
            use: [
                //{
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
                        aot: buildOptions.aot,
                        debug: buildOptions.verbose
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
            exclude: [/\.(spec|e2e|e2e-spec)\.ts$/]
        }
    ];

    // Plugins
    //
    const plugins: any[] = [
        new CheckerPlugin()
    ];
    const angular2FixPlugins = getAngular2FixPlugins(projectRoot, appConfig, buildOptions);
    plugins.push(...angular2FixPlugins);

    if (buildOptions.aot) {
        const aotPlugin = new NgcWebpackPlugin({
            disabled: !buildOptions.aot,
            tsConfig: tsConfigPath,
            resourceOverride: appConfig.aotResourceOverridePath
        });
        plugins.push(aotPlugin);

        //const aotReplacementPlugins: any[] = [

        //    // problem with platformUniversalDynamic on the server/client
        //    new NormalModuleReplacementPlugin(
        //        /@angular(\\|\/)compiler/,
        //        emptyModulePath
        //    )

        //    // new NormalModuleReplacementPlugin(
        //    //   /@angular(\\|\/)upgrade/,
        //    //    emptyModulePath
        //    // ),
        //    // new NormalModuleReplacementPlugin(
        //    //   /@angular(\\|\/)platform-browser-dynamic/,
        //    //    emptyModulePath
        //    // ),
        //    // new NormalModuleReplacementPlugin(
        //    //   /dom(\\|\/)debug(\\|\/)ng_probe/,
        //    //    emptyModulePath
        //    // ),
        //    // new NormalModuleReplacementPlugin(
        //    //   /dom(\\|\/)debug(\\|\/)by/,
        //    //    emptyModulePath
        //    // ),
        //    // new NormalModuleReplacementPlugin(
        //    //   /src(\\|\/)debug(\\|\/)debug_node/,
        //    //    emptyModulePath
        //    // ),
        //    // new NormalModuleReplacementPlugin(
        //    //   /src(\\|\/)debug(\\|\/)debug_renderer/,
        //    //    emptyModulePath
        //    // ),
        //];
        //plugins.push(...aotReplacementPlugins);
    }

    // Replace environment
    //
    const hostReplacementPaths = getHostReplacementPaths(projectRoot, appConfig, buildOptions);
    if (hostReplacementPaths && Object.keys(hostReplacementPaths).length > 0) {
        const envSourcePath = Object.keys(hostReplacementPaths)[0];
        const envFile = hostReplacementPaths[envSourcePath];
        if (envSourcePath !== envFile) {
            plugins.push(new NormalModuleReplacementPlugin(
                // This plugin is responsible for swapping the environment files.
                // Since it takes a RegExp as first parameter, we need to escape the path.
                // See https://webpack.github.io/docs/list-of-plugins.html#normalmodulereplacementplugin
                new RegExp(envSourcePath
                    .replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, '\\$&')),
                envFile
            ));
        }
    }

    const tsWebpackConfig = {
        resolve: {
            plugins: [
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

function getAngular2FixPlugins(projectRoot: string, appConfig: AppConfig, buildOptions: BuildOptions) {
    const appRoot = path.resolve(projectRoot, appConfig.root);

    const angular2FixPlugins: any[] = [
        // see:  https://github.com/angular/angular/issues/11580
        new ContextReplacementPlugin(
            // The (\\|\/) piece accounts for path separators in *nix and Windows
            /angular(\\|\/)core(\\|\/)(esm(\\|\/)src|src)(\\|\/)linker/,
            appRoot
        )
    ];
    if (buildOptions.production) {
        const angular2FixProdPlugins: any[] = [
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
        angular2FixPlugins.push(...angular2FixProdPlugins);
    }

    return angular2FixPlugins;
}

function createAotPlugin(projectRoot: string, appConfig: AppConfig, buildOptions: BuildOptions, aotOptions: any) {
    const hostReplacementPaths: any = getHostReplacementPaths(projectRoot, appConfig, buildOptions);

    const webpackIsGlobal = (buildOptions as any)['webpackIsGlobal'];
    // ReSharper disable CommonJsExternalModule
    // ReSharper disable once InconsistentNaming
    const { AotPlugin } = webpackIsGlobal
        ? require('@ngtools/webpack')
        : require(path.resolve(projectRoot, 'node_modules', '@ngtools', 'webpack'));
    // ReSharper restore CommonJsExternalModule

    return new AotPlugin(Object.assign({},
        {
            tsConfigPath: path.resolve(projectRoot, appConfig.root, appConfig.tsconfig),
            mainPath: path.join(projectRoot, appConfig.root, appConfig.main),
            i18nFile: appConfig.i18nFile,
            i18nFormat: appConfig.i18nFormat,
            locale: appConfig.locale,
            hostReplacementPaths
        },
        aotOptions));
}

function getHostReplacementPaths(projectRoot: string, appConfig: AppConfig, buildOptions: BuildOptions) {
    const envShort = getEnvName(buildOptions.production);
    const envLong = getEnvName(buildOptions.production, true);
    let hostReplacementPaths: any = {};
    const appRoot = path.resolve(projectRoot, appConfig.root);

    let sourcePath = appConfig.environmentSource;
    if (!sourcePath && appConfig.environments && appConfig.environments['source']) {
        sourcePath = appConfig.environments['source'];
    }
    let envFile = appConfig.environmentFile;
    if (!envFile && appConfig.environments && appConfig.environments[envShort]) {
        envFile = appConfig.environments[envShort];
    }
    if (!envFile && appConfig.environments && appConfig.environments[envLong]) {
        envFile = appConfig.environments[envLong];
    }
    if (sourcePath && envFile) {
        hostReplacementPaths = {
            [path.join(appRoot, sourcePath)]: path.join(appRoot, envFile)
        };
    }
    return hostReplacementPaths;
}