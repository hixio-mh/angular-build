import * as path from 'path';
import * as fs from 'fs-extra';
import * as webpack from 'webpack';

// ReSharper disable CommonJsExternalModule
// ReSharper disable InconsistentNaming
const { CheckerPlugin } = require('awesome-typescript-loader');
const { TsConfigPathsPlugin } = require('awesome-typescript-loader');
const { NgcWebpackPlugin } = require('ngc-webpack');
// ReSharper restore InconsistentNaming
// ReSharper restore CommonJsExternalModule

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
 */

export function getAngularConfigPartial(webpackConfigOptions: WebpackConfigOptions): webpack.Configuration {
    const buildOptions = webpackConfigOptions.buildOptions;
    const projectConfig = webpackConfigOptions.projectConfig;
    const logger = webpackConfigOptions.logger || new Logger();
    const environment = buildOptions.environment || {};

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

        if (useAoTPlugin && environment.dll) {
            useAoTPlugin = false;
            if (!webpackConfigOptions.silent) {
                logger.log('\n');
                logger.warnLine(`'@ngtools/webpack' is automatically disabled when using dll build.`);
            }
        }
    } else {
        useAoTPlugin = projectConfig.projectType === 'app' &&
            !environment.dll &&
            !environment.lib &&
            !environment.test &&
            !(projectConfig as AppProjectConfig).referenceDll &&
            !!projectConfig.entry &&
            (projectConfig as AppProjectConfig).tsLoader !== 'auto';
    }

    return useAoTPlugin
        ? getTypescriptAoTPluginConfigPartial(webpackConfigOptions)
        : getTypescriptDefaultPluginConfigPartial(webpackConfigOptions);
}

function getTypescriptAoTPluginConfigPartial(webpackConfigOptions: WebpackConfigOptions): webpack.Configuration {
    const projectRoot = webpackConfigOptions.projectRoot;
    const buildOptions = webpackConfigOptions.buildOptions;
    const projectConfig = webpackConfigOptions.projectConfig;
    const environment = buildOptions.environment || {};

    let exclude: string[] = [];
    if (!environment.test) {
        exclude = ['**/*.spec.ts', '**/*.e2e.ts', '**/*.e2e-spec.ts', '**/test.ts', '**/*.test.ts', '**/*-test.ts'];
    }

    const webpackIsGlobal = webpackConfigOptions.webpackIsGlobal || !(buildOptions as any).cliIsLocal;
    // IMPORTANT: To solve 'Cannot read property 'newLine' of undefined' error.
    const ngToolsWebpackLoader = webpackIsGlobal ? require.resolve('@ngtools/webpack') : '@ngtools/webpack';

    const tsRules: any[] = [{
        test: /\.ts$/,
        use: ngToolsWebpackLoader
        // exclude: [/\.(spec|e2e|e2e-spec)\.ts$/]
    }];

    const tsConfigPath = path.resolve(projectRoot, projectConfig.srcDir || '', projectConfig.tsconfig || 'tsconfig.json');
    const hostReplacementPaths: any = getHostReplacementPaths(projectRoot, projectConfig);
    const aotOptions: any = { exclude, tsConfigPath, hostReplacementPaths };

    if (!environment.aot) {
        aotOptions.skipCodeGeneration = true;
    }

    const plugins: any[] = [
        createAotPlugin(webpackConfigOptions, aotOptions)
    ];

    const angularFixPlugins = getAngularFixPlugins(projectRoot, projectConfig);
    plugins.push(...angularFixPlugins);

    return {
        module: {
            rules: tsRules
        },
        plugins: plugins
    };
}

