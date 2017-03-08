import * as path from 'path';
import * as fs from 'fs';
import * as webpack from 'webpack';

// ReSharper disable CommonJsExternalModule
// ReSharper disable InconsistentNaming
const { NgcWebpackPlugin } = require('ngc-webpack');
const {CheckerPlugin} = require('awesome-typescript-loader');
const {TsConfigPathsPlugin} = require('awesome-typescript-loader');
// ReSharper restore InconsistentNaming
// ReSharper restore CommonJsExternalModule

import { StaticAssetWebpackPlugin } from '../plugins/static-asset-webpack-plugin';

import { AppConfig, BuildOptions } from '../models';
import { readJsonSync } from '../utils';

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
    let useAoTPlugin : boolean;
    if (buildOptions.typescriptWebpackTool && !buildOptions.dll && !appConfig.referenceDll) {
        useAoTPlugin = buildOptions.typescriptWebpackTool === '@ngtools/webpack';
    } else {
        useAoTPlugin = !buildOptions.dll && !buildOptions.test && !appConfig.referenceDll && buildOptions.aot && appConfig.main && !appConfig.main.match(/aot\.ts$/i);
    }

    return useAoTPlugin
        ? getTypescriptAoTPluginConfigPartial(projectRoot, appConfig, buildOptions)
        : getTypescriptNgcPluginConfigPartial(projectRoot, appConfig, buildOptions);
}

export function getServiceWorkConfigPartial(projectRoot: string) {
    const plugins: any[] = [];
    const nodeModulesPath = path.resolve(projectRoot, 'node_modules');
    const entryPoints: { [key: string]: string[] } = {};

    // TODO: to review
    const swModule = path.resolve(nodeModulesPath, '@angular/service-worker');

    // @angular/service-worker is required to be installed when serviceWorker is true.
    if (!fs.existsSync(swModule)) {
        throw new Error(`Your project is configured with serviceWorker = true, but @angular/service-worker is not installed.`);
    }

    // Path to the worker script itself.
    const workerPath = path.resolve(swModule, 'bundles/worker-basic.min.js');

    // Path to a small script to register a service worker.
    const registerPath = path.resolve(swModule, 'build/assets/register-basic.min.js');

    // Sanity check - both of these files should be present in @angular/service-worker.
    if (!fs.existsSync(workerPath) || !fs.existsSync(registerPath)) {
        throw new
            Error(`The installed version of @angular/service-worker isn't supported. Please install a supported version. The following files should exist: \n${registerPath}\n${workerPath}`);
    }

    // TODO: to review
    //prodPlugins.push(new GlobCopyWebpackPlugin({
    //    patterns: ['ngsw-manifest.json'],
    //    globOptions: {
    //        optional: true,
    //    },
    //}));

    // Load the Webpack plugin for manifest generation and install it.
    const AngularServiceWorkerPlugin = require('@angular/service-worker/build/webpack')
        .AngularServiceWorkerPlugin;
    plugins.push(new AngularServiceWorkerPlugin());

    // Copy the worker script into assets.
    const workerContents = fs.readFileSync(workerPath).toString();
    plugins.push(new StaticAssetWebpackPlugin('worker-basic.min.js', workerContents));

    // Add a script to index.html that registers the service worker.
    // TODO(alxhub): inline this script somehow.
    entryPoints['sw-register'] = [registerPath];

    return {
        entry: entryPoints,
        plugins: plugins
    };
}

