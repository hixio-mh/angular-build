import * as path from 'path';

import * as webpack from 'webpack';

import {
    AngularCompilerPlugin,
    AngularCompilerPluginOptions,
    PLATFORM
} from '@ngtools/webpack';

import {
    AngularBuildContext,
    AppProjectConfigInternal,
    InvalidConfigError,
    ModuleReplacementEntry,
    PreDefinedEnvironment
} from '../../models';
import { isWebpackDevServer } from '../../helpers/is-webpack-dev-server';

/**
 * Enumerate loaders and their dependencies from this file to let the dependency validator
 * know they are used.
 * require('@angular-devkit/build-optimizer')
 * require('cache-loader')
 * require('ts-loader')
 */

export function getAppAngularTypescriptWebpackConfigPartial(angularBuildContext: AngularBuildContext,
    env?: PreDefinedEnvironment): webpack.Configuration {
    const appConfig = angularBuildContext.projectConfig as AppProjectConfigInternal;
    if (!appConfig.entry) {
        return {};
    }

    return getAngularPluginWebpackConfigPartial(angularBuildContext, env);
}

export function getAngularFixPlugins(angularBuildContext: AngularBuildContext): webpack.Plugin[] {
    const projectRoot = AngularBuildContext.projectRoot;

    const appConfig = angularBuildContext.projectConfig as AppProjectConfigInternal;
    const srcDir = path.resolve(projectRoot, appConfig.srcDir || '');

    const angularFixPlugins: webpack.Plugin[] = [
        // fixes WARNING Critical dependency: the request of a dependency is an expression
        new webpack.ContextReplacementPlugin(
            /angular(\\|\/)core(\\|\/)(@angular|esm.+)/,
            srcDir
        ),

        // fixes WARNING Critical dependency: the request of a dependency is an expression
        new webpack.ContextReplacementPlugin(
            /(.+)?express(\\|\/)(.+)?/,
            srcDir
        )
    ];

    // TODO: to review
    if (appConfig._nodeResolveFields &&
        appConfig._nodeResolveFields.length &&
        appConfig._nodeResolveFields[0] === 'main') {
        // Workaround for https://github.com/angular/angular/issues/11580
        angularFixPlugins.push(
            new webpack.ContextReplacementPlugin(
                /\@angular\b.*\b(bundles|linker)/,
                srcDir
            )
        );
    }

    return angularFixPlugins;
}

function getAngularPluginWebpackConfigPartial(angularBuildContext: AngularBuildContext,
    env?: PreDefinedEnvironment): webpack.Configuration {
    const appConfig = angularBuildContext.projectConfig as AppProjectConfigInternal;

    const environment = env ? env as PreDefinedEnvironment : AngularBuildContext.environment;
    const projectRoot = AngularBuildContext.projectRoot;
    const cliIsGlobal = AngularBuildContext.cliIsGlobal;

    const tsConfigFilePath = appConfig._tsConfigPath;

    if (!appConfig.tsconfig && !tsConfigFilePath) {
        throw new InvalidConfigError(
            `The '${appConfig._projectType}s[${appConfig._index
            }].tsconfig' value is required.`);
    }

    if (!tsConfigFilePath) {
        throw new InvalidConfigError(
            `Invalid tsconfig entry at '${appConfig._projectType}s[${appConfig._index
            }].tsconfig'.`);
    }

    const exclude = ['**/*.spec.ts', '**/*.e2e.ts', '**/*.e2e-spec.ts', '**/test.ts', '**/*.test.ts'];

    const ngToolsWebpackLoader = cliIsGlobal ? require.resolve('@ngtools/webpack') : '@ngtools/webpack';

    const rules: webpack.Rule[] = [];
    const boLoaders: any[] = [];

    if (AngularBuildContext.isProductionMode &&
        environment.aot &&
        appConfig.platformTarget !== 'node' &&
        !isWebpackDevServer()) {
        boLoaders.push({
            loader: '@angular-devkit/build-optimizer/webpack-loader',
            options: { sourceMap: appConfig.sourceMap }
        });

        const srcDir = path.resolve(projectRoot, appConfig.srcDir || '');
        const cacheDirectory = path.resolve(srcDir, './.bo-cache/');

        const buildOptimizerUseRule = {
            use: [
                {
                    loader: 'cache-loader',
                    options: { cacheDirectory }
                },
                {
                    loader: '@angular-devkit/build-optimizer/webpack-loader',
                    options: { sourceMap: appConfig.sourceMap }
                }
            ],
        };

        rules.push({
            test: /[\/\\]@angular[\/\\].+\.js$/,
            sideEffects: false,
            parser: { system: true },
            ...buildOptimizerUseRule,
        } as any);

        rules.push({
            test: /\.js$/,
            ...buildOptimizerUseRule
        });
    }

    const tsLoaderTestRegex = environment.aot
        ? /(?:\.ngfactory\.js|\.ngstyle\.js|\.ts)$/
        : /\.ts$/;

    rules.push({
        test: tsLoaderTestRegex,
        use: [...boLoaders, ngToolsWebpackLoader]
    });

    const aotOptions: any = {
        exclude
    };

    if (!environment.aot) {
        aotOptions.skipCodeGeneration = true;
    }

    const plugins: webpack.Plugin[] = [
        createAotPlugin(angularBuildContext, aotOptions)
    ];

    // TODO: to reivew necessary?
    if (appConfig.platformTarget === 'node' ||
        (appConfig._nodeResolveFields &&
            appConfig._nodeResolveFields.length &&
            appConfig._nodeResolveFields[0] === 'main')) {
        const angularFixPlugins = getAngularFixPlugins(angularBuildContext);
        plugins.push(...angularFixPlugins);
    }

    return {
        module: {
            rules: rules
        },
        plugins: plugins
    };
}