function getTypescriptDefaultPluginConfigPartial(webpackConfigOptions: WebpackConfigOptions): webpack.Configuration {
    const projectRoot = webpackConfigOptions.projectRoot;
    const buildOptions = webpackConfigOptions.buildOptions;
    const projectConfig = webpackConfigOptions.projectConfig;
    const environment = buildOptions.environment || {};

    const rules: any[] = [];
    const plugins: any[] = [
        new CheckerPlugin()
    ];

    const tsConfigPath = path.resolve(projectRoot, projectConfig.srcDir || '', projectConfig.tsconfig || 'tsconfig.json');

    // TODO: to review
    const aotGenDirAbs = getAoTGenDirSync(tsConfigPath);
    const aotGenDirRel = path.relative(projectRoot, aotGenDirAbs || '');
    const testExcludes = [/\.(spec|e2e|e2e-spec)\.ts$/];
    // const moduleIdReplaceSearchPattern = '\\s*moduleId:\\s*module\\.id\\s*,?\\s*';

    const webpackIsGlobal = webpackConfigOptions.webpackIsGlobal || !(buildOptions as any).cliIsLocal;
    // IMPORTANT: To solve 'Cannot read property 'newLine' of undefined' error.
    const tsLoader = webpackIsGlobal ? require.resolve('awesome-typescript-loader') : 'awesome-typescript-loader';
    const ngTemplateLoader = webpackIsGlobal ? require.resolve('angular2-template-loader') : 'angular2-template-loader';
    const ngRouterLoader = webpackIsGlobal ? require.resolve('ng-router-loader') : 'ng-router-loader';

    // rules
    if (environment.test) {
        rules.push({
            test: /\.ts$/,
            use: [
                {
                    loader: tsLoader,
                    options: {
                        // use inline sourcemaps for "karma-remap-coverage" reporter
                        sourceMap: false,
                        inlineSourceMap: true,
                        configFileName: tsConfigPath
                        // compilerOptions: {
                        //    // Remove TypeScript helpers to be injected
                        //    // below by DefinePlugin
                        //    removeComments: true
                        // }
                    }
                },
                {
                    loader: ngTemplateLoader
                }
            ],
            exclude: [/\.(e2e|e2e-spec)\.ts$/]
        });
    } else if (environment.dll) {
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
                }
            ],
            exclude: testExcludes
        });
    } else if (projectConfig.projectType === 'lib') {
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

    const angularFixPlugins = getAngularFixPlugins(projectRoot, projectConfig);
    plugins.push(...angularFixPlugins);

    if (environment.aot) {
        const aotPlugin = new NgcWebpackPlugin({
            disabled: !environment.aot,
            tsConfig: tsConfigPath
        });
        plugins.push(aotPlugin);
    }

    // replace environment
    if (!environment.dll) {
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

function getAngularFixPlugins(projectRoot: string, projectConfig: ProjectConfig): any[] {
    const srcDir = path.resolve(projectRoot, projectConfig.srcDir || '');
    const angularFixPlugins: any[] = [];

    // see:  https://github.com/angular/angular/issues/11580
    if ((projectConfig as AppProjectConfig).platformTarget === 'node' ||
        (projectConfig as AppProjectConfig).platformTarget === 'async-node' ||
        (projectConfig as AppProjectConfig).platformTarget === 'node-webkit') {
        // TODO: to review
        angularFixPlugins.push(
            new webpack.ContextReplacementPlugin(
                /\@angular\b.*\b(bundles|linker)/,
                srcDir
            )
        );
    } else {
        angularFixPlugins.push(
            new webpack.ContextReplacementPlugin(
                // Angular 2
                /// angular(\\|\/)core(\\|\/)(esm(\\|\/)src|src)(\\|\/)linker/,
                // Angular 4
                /angular(\\|\/)core(\\|\/)@angular/,
                srcDir
            )
        );
    }

    return angularFixPlugins;
}

function createAotPlugin(webpackConfigOptions: WebpackConfigOptions, aotOptions: any): any {
    const projectRoot = webpackConfigOptions.projectRoot;
    const buildOptions = webpackConfigOptions.buildOptions;
    const projectConfig = webpackConfigOptions.projectConfig;
    const webpackIsGlobal = webpackConfigOptions.webpackIsGlobal || !(buildOptions as any).cliIsLocal;

    if (!projectConfig.entry) {
        throw new Error(`The 'projectConfig.entry' property is required.`);
    }

    // ReSharper disable CommonJsExternalModule
    // ReSharper disable once InconsistentNaming
    const { AotPlugin } = webpackIsGlobal
        ? require('@ngtools/webpack')
        : require(path.resolve(projectRoot, 'node_modules', '@ngtools', 'webpack'));

    // ReSharper restore CommonJsExternalModule

    var aotPlugin = new AotPlugin(Object.assign({},
        {
            // IMPORTANT
            // If not specifed mainPath and angularCompilerOptions, awesome error occurs:
            // ERROR in Cannot read property 'split' of undefined
            mainPath: path.join(projectRoot, projectConfig.srcDir || '', projectConfig.entry),
            // If we don't explicitely list excludes, it will default to `['**/*.spec.ts']`.
            exclude: []
        },
        aotOptions));

    // TEMPORARY fix for Windows 10 - will be gone when fixed
    // ReSharper disable once InconsistentNaming
    // ReSharper disable once Lambda
    aotPlugin._compilerHost._resolve = function (path_to_resolve: string): string {
        // path_1 = require("path");
        path_to_resolve = aotPlugin._compilerHost._normalizePath(path_to_resolve);
        if (path_to_resolve[0] === '.') {
            return aotPlugin._compilerHost._normalizePath(path.join(aotPlugin._compilerHost.getCurrentDirectory(), path_to_resolve));
        } else if (path_to_resolve[0] === '/' || path_to_resolve.match(/^\w:\//)) {
            return path_to_resolve;
        } else {
            return aotPlugin._compilerHost._normalizePath(path.join(aotPlugin._compilerHost._basePath, path_to_resolve));
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
