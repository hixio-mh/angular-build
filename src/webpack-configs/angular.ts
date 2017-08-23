import * as path from 'path';
const fs = require('fs-extra');
import * as webpack from 'webpack';

import { stripIndent } from 'common-tags';
import * as semver from 'semver';

// ReSharper disable CommonJsExternalModule
// ReSharper disable InconsistentNaming
const { CheckerPlugin } = require('awesome-typescript-loader');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const { TsConfigPathsPlugin } = require('awesome-typescript-loader');
const { NgcWebpackPlugin } = require('ngc-webpack');
// ReSharper restore InconsistentNaming
// ReSharper restore CommonJsExternalModule

import { StaticAssetWebpackPlugin } from '../plugins/static-asset-webpack-plugin';

import { getAoTGenDirSync } from '../helpers';
import { AppProjectConfig, ModuleReplacementEntry, ProjectConfig } from '../models';
import { Logger } from '../utils';

import { WebpackConfigOptions } from './webpack-config-options';

/**
 * Enumerate loaders and their dependencies from this file to let the dependency validator
 * know they are used.
 * require('ng-router-loader')
 * require('awesome-typescript-loader')
 * require('angular2-template-loader')
 * require('@angular-devkit/build-optimizer')
 */

export function getAngularTypescriptWebpackConfigPartial(webpackConfigOptions: WebpackConfigOptions): webpack.Configuration {
    const projectConfig = webpackConfigOptions.projectConfig;
    const logger = webpackConfigOptions.logger || new Logger();

    let useAoTPlugin: boolean;
    if ((projectConfig as AppProjectConfig).tsLoader === '@ngtools/webpack') {
        useAoTPlugin = true;
        if ((projectConfig as AppProjectConfig).referenceDll) {
            useAoTPlugin = false;
            if (!webpackConfigOptions.silent) {
                logger.log('\n');
                logger.warnLine(`'@ngtools/webpack' is automatically disabled when using 'referenceDll' option.`);
            }
        }
    } else {
        useAoTPlugin = projectConfig.projectType === 'app' &&
            !(projectConfig as AppProjectConfig).referenceDll &&
            !!projectConfig.entry &&
            (projectConfig as AppProjectConfig).tsLoader !== 'auto';
    }

    return useAoTPlugin
        ? getAngularTypescriptWithAoTPluginWebpackConfigPartial(webpackConfigOptions)
        : getAngularTypescriptDefaultWebpackConfigPartial(webpackConfigOptions);
}

// Ref: https://github.com/angular/angular-cli
export function getAngularServiceWorkerWebpackConfigPartial(webpackConfigOptions: WebpackConfigOptions): webpack.Configuration {
    const projectRoot = webpackConfigOptions.projectRoot;
    const appConfig = webpackConfigOptions.projectConfig as AppProjectConfig;

    if (!appConfig.experimentalServiceWorker) {
        return {};
    }

    const srcDir = path.resolve(projectRoot, appConfig.srcDir || '');
    const nodeModules = path.resolve(projectRoot, 'node_modules');
    const swModule = path.resolve(nodeModules, '@angular/service-worker');

    // @angular/service-worker is required to be installed when serviceWorker is true.
    if (!fs.existsSync(swModule)) {
        throw new Error(stripIndent`
        Your project is configured with serviceWorker = true, but @angular/service-worker
        is not installed. Run 'npm install -S @angular/service-worker'
        and try again, or set experimentalServiceWorker = false in your angular-build.json.
      `);
    }

    // Read the version of @angular/service-worker and throw if it doesn't match the
    // expected version.
    const allowedVersion = '>= 1.0.0-beta.5 < 2.0.0';
    const swPackageJson = fs.readFileSync(`${path.resolve(swModule, 'package.json')}`).toString();
    const swVersion = JSON.parse(swPackageJson).version;
    if (!semver.satisfies(swVersion, allowedVersion)) {
        throw new Error(stripIndent`
        The installed version of @angular/service-worker is ${swVersion}. This version of the cli
        requires the @angular/service-worker version to satisfy ${allowedVersion}. Please upgrade
        your service worker version.
      `);
    }

    // Path to the worker script itself.
    const workerPath = path.resolve(swModule, 'bundles', 'worker-basic.min.js');

    // Path to a small script to register a service worker.
    const registerPath = path.resolve(swModule, 'build/assets/register-basic.min.js');

    // Sanity check - both of these files should be present in @angular/service-worker.
    if (!fs.existsSync(workerPath) || !fs.existsSync(registerPath)) {
        throw new Error(stripIndent`
        The installed version of @angular/service-worker isn't supported by the cli.
        Please install a supported version. The following files should exist:
        - ${registerPath}
        - ${workerPath}
      `);
    }

    const plugins: any[] = [];

    plugins.push(new CopyWebpackPlugin([
        {
            from: {
                glob: 'ngsw-manifest.json'
            },
            context: srcDir
        }
    ]));

    // Load the Webpack plugin for manifest generation and install it.
    const AngularServiceWorkerPlugin = require('@angular/service-worker/build/webpack')
        .AngularServiceWorkerPlugin;
    plugins.push(new AngularServiceWorkerPlugin({
        // TODO: publicPath or baseHref?
        baseHref: appConfig.baseHref || '/'
    }));

    // Copy the worker script into assets.
    const workerContents = fs.readFileSync(workerPath).toString();
    plugins.push(new StaticAssetWebpackPlugin('worker-basic.min.js', workerContents));

    return {
        plugins: plugins
    };
}