function createAotPlugin(angularBuildContext: AngularBuildContext, options: AngularCompilerPluginOptions): webpack.Plugin {
    const appConfig = angularBuildContext.projectConfig as AppProjectConfigInternal;

    const projectRoot = AngularBuildContext.projectRoot;
    const srcDir = path.resolve(projectRoot, appConfig.srcDir || '');

    const hostReplacementPaths = getHostReplacementPaths(projectRoot, appConfig);

    const additionalLazyModules: { [module: string]: string } = {};
    if (appConfig.lazyModules) {
        for (const lazyModule of appConfig.lazyModules) {
            additionalLazyModules[lazyModule] = path.resolve(
                srcDir,
                lazyModule,
            );
        }
    }

    let nameLazyFiles = appConfig.nameLazyFiles;
    if (typeof nameLazyFiles === 'undefined') {
        nameLazyFiles = !AngularBuildContext.isProductionMode;
    }

    const i18nInFile = appConfig.i18nInFile
        ? path.resolve(srcDir, appConfig.i18nInFile)
        : undefined;

    const pluginOptions: AngularCompilerPluginOptions = {
        mainPath: appConfig.entry ? path.join(srcDir, appConfig.entry) : undefined,
        tsConfigPath: appConfig._tsConfigPath,
        i18nInFile: i18nInFile,
        i18nInFormat: appConfig.i18nInFormat,
        i18nOutFile: appConfig.i18nOutFile,
        i18nOutFormat: appConfig.i18nOutFormat,
        locale: appConfig.locale,
        platform: appConfig.platformTarget === 'node' ? PLATFORM.Server : PLATFORM.Browser,
        missingTranslation: appConfig.missingTranslation,
        hostReplacementPaths: hostReplacementPaths,
        sourceMap: appConfig.sourceMap,
        additionalLazyModules,
        nameLazyFiles: nameLazyFiles,
        forkTypeChecker: appConfig.forkTypeChecker,
        ...options
        // host: angularBuildContext.host
    };

    return new AngularCompilerPlugin(pluginOptions);
}

function getHostReplacementPaths(projectRoot: string, appConfig: AppProjectConfigInternal): { [key: string]: string } {
    const hostReplacementPaths: { [key: string]: string } = {};
    if (appConfig.moduleReplacements) {
        appConfig.moduleReplacements.forEach((entry: ModuleReplacementEntry) => {
            const root = path.resolve(projectRoot, appConfig.srcDir || '');
            const resourcePath = path.resolve(root, entry.resourcePath);
            const newResourcePath = path.resolve(root, entry.newResourcePath);
            if (resourcePath !== newResourcePath) {
                hostReplacementPaths[resourcePath] = newResourcePath;
            }
        });
    }

    return hostReplacementPaths;
}