function getTypescriptAoTPluginConfigPartial(projectRoot: string, appConfig: AppConfig, buildOptions: BuildOptions) {
    let exclude : string[] = [];
    if (!buildOptions.test) {
        exclude = ['**/*.spec.ts', '**/*.e2e.ts', '**/*.e2e-spec.ts'];
        if (appConfig.test) {
            exclude.push(path.join(projectRoot, appConfig.root, appConfig.test));
        }
    }

    const webpackIsGlobal = (buildOptions as any)['webpackIsGlobal'];
    const ngToolsWebpackLoader = webpackIsGlobal ? require.resolve('@ngtools/webpack') : '@ngtools/webpack';

    const tsRules: any[] = [{
        test: /\.ts$/,
        use: ngToolsWebpackLoader
        //exclude: [/\.(spec|e2e|e2e-spec)\.ts$/]
    }];

    const tsConfigPath = path.resolve(projectRoot, appConfig.root, appConfig.tsconfig);
    const hostReplacementPaths: any = getHostReplacementPaths(projectRoot, appConfig);
    //const mainPath = buildOptions.test ? path.join(projectRoot, appConfig.root, appConfig.test)
    //    : path.join(projectRoot, appConfig.root, appConfig.main);
    const aotOptions: any = { exclude, tsConfigPath, hostReplacementPaths };

  if (!buildOptions.aot) {
        aotOptions.skipCodeGeneration = true;
    }

    const tsPlugins: any[] = [
        createAotPlugin(projectRoot, appConfig, buildOptions, aotOptions)
    ];

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

    const rules: any[] = [];
    const plugins: any[] = [
        new CheckerPlugin()
    ];

    // Rules
    //
    if (buildOptions.dll) {
        rules.push({
            test: /\.ts$/,
            use: [
                {
                    loader: 'awesome-typescript-loader',
                    options: {
                        instance: `at-${appConfig.name || 'app'}-dll-loader`,
                        configFileName: tsConfigPath
                        //transpileOnly: true
                    }
                }
            ],
            exclude: [/\.(spec|e2e|e2e-spec)\.ts$/]
            //include: tsEntries
        });
    } else if (buildOptions.test) {
        // TODO:
        rules.push({
            test: /\.ts$/,
            use: [
                {
                    loader: 'awesome-typescript-loader',
                    options: {
                        // use inline sourcemaps for "karma-remap-coverage" reporter
                        sourceMap: false,
                        inlineSourceMap: true,
                        //instance: `at-${appConfig.name || 'app'}-test-loader`,
                        configFileName: tsConfigPath
                        //compilerOptions: {
                        //    // Remove TypeScript helpers to be injected
                        //    // below by DefinePlugin
                        //    removeComments: true
                        //}
                    }
                },
                'angular2-template-loader'
            ],
            exclude: [/\.(e2e|e2e-spec)\.ts$/]
        });
    } else {
        rules.push({
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
                    // TODO: v2.1.0 -> to fix loader-utils -> parseQuery() will be replaced with getOptions()
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
                //{
                //    loader: 'string-replace-loader',
                //    options: {
                //        search: 'moduleId:\s*module.id\s*[,]?',
                //        replace: '',
                //        flags: 'g'
                //    }
                //},
                {
                    loader: 'angular2-template-loader'
                }
            ],
            exclude: [/\.(spec|e2e|e2e-spec)\.ts$/]
        });
    }

    const angular2FixPlugins = getAngular2FixPlugins(projectRoot, appConfig, buildOptions);
    plugins.push(...angular2FixPlugins);

    if (buildOptions.aot) {
        const aotPlugin = new NgcWebpackPlugin({
            disabled: !buildOptions.aot,
            tsConfig: tsConfigPath
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
    if (!buildOptions.dll) {
        const hostReplacementPaths = getHostReplacementPaths(projectRoot, appConfig);
        if (hostReplacementPaths && Object.keys(hostReplacementPaths).length > 0) {
            const envSourcePath = Object.keys(hostReplacementPaths)[0];
            const envFile = hostReplacementPaths[envSourcePath];
            if (envSourcePath !== envFile) {
                plugins.push(new webpack.NormalModuleReplacementPlugin(
                    // This plugin is responsible for swapping the environment files.
                    // Since it takes a RegExp as first parameter, we need to escape the path.
                    // See https://webpack.github.io/docs/list-of-plugins.html#normalmodulereplacementplugin
                    new RegExp(envSourcePath
                        .replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, '\\$&')),
                    envFile
                ));
            }
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

    const angular2FixPlugins: any[] = [];

    // see:  https://github.com/angular/angular/issues/11580
    if (!appConfig.target || appConfig.target === 'web' || appConfig.target === 'webworker') {
        angular2FixPlugins.push(
            new webpack.ContextReplacementPlugin(
                /angular(\\|\/)core(\\|\/)(esm(\\|\/)src|src)(\\|\/)linker/,
                appRoot
            )
        );
    } else {
        angular2FixPlugins.push(
            new webpack.ContextReplacementPlugin(
                /\@angular\b.*\b(bundles|linker)/,
                appRoot
            )
        );
    }

    if (buildOptions.production) {
        const angular2FixProdPlugins: any[] = [
            new webpack.NormalModuleReplacementPlugin(
                /facade(\\|\/)async/,
                path.resolve(projectRoot, 'node_modules/@angular/core/src/facade/async.js')
            ),
            new webpack.NormalModuleReplacementPlugin(
                /facade(\\|\/)collection/,
                path.resolve(projectRoot, 'node_modules/@angular/core/src/facade/collection.js')
            ),
            new webpack.NormalModuleReplacementPlugin(
                /facade(\\|\/)errors/,
                path.resolve(projectRoot, 'node_modules/@angular/core/src/facade/errors.js')
            ),
            new webpack.NormalModuleReplacementPlugin(
                /facade(\\|\/)lang/,
                path.resolve(projectRoot, 'node_modules/@angular/core/src/facade/lang.js')
            ),
            new webpack.NormalModuleReplacementPlugin(
                /facade(\\|\/)math/,
                path.resolve(projectRoot, 'node_modules/@angular/core/src/facade/math.js')
            )
        ];
        angular2FixPlugins.push(...angular2FixProdPlugins);
    }

    return angular2FixPlugins;
}

function createAotPlugin(projectRoot: string, appConfig: AppConfig, buildOptions: BuildOptions, aotOptions: any) {
    //const hostReplacementPaths: any = getHostReplacementPaths(projectRoot, appConfig);

    const webpackIsGlobal = (buildOptions as any)['webpackIsGlobal'];
    // ReSharper disable CommonJsExternalModule
    // ReSharper disable once InconsistentNaming
    const { AotPlugin } = webpackIsGlobal
        ? require('@ngtools/webpack')
        : require(path.resolve(projectRoot, 'node_modules', '@ngtools', 'webpack'));
    // ReSharper restore CommonJsExternalModule

    return new AotPlugin(Object.assign({},
        {
            //tsConfigPath: path.resolve(projectRoot, appConfig.root, appConfig.tsconfig),
            mainPath: path.join(projectRoot, appConfig.root, appConfig.main),
            //hostReplacementPaths,
            // If we don't explicitely list excludes, it will default to `['**/*.spec.ts']`.
            exclude: []
        },
        aotOptions));
}

function getHostReplacementPaths(projectRoot: string, appConfig: AppConfig) {
    let hostReplacementPaths: any = {};
    const appRoot = path.resolve(projectRoot, appConfig.root);

    const sourcePath = appConfig.environmentSource;
    const envFile = appConfig.environmentFile;
    if (sourcePath && envFile) {
        hostReplacementPaths = {
            [path.join(appRoot, sourcePath)]: path.join(appRoot, envFile)
        };
    }

    return hostReplacementPaths;
}
