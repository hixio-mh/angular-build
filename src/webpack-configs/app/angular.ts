// tslint:disable:no-any
// tslint:disable:no-unsafe-any

import * as path from 'path';

import { AngularCompilerPluginOptions, PLATFORM } from '@ngtools/webpack';
import { Configuration, ContextReplacementPlugin, Loader, Plugin, RuleSetRule } from 'webpack';

import { AngularBuildContext } from '../../build-context';
import { resolveLoaderPath } from '../../helpers';
import { FileReplacementEntry } from '../../models';
import { InternalError, InvalidConfigError } from '../../models/errors';
import { AppProjectConfigInternal } from '../../models/internals';

// tslint:disable-next-line:max-func-body-length
export function getAppAngularWebpackConfigPartial(angularBuildContext: AngularBuildContext<AppProjectConfigInternal>): Configuration {
    const appConfig = angularBuildContext.projectConfig;
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

    // TODO: to review
    const ngToolsLoader = (global as any)._DevKitIsLocal ? require.resolve('@ngtools/webpack') : resolveLoaderPath('@ngtools/webpack');
    const buildOptimizerLoader = (global as any)._DevKitIsLocal ?
        require.resolve('@angular-devkit/build-optimizer/src/build-optimizer/webpack-loader') :
        resolveLoaderPath('@angular-devkit/build-optimizer/webpack-loader');

    const rules: RuleSetRule[] = [{
        // Mark files inside `@angular/core` as using SystemJS style dynamic imports.
        // Removing this will cause deprecation warnings to appear.
        test: /[\/\\]@angular[\/\\]core[\/\\].+\.js$/,
        parser: { system: true }
    }];

    const buildOptimizerLoaders: Loader[] = [];

    if (appConfig.buildOptimizer) {
        const buildOptimizerLoaderConfig: Loader = {
            loader: buildOptimizerLoader,
            options: { sourceMap: appConfig.sourceMap }
        };

        buildOptimizerLoaders.push(buildOptimizerLoaderConfig);

        rules.push({
            test: /\.js$/,
            use: [
                buildOptimizerLoaderConfig
            ]
        });
    }

    const tsLoaderTestRegex = isAot
        ? /(?:\.ngfactory\.js|\.ngstyle\.js|\.tsx?)$/
        : /\.tsx?$/;

    rules.push({
        test: tsLoaderTestRegex,
        use: [...buildOptimizerLoaders, ngToolsLoader]
    });

    const plugins: Plugin[] = [
        createAotPlugin(angularBuildContext,
            {
                tsConfigPath: tsConfigPath,
                skipCodeGeneration: !isAot
            })
    ];

    if (AngularBuildContext.cliIsGlobal ||
        appConfig.platformTarget === 'node' ||
        (appConfig._nodeResolveFields &&
            appConfig._nodeResolveFields.length > 0 &&
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

export function getAngularFixPlugins(angularBuildContext: AngularBuildContext<AppProjectConfigInternal>): Plugin[] {
    const appConfig = angularBuildContext.projectConfig;

    if (!appConfig._projectRoot) {
        throw new InternalError("The 'libConfig._projectRoot' is not set.");
    }

    const projectRoot = appConfig._projectRoot;

    const angularFixPlugins: Plugin[] = [
        // fixes WARNING Critical dependency: the request of a dependency is an expression
        new ContextReplacementPlugin(
            /angular(\\|\/)core(\\|\/)(@angular|f?esm.+)/,
            projectRoot
        ),

        // fixes WARNING Critical dependency: the request of a dependency is an expression
        new ContextReplacementPlugin(
            /(.+)?express(\\|\/)(.+)?/,
            projectRoot
        )
    ];

    if (appConfig._nodeResolveFields &&
        appConfig._nodeResolveFields.length &&
        appConfig._nodeResolveFields[0] === 'main') {
        // Workaround for https://github.com/angular/angular/issues/11580
        angularFixPlugins.push(
            new ContextReplacementPlugin(
                /\@angular\b.*\b(bundles|linker)/,
                projectRoot
            )
        );
    }

    return angularFixPlugins;
}

function createAotPlugin(angularBuildContext: AngularBuildContext<AppProjectConfigInternal>,
    options: Partial<AngularCompilerPluginOptions>): Plugin {
    const appConfig = angularBuildContext.projectConfig;

    if (!appConfig._projectRoot) {
        throw new InternalError("The 'libConfig._projectRoot' is not set.");
    }

    const projectRoot = appConfig._projectRoot;
    const hostReplacementPaths = getHostReplacementPaths(AngularBuildContext.workspaceRoot, appConfig);
    // tslint:disable-next-line:no-reserved-keywords
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

    const pluginOptions: AngularCompilerPluginOptions = {
        mainPath: appConfig.entry ? path.join(projectRoot, appConfig.entry) : undefined,
        tsConfigPath: options.tsConfigPath || appConfig._tsConfigPath as string,
        i18nInFile: i18nInFile,
        i18nInFormat: appConfig.i18nFormat,
        locale: appConfig.i18nLocale,
        platform: appConfig.platformTarget === 'node' ? PLATFORM.Server : PLATFORM.Browser,
        missingTranslation: appConfig.i18nMissingTranslation,
        hostReplacementPaths: hostReplacementPaths,
        sourceMap: appConfig.sourceMap,
        additionalLazyModules,
        nameLazyFiles: appConfig.namedChunks,
        forkTypeChecker: appConfig.forkTypeChecker !== false,
        // tslint:disable-next-line:no-require-imports
        contextElementDependencyConstructor: require('webpack/lib/dependencies/ContextElementDependency'),
        ...options
    };

    // tslint:disable-next-line:non-literal-require
    const AngularCompilerPlugin = require(resolveLoaderPath('@ngtools/webpack')).AngularCompilerPlugin;

    return new AngularCompilerPlugin(pluginOptions);
}

function getHostReplacementPaths(workspaceRoot: string, appConfig: AppProjectConfigInternal): { [key: string]: string } {
    const hostReplacementPaths: { [key: string]: string } = {};
    if (appConfig.fileReplacements && Array.isArray(appConfig.fileReplacements)) {
        appConfig.fileReplacements.forEach((entry: FileReplacementEntry) => {
            const root = path.resolve(workspaceRoot, appConfig.root || '');
            const resourcePath = path.resolve(root, entry.replace);
            const newResourcePath = path.resolve(root, entry.with);
            if (resourcePath !== newResourcePath) {
                hostReplacementPaths[resourcePath] = newResourcePath;
            }
        });
    }

    return hostReplacementPaths;
}
