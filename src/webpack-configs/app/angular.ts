import * as path from 'path';

import { NodeJsSyncHost } from '@angular-devkit/core/node';
import { AngularCompilerPluginOptions, PLATFORM } from '@ngtools/webpack';
import * as webpack from 'webpack';

import { AngularBuildContext, AppProjectConfigInternal } from '../../build-context';
import { InvalidConfigError } from '../../error-models';
import { resolveLoaderPath } from '../../helpers';
import { FileReplacementEntry } from '../../interfaces';

export function
    getAppAngularTypescriptWebpackConfigPartial<TConfig extends AppProjectConfigInternal>(angularBuildContext:
        AngularBuildContext<TConfig>): webpack.Configuration {
    const appConfig = angularBuildContext.projectConfig as AppProjectConfigInternal;
    if (!appConfig.entry && !appConfig.tsConfig) {
        return {};
    }

    const tsConfigPath = appConfig._tsConfigPath;

    if (!appConfig.tsConfig && !tsConfigPath) {
        throw new InvalidConfigError(
            `The 'projects[${appConfig.name || appConfig._index}].tsConfig' value is required.`);
    }

    if (!tsConfigPath) {
        throw new InvalidConfigError(
            `Invalid tsConfig entry at 'projects[${appConfig.name || appConfig._index}].tsConfig'.`);
    }

    let isAot = false;
    if (appConfig.aot) {
        isAot = true;
    }

    const ngToolsLoader = resolveLoaderPath('@ngtools/webpack');
    const buildOptimizerLoader = resolveLoaderPath('@angular-devkit/build-optimizer/webpack-loader');
    const cacheLoader = resolveLoaderPath('cache-loader');

    const rules: webpack.Rule[] = [];

    rules.push({
        // Mark files inside `@angular/core` as using SystemJS style dynamic imports.
        // Removing this will cause deprecation warnings to appear.
        test: /[\/\\]@angular[\/\\]core[\/\\].+\.js$/,
        parser: { system: true }
    } as any);

    const tsBuildOptimizerLoaders: any[] = [];

    if (appConfig.buildOptimizer) {
        tsBuildOptimizerLoaders.push({
            loader: buildOptimizerLoader,
            options: { sourceMap: appConfig.sourceMap }
        });

        const projectRoot = path.resolve(AngularBuildContext.workspaceRoot, appConfig.root || '');
        const cacheDirectory = path.resolve(projectRoot, './.bo-cache/');

        const buildOptimizerUseRule = {
            use: [
                {
                    loader: cacheLoader,
                    options: { cacheDirectory }
                },
                {
                    loader: buildOptimizerLoader,
                    options: { sourceMap: appConfig.sourceMap }
                }
            ]
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

    const tsLoaderTestRegex = isAot
        ? /(?:\.ngfactory\.js|\.ngstyle\.js|\.ts)$/
        : /\.ts$/;

    rules.push({
        test: tsLoaderTestRegex,
        use: [...tsBuildOptimizerLoaders, ngToolsLoader]
    });

    const plugins: webpack.Plugin[] = [
        createAotPlugin(angularBuildContext,
            {
                tsConfigPath: tsConfigPath,
                skipCodeGeneration: !isAot
            })
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

export function
    getAngularFixPlugins<TConfig extends AppProjectConfigInternal>(angularBuildContext: AngularBuildContext<TConfig>):
    webpack.Plugin[] {
    const appConfig = angularBuildContext.projectConfig as AppProjectConfigInternal;
    const projectRoot = path.resolve(AngularBuildContext.workspaceRoot, appConfig.root || '');

    const angularFixPlugins: webpack.Plugin[] = [
        // fixes WARNING Critical dependency: the request of a dependency is an expression
        new webpack.ContextReplacementPlugin(
            /angular(\\|\/)core(\\|\/)(@angular|esm.+)/,
            projectRoot
        ),

        // fixes WARNING Critical dependency: the request of a dependency is an expression
        new webpack.ContextReplacementPlugin(
            /(.+)?express(\\|\/)(.+)?/,
            projectRoot
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
                projectRoot
            )
        );
    }

    return angularFixPlugins;
}

function createAotPlugin<TConfig extends AppProjectConfigInternal>(angularBuildContext: AngularBuildContext<TConfig>,
    options: Partial<AngularCompilerPluginOptions>): webpack.Plugin {
    const appConfig = angularBuildContext.projectConfig as AppProjectConfigInternal;
    const projectRoot = path.resolve(AngularBuildContext.workspaceRoot, appConfig.root || '');
    const hostReplacementPaths = getHostReplacementPaths(AngularBuildContext.workspaceRoot, appConfig);
    const additionalLazyModules: { [module: string]: string } = {};

    if (appConfig.lazyModules && Array.isArray(appConfig.lazyModules)) {
        for (const lazyModule of appConfig.lazyModules) {
            additionalLazyModules[lazyModule] = path.resolve(
                projectRoot,
                lazyModule,
            );
        }
    }

    const i18nInFile = appConfig.i18nFile
        ? path.resolve(projectRoot, appConfig.i18nFile)
        : undefined;

    const host: any = angularBuildContext.host || new NodeJsSyncHost();

    const pluginOptions: AngularCompilerPluginOptions = {
        mainPath: appConfig.entry ? path.join(projectRoot, appConfig.entry) : undefined,
        tsConfigPath: options.tsConfigPath || appConfig._tsConfigPath as string,
        i18nInFile: i18nInFile,
        i18nInFormat: appConfig.i18nFormat,
        i18nOutFile: appConfig.i18nOutFile,
        i18nOutFormat: appConfig.i18nOutFormat,
        locale: appConfig.i18nLocale,
        platform: appConfig.platformTarget === 'node' ? PLATFORM.Server : PLATFORM.Browser,
        missingTranslation: appConfig.i18nMissingTranslation,
        hostReplacementPaths: hostReplacementPaths,
        sourceMap: appConfig.sourceMap,
        additionalLazyModules,
        nameLazyFiles: appConfig.namedChunks,
        forkTypeChecker: appConfig.forkTypeChecker,
        ...options,
        host: host
    };

    const AngularCompilerPlugin = require(resolveLoaderPath('@ngtools/webpack')).AngularCompilerPlugin;

    return new AngularCompilerPlugin(pluginOptions);
}

function getHostReplacementPaths(workspaceRoot: string, appConfig: AppProjectConfigInternal): { [key: string]: string } {
    const hostReplacementPaths: { [key: string]: string } = {};
    if (appConfig.fileReplacements && Array.isArray(appConfig.fileReplacements)) {
        appConfig.fileReplacements.forEach((entry: FileReplacementEntry) => {
            const root = path.resolve(workspaceRoot, appConfig.root || '');
            const resourcePath = path.resolve(root, entry.src);
            const newResourcePath = path.resolve(root, entry.replaceWith);
            if (resourcePath !== newResourcePath) {
                hostReplacementPaths[resourcePath] = newResourcePath;
            }
        });
    }

    return hostReplacementPaths;
}
