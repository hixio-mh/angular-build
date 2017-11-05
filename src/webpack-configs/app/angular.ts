import { existsSync, readFileSync } from 'fs';
import * as path from 'path';

import * as webpack from 'webpack';
import { stripIndent } from 'common-tags';
import * as semver from 'semver';

import {
    AotPlugin,
    AotPluginOptions,
    AngularCompilerPlugin,
    AngularCompilerPluginOptions,
    PLATFORM } from '@ngtools/webpack';

import { CopyWebpackPlugin } from '../../plugins/copy-webpack-plugin';
import { AddStaticAssetWebpackPlugin } from '../../plugins/add-static-asset-webpack-plugin';

import {
    AppBuildContext,
    AppProjectConfigInternal,
    InternalError,
    InvalidConfigError,
    ModuleReplacementEntry
} from '../../models';
import { isWebpackDevServer } from '../../helpers';

/**
 * Enumerate loaders and their dependencies from this file to let the dependency validator
 * know they are used.
 * require('@angular-devkit/build-optimizer')
 */

export function getAppAngularTypescriptWebpackConfigPartial(angularBuildContext: AppBuildContext): webpack.Configuration {
    const appConfig = angularBuildContext.projectConfig as AppProjectConfigInternal;
    if (!appConfig.entry) {
        return {};
    }

    return getAngularPluginWebpackConfigPartial(angularBuildContext);
}