export function getAngularFixPlugins(projectRoot: string, projectConfig: ProjectConfig): any[] {
    const srcDir = path.resolve(projectRoot, projectConfig.srcDir || '');
    const angularFixPlugins: any[] = [];
    if (projectConfig.mainFields && projectConfig.mainFields.length && projectConfig.mainFields[0] === 'main') {
        // Workaround for https://github.com/angular/angular/issues/11580
        angularFixPlugins.push(
            new webpack.ContextReplacementPlugin(
                /\@angular\b.*\b(bundles|linker)/,
                srcDir
            )
        );
    } else {
        angularFixPlugins.push(
            // Workaround for https://github.com/angular/angular/issues/14898
            new webpack.ContextReplacementPlugin(
                // Angular 2
                // angular(\\|\/)core(\\|\/)(esm(\\|\/)src|src)(\\|\/)linker/,
                // Angular 4
                /angular(\\|\/)core(\\|\/)@angular/,
                srcDir
            )
        );
    }

    return angularFixPlugins;
}

function getAngularTypescriptWithAoTPluginWebpackConfigPartial(webpackConfigOptions: WebpackConfigOptions):
    webpack.Configuration {
    const projectRoot = webpackConfigOptions.projectRoot;
    const buildOptions = webpackConfigOptions.buildOptions;
    const environment = buildOptions.environment || {};
    const projectConfig = webpackConfigOptions.projectConfig;

    const exclude = environment.test
        ? []
        : [
            '**/*.spec.ts', '**/*.e2e.ts', '**/*.e2e-spec.ts', '**/test.ts', '**/*.test.ts', '**/*-test.ts'
        ];

    const cliIsLocal = (buildOptions as any).cliIsLocal !== false;

    // IMPORTANT: To solve 'Cannot read property 'newLine' of undefined' error.
    const ngToolsWebpackLoader = cliIsLocal ? '@ngtools/webpack' : require.resolve('@ngtools/webpack');
    const buildOptimizerLoader = cliIsLocal
        ? '@angular-devkit/build-optimizer/webpack-loader'
        : require.resolve('@angular-devkit/build-optimizer/webpack-loader');

    let boLoaders: any = [];
    if (buildOptions.production && buildOptions.buildOptimizer) {
        boLoaders = [{
            loader: buildOptimizerLoader,
            options: { sourceMap: projectConfig.sourceMap }
        }];
    }

    const rules: any[] = [
        {
            test: /\.ts$/,
            use: [...boLoaders, ngToolsWebpackLoader]
            // exclude: [/\.(spec|e2e|e2e-spec)\.ts$/]
        }
    ];

    // build-optimizer/webpack-loader
    if (buildOptions.production && buildOptions.buildOptimizer) {
        rules.push({
            test: /\.js$/,
            use: [{
                loader: buildOptimizerLoader,
                options: { sourceMap: projectConfig.sourceMap }
            }]
        });
    }

    const tsConfigPath = path.resolve(projectRoot,
        projectConfig.srcDir || '',
        projectConfig.tsconfig || 'tsconfig.json');
    const hostReplacementPaths: any = getHostReplacementPaths(projectRoot, projectConfig);
    const aotOptions: any = {
        exclude,
        tsConfigPath,
        hostReplacementPaths
    };

    if (!environment.aot) {
        aotOptions.skipCodeGeneration = true;
    }

    const plugins: any[] = [
        createAotPlugin(webpackConfigOptions, aotOptions)
    ];

    if (projectConfig.mainFields && projectConfig.mainFields.length && projectConfig.mainFields[0] === 'main') {
        const angularFixPlugins = getAngularFixPlugins(projectRoot, projectConfig);
        plugins.push(...angularFixPlugins);
    }

    return {
        module: {
            rules: rules
        },
        plugins: plugins
    };
}