// Ref: https://github.com/angular/angular-cli
// TODO: to review for >=5.0.0
export function getAppAngularServiceWorkerWebpackConfigPartial(angularBuildContext: AppBuildContext): webpack.Configuration {
    const projectRoot = angularBuildContext.projectRoot;
    const appConfig = angularBuildContext.projectConfig as AppProjectConfigInternal;

    if (appConfig._projectType !== 'app' ||
        !appConfig.serviceWorker ||
        !appConfig.entry ||
        appConfig.platformTarget === 'node') {
        return {};
    }

    const srcDir = path.resolve(projectRoot, appConfig.srcDir || '');
    const swModule = path.resolve(angularBuildContext.nodeModulesPath, '@angular/service-worker');

    const entryPoints: { [key: string]: string[] } = {};

    // @angular/service-worker is required to be installed when serviceWorker is true.
    if (!existsSync(swModule)) {
        throw new InvalidConfigError(stripIndent`
        Your project is configured with serviceWorker = true, but @angular/service-worker
        is not installed. Run 'npm install -S @angular/service-worker'
        and try again, or set 'apps[${appConfig._index}].serviceWorker' = false in your angular-build.json.
      `);
    }

    // Read the version of @angular/service-worker and throw if it doesn't match the
    // expected version.
    const allowedVersion = '>= 1.0.0-beta.5 < 2.0.0';
    const swPackageJson = readFileSync(`${path.resolve(swModule, 'package.json')}`).toString();
    const swVersion = JSON.parse(swPackageJson).version;
    if (!semver.satisfies(swVersion, allowedVersion)) {
        throw new InvalidConfigError(stripIndent`
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
    if (!existsSync(workerPath) || !existsSync(registerPath)) {
        throw new InvalidConfigError(stripIndent`
        The installed version of @angular/service-worker isn't supported by the cli.
        Please install a supported version. The following files should exist:
        - ${registerPath}
        - ${workerPath}
      `);
    }

    // Path to a small script to register a service worker.
    entryPoints['sw-register'] = [registerPath];

    const plugins: webpack.Plugin[] = [];

    plugins.push(new CopyWebpackPlugin({
        assets: [
            'ngsw-manifest.json'
        ],
        baseDir: srcDir
    }));

    // Load the Webpack plugin for manifest generation and install it.
    const AngularServiceWorkerPlugin = require('@angular/service-worker/build/webpack')
        .AngularServiceWorkerPlugin;
    plugins.push(new AngularServiceWorkerPlugin({
        baseHref: appConfig.baseHref || '/'
    }));

    // Copy the worker script into assets.
    const workerContents = readFileSync(workerPath).toString();
    plugins.push(new AddStaticAssetWebpackPlugin('worker-basic.min.js', workerContents));

    return {
        entry: entryPoints,
        plugins: plugins
    };
}

export function getAngularFixPlugins(angularBuildContext: AppBuildContext): webpack.Plugin[] {
    const projectRoot = angularBuildContext.projectRoot;
    const appConfig = angularBuildContext.projectConfig as AppProjectConfigInternal;

    const srcDir = path.resolve(projectRoot, appConfig.srcDir || '');

    const angularFixPlugins: webpack.Plugin[] = [];

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

    angularFixPlugins.push(
        // Workaround for https://github.com/angular/angular/issues/14898
        new webpack.ContextReplacementPlugin(
            // Angular 2
            // angular(\\|\/)core(\\|\/)(esm(\\|\/)src|src)(\\|\/)linker/,
            /angular(\\|\/)core(\\|\/)(@angular|esm.+)/,
            srcDir
        )
    );

    return angularFixPlugins;
}

function getAngularPluginWebpackConfigPartial(angularBuildContext: AppBuildContext): webpack.Configuration {
    const appConfig = angularBuildContext.projectConfig as AppProjectConfigInternal;
    const cliIsGlobal = angularBuildContext.cliIsGlobal;
    const environment = angularBuildContext.environment;

    if (!appConfig.entry) {
        return {};
    }

    const tsConfigFilePath = appConfig._tsConfigPath;

    if (!appConfig.tsconfig && !tsConfigFilePath) {
        throw new InvalidConfigError(
            `The '${appConfig._projectType}s[${appConfig._index
            }].tsconfig' value is required.`);
    }

    if (!tsConfigFilePath) {
        throw new InternalError(`The 'appConfig._tsConfigPath' is not set.`);
    }

    const exclude = ['**/*.spec.ts', '**/*.e2e.ts', '**/*.e2e-spec.ts', '**/test.ts', '**/*.test.ts'];

    const ngToolsWebpackLoader = cliIsGlobal ? require.resolve('@ngtools/webpack') : '@ngtools/webpack';
    const buildOptimizerLoader = cliIsGlobal
        ? require.resolve('@angular-devkit/build-optimizer/webpack-loader')
        : '@angular-devkit/build-optimizer/webpack-loader';

    let boLoaders: any = [];
    const rules: webpack.Rule[] = [];

    // build-optimizer/webpack-loader
    if (environment.prod && environment.aot && !isWebpackDevServer()) {
        boLoaders = [{
            loader: buildOptimizerLoader,
            options: { sourceMap: appConfig.sourceMap }
        }];

        rules.push({
            test: /\.js$/,
            use: [{
                loader: buildOptimizerLoader,
                options: { sourceMap: appConfig.sourceMap }
            }]
        });
    }

    const tsLoaderTestRegex = AngularCompilerPlugin.isSupported()
        ? /(?:\.ngfactory\.js|\.ngstyle\.js|\.ts)$/
        : /\.ts$/;

    rules.push({
        test: tsLoaderTestRegex,
        use: [...boLoaders, ngToolsWebpackLoader]
    });

    const aotOptions: any = {
        exclude
    };

    // if (!environment.aot && environment.test) {
    //    aotOptions.skipCodeGeneration = true;

    //    const tsConfigFolderPath = path.dirname(tsConfigFilePath);

    //    // Force include main and polyfills.
    //    // This is needed for AngularCompilerPlugin compatibility with existing projects,
    //    // since TS compilation there is stricter and tsconfig.spec.ts doesn't include them.
    //    aotOptions.include = [] as string[];
    //    const srcDir = path.resolve(projectRoot, projectConfig.srcDir || '');
    //    const entryPath = path.resolve(srcDir, projectConfig.entry);
    //    const entryRel = path.relative(tsConfigFolderPath, entryPath).replace(/\\/g, '/');
    //    aotOptions.include.push(entryRel);
    //    let polyfills = (projectConfig as AppProjectConfigInternal).polyfills;
    //    if (polyfills && polyfills.length > 0) {
    //        polyfills = Array.isArray(polyfills) ? polyfills : [polyfills];
    //        const polyfillResult = (projectConfig as AppProjectConfigInternal)._polyfillParsedResult
    //            ? (projectConfig as AppProjectConfigInternal)._polyfillParsedResult
    //            : parseDllEntries(srcDir, polyfills);
    //        if (!(projectConfig as AppProjectConfigInternal)._polyfillParsedResult) {
    //            (projectConfig as AppProjectConfigInternal)._polyfillParsedResult = polyfillResult;
    //        }

    //        if (polyfillResult) {
    //            polyfillResult.tsEntries.forEach(tsEntry => {
    //                const tsEntryRel = path.relative(tsConfigFolderPath, tsEntry).replace(/\\/g, '/');
    //                aotOptions.include.push(tsEntryRel);
    //            });
    //        }
    //    }
    // }

    const plugins: webpack.Plugin[] = [
        createAotPlugin(angularBuildContext, aotOptions)
    ];

    // TODO: to review necessary?
    if (appConfig._nodeResolveFields &&
        appConfig._nodeResolveFields.length &&
        appConfig._nodeResolveFields[0] === 'main') {
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

// AotPluginOptions | AngularCompilerPluginOptions
function createAotPlugin(angularBuildContext: AppBuildContext,
    options: any): webpack.Plugin {
    const projectRoot = angularBuildContext.projectRoot;
    const appConfig = angularBuildContext.projectConfig as AppProjectConfigInternal;

    if (!appConfig.entry) {
        throw new InvalidConfigError(
            `The '${appConfig._projectType}s[${appConfig._index
            }].entry' value is required.`);
    }

    options.compilerOptions = options.compilerOptions || {};

    // const { AotPlugin } = !buildContext.cliIsGlobal
    //    ? require(path.resolve(solutionRoot, 'node_modules', '@ngtools/webpack'))
    //    : require('@ngtools/webpack');


    const hostReplacementPaths = getHostReplacementPaths(projectRoot, appConfig);

    // TEMPORARY fix for Windows 10 - will be gone when fixed
    // aotPlugin._compilerHost._resolve = function (pathToResolve: string): string {
    //    // path_1 = require("path");
    //    pathToResolve = aotPlugin._compilerHost._normalizePath(pathToResolve);
    //    if (pathToResolve[0] === '.') {
    //        return aotPlugin._compilerHost._normalizePath(path.join(aotPlugin._compilerHost.getCurrentDirectory(), pathToResolve));
    //    } else if (pathToResolve[0] === '/' || pathToResolve.match(/^\w:\//)) {
    //        return pathToResolve;
    //    } else {
    //        return aotPlugin._compilerHost._normalizePath(path.join(aotPlugin._compilerHost._basePath, pathToResolve));
    //    }
    // };

    if (AngularCompilerPlugin.isSupported()) {
        const pluginOptions: AngularCompilerPluginOptions = Object.assign({},
            {
                tsConfigPath: appConfig._tsConfigPath,
                // IMPORTANT
                // If not specifed mainPath and angularCompilerOptions, awesome error occurs:
                // ERROR in Cannot read property 'split' of undefined
                mainPath: path.join(projectRoot, appConfig.srcDir || '', appConfig.entry),
                i18nFile: appConfig.i18nFile,
                i18nFormat: appConfig.i18nFormat,
                i18nOutFile: appConfig.i18nOutFile,
                i18nOutFormat: appConfig.i18nOutFormat,
                locale: appConfig.locale,
                platform: appConfig.platformTarget === 'node' ? PLATFORM.Server : PLATFORM.Browser,
                missingTranslation: appConfig.missingTranslation,
                hostReplacementPaths: hostReplacementPaths,
                sourceMap: appConfig.sourceMap
            }, options);
        return new AngularCompilerPlugin(pluginOptions);
    } else {
        const pluginOptions: AotPluginOptions = Object.assign({},
            {
                tsConfigPath: appConfig._tsConfigPath,
                // IMPORTANT
                // If not specifed mainPath and angularCompilerOptions, awesome error occurs:
                // ERROR in Cannot read property 'split' of undefined
                mainPath: path.join(projectRoot, appConfig.srcDir || '', appConfig.entry),
                i18nFile: appConfig.i18nFile,
                i18nFormat: appConfig.i18nFormat,
                locale: appConfig.locale,
                replaceExport: appConfig.platformTarget === 'node',
                missingTranslation: appConfig.missingTranslation,
                hostReplacementPaths: hostReplacementPaths,
                sourceMap: appConfig.sourceMap,
                // If we don't explicitely list excludes, it will default to `['**/*.spec.ts']`.
                exclude: []
            },
            options);
        return new AotPlugin(pluginOptions);
    }

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