function getAngularTypescriptDefaultWebpackConfigPartial(webpackConfigOptions: WebpackConfigOptions): webpack.
    Configuration {
    const projectRoot = webpackConfigOptions.projectRoot;
    const buildOptions = webpackConfigOptions.buildOptions;
    const environment = buildOptions.environment || {};
    const projectConfig = webpackConfigOptions.projectConfig;

    const rules: any[] = [];
    const plugins: any[] = [];

    const tsConfigPath = path.resolve(projectRoot,
        projectConfig.srcDir || '',
        projectConfig.tsconfig || 'tsconfig.json');

    // TODO: to review for aot path
    const aotGenDirAbs = getAoTGenDirSync(tsConfigPath);
    const aotGenDirRel = path.relative(projectRoot, aotGenDirAbs || '');

    const testExcludes = environment.test ? [] : [/\.(spec|e2e|e2e-spec)\.ts$/];

    const cliIsLocal = (buildOptions as any).cliIsLocal !== false;

    const tsLoader = cliIsLocal ? 'awesome-typescript-loader' : require.resolve('awesome-typescript-loader');
    const ngTemplateLoader = cliIsLocal ? 'angular2-template-loader' : require.resolve('angular2-template-loader');
    const ngRouterLoader = cliIsLocal ? 'ng-router-loader' : require.resolve('ng-router-loader');

    // rules
    if (projectConfig.projectType === 'lib') {
        rules.push({
            test: /\.ts$/,
            use: [
                {
                    loader: tsLoader,
                    options: {
                        instance: `at-${projectConfig.name || 'app'}-lib-loader`,
                        configFileName: tsConfigPath
                        // transpileOnly: true
                    }
                },
                {
                    loader: ngTemplateLoader
                }
            ],
            exclude: testExcludes
        });
    } else {
        rules.push({
            test: /\.ts$/,
            use: [
                // {
                //    loader: '@angularclass/hmr-loader',
                //    options: {
                //        pretty: !buildOptions.production,
                //        prod: buildOptions.production
                //    }
                // },
                {
                    // MAKE SURE TO CHAIN VANILLA JS CODE, I.E. TS COMPILATION OUTPUT.
                    // TODO: v2.1.0 -> to fix loader-utils -> parseQuery() will be replaced with getOptions()
                    loader: `${ngRouterLoader}?${JSON.stringify({
                        loader: 'async-import',
                        genDir: aotGenDirRel,
                        aot: environment.aot,
                        debug: buildOptions.verbose
                    })}`
                },
                {
                    loader: tsLoader,
                    options: {
                        instance: `at-${projectConfig.name || 'app'}-loader`,
                        configFileName: tsConfigPath
                    }
                },
                {
                    loader: ngTemplateLoader
                }
                // sourcemaps may be mis-generated.
                // {
                //    loader: 'string-replace-loader',
                //    options: {
                //        search: moduleIdReplaceSearchPattern,
                //        replace: '',
                //        flags: 'g'
                //    }
                // }
            ],
            exclude: testExcludes
        });
    }

    // angularFixPlugins
    const angularFixPlugins = getAngularFixPlugins(projectRoot, projectConfig);
    plugins.push(...angularFixPlugins);

    // NgcWebpackPlugin
    if (environment.aot) {
        const aotPlugin = new NgcWebpackPlugin({
            disabled: false,
            tsConfig: tsConfigPath
        });
        plugins.push(aotPlugin);
    }

    // CheckerPlugin
    plugins.push(new CheckerPlugin());

    // replace environment
    const hostReplacementPaths = getHostReplacementPaths(projectRoot, projectConfig);
    if (hostReplacementPaths) {
        Object.keys(hostReplacementPaths).forEach((key: string) => {
            const resourcePath = key;
            const newResourcePath = hostReplacementPaths[key];

            // // Since it takes a RegExp as first parameter, we need to escape the path.
            const escapedPath = resourcePath
                .replace(/\\/g, '/')
                .replace(/[\-\[\]\{\}\(\)\*\+\?\.\^\$]/g, '\\$&')
                .replace(/\//g, `(\\\\|\\/)`);
            plugins.push(new webpack.NormalModuleReplacementPlugin(new RegExp(escapedPath), newResourcePath));
        });
    }

    return {
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
}

function createAotPlugin(webpackConfigOptions: WebpackConfigOptions, aotOptions: any): any {
    const projectRoot = webpackConfigOptions.projectRoot;
    const buildOptions = webpackConfigOptions.buildOptions;
    const projectConfig = webpackConfigOptions.projectConfig;
    const cliIsLocal = (buildOptions as any).cliIsLocal !== false;

    if (!projectConfig.entry) {
        throw new Error(`The 'projectConfig.entry' property is required.`);
    }

    // ReSharper disable CommonJsExternalModule
    // ReSharper disable once InconsistentNaming
    const { AotPlugin } = cliIsLocal
        ? require(path.resolve(projectRoot, 'node_modules', '@ngtools', 'webpack'))
        : require('@ngtools/webpack');

    // ReSharper restore CommonJsExternalModule

    var aotPlugin = new AotPlugin(Object.assign({},
        {
            // IMPORTANT
            // If not specifed mainPath and angularCompilerOptions, awesome error occurs:
            // ERROR in Cannot read property 'split' of undefined
            mainPath: path.join(projectRoot, projectConfig.srcDir || '', projectConfig.entry),
            replaceExport: projectConfig.platformTarget === 'node' ||
                projectConfig.platformTarget === 'async-node' ||
                projectConfig.platformTarget === 'node-webkit',
            // If we don't explicitely list excludes, it will default to `['**/*.spec.ts']`.
            exclude: []
        },
        aotOptions));

    // TEMPORARY fix for Windows 10 - will be gone when fixed
    // ReSharper disable once InconsistentNaming
    // ReSharper disable once Lambda
    aotPlugin._compilerHost._resolve = function (pathToResolve: string): string {
        // path_1 = require("path");
        pathToResolve = aotPlugin._compilerHost._normalizePath(pathToResolve);
        if (pathToResolve[0] === '.') {
            return aotPlugin._compilerHost._normalizePath(path.join(aotPlugin._compilerHost.getCurrentDirectory(), pathToResolve));
        } else if (pathToResolve[0] === '/' || pathToResolve.match(/^\w:\//)) {
            return pathToResolve;
        } else {
            return aotPlugin._compilerHost._normalizePath(path.join(aotPlugin._compilerHost._basePath, pathToResolve));
        }
    };

    return aotPlugin;
}

function getHostReplacementPaths(projectRoot: string, projectConfig: ProjectConfig): { [key: string]: string } {
    const hostReplacementPaths: { [key: string]: string } = {};
    if (projectConfig.moduleReplacements) {
        projectConfig.moduleReplacements.forEach((entry: ModuleReplacementEntry) => {
            let root = path.resolve(projectRoot, projectConfig.srcDir || '');
            if (entry.resolveFrom === 'projectRoot' || (!entry.resolveFrom && !/\.ts$/ig.test(entry.resourcePath))) {
                if (entry.newResourcePath && fs.existsSync(path.resolve(projectRoot, entry.newResourcePath))) {
                    root = path.resolve(projectRoot);
                }
            }

            const resourcePath = path.resolve(root, entry.resourcePath);
            const newResourcePath = path.resolve(root, entry.newResourcePath);
            if (resourcePath !== newResourcePath) {
                hostReplacementPaths[resourcePath] = newResourcePath;
            }
        });

    }

    return hostReplacementPaths;
}
