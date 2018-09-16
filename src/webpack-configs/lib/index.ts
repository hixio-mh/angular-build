 // tslint:disable:no-any
// tslint:disable:no-unsafe-any

import * as path from 'path';
import * as webpack from 'webpack';

import { AngularBuildContextWebpackPlugin } from '../../plugins/angular-build-context-webpack-plugin';
import { CleanWebpackPlugin } from '../../plugins/clean-webpack-plugin';
import { CopyWebpackPlugin } from '../../plugins/copy-webpack-plugin';
import { LibBundleWebpackPlugin } from '../../plugins/lib-bundle-webpack-plugin';
import { TelemetryWebpackPlugin } from '../../plugins/telemetry-webpack-plugin';

import { AngularBuildContext } from '../../build-context';
import { InvalidConfigError } from '../../error-models';
import { CleanOptions } from '../../interfaces';
import { LibProjectConfigInternal } from '../../interfaces/internals';

export function
    getLibWebpackConfig<TConfig extends LibProjectConfigInternal>(angularBuildContext: AngularBuildContext<TConfig>):
    webpack.Configuration {
    const libConfig = angularBuildContext.projectConfig;

    if (!libConfig.outputPath) {
        throw new InvalidConfigError(
            `The 'projects[${libConfig.name || libConfig._index}].outputPath' value is required.`);
    }

    const logLevel = angularBuildContext.buildOptions.logLevel;
    const projectRoot = path.resolve(AngularBuildContext.workspaceRoot, libConfig.root || '');
    const outputPath = path.resolve(AngularBuildContext.workspaceRoot, libConfig.outputPath);

    const plugins: webpack.Plugin[] = [
        new AngularBuildContextWebpackPlugin(angularBuildContext)
    ];

    // clean
    let shouldClean = outputPath &&
        (angularBuildContext.buildOptions.cleanOutDir || libConfig.clean);
    if (libConfig.clean === false) {
        shouldClean = false;
    }
    if (shouldClean) {
        let cleanOptions: CleanOptions = {};
        if (typeof libConfig.clean === 'object') {
            cleanOptions = { ...cleanOptions, ...(libConfig.clean || {}) };
        }

        cleanOptions.beforeBuild = (cleanOptions.beforeBuild || {});
        const beforeBuildOption = cleanOptions.beforeBuild;
        if (cleanOptions.beforeBuild == null && angularBuildContext.buildOptions.cleanOutDir) {
            beforeBuildOption.cleanOutDir = true;
        }

        if (beforeBuildOption.cleanOutDir && beforeBuildOption.cleanCache == null) {
            beforeBuildOption.cleanCache = true;
        }

        const cacheDirs: string[] = [];
        if (beforeBuildOption.cleanCache) {
            if (angularBuildContext.buildOptimizerCacheDirectory) {
                cacheDirs.push(angularBuildContext.buildOptimizerCacheDirectory);
            }
        }

        plugins.push(new CleanWebpackPlugin({
            ...cleanOptions,
            workspaceRoot: AngularBuildContext.workspaceRoot,
            outputPath: outputPath,
            cacheDirectries: cacheDirs,
            host: angularBuildContext.host,
            loggerOptions: {
                logLevel: logLevel
            }
        }));
    }

    // styles, ngc, bundle, packager
    plugins.push(new LibBundleWebpackPlugin({
        angularBuildContext: angularBuildContext
    }));

    // copy assets
    if (libConfig.copy && Array.isArray(libConfig.copy) && libConfig.copy.length > 0) {
        plugins.push(new CopyWebpackPlugin({
            assets: libConfig.copy,
            baseDir: projectRoot,
            outputPath: outputPath,
            allowCopyOutsideOutputPath: true,
            forceWriteToDisk: true,
            loggerOptions: AngularBuildContext.logger.loggerOptions
        }));
    }

    // telemetry plugin
    if (!AngularBuildContext.telemetryPluginAdded) {
        AngularBuildContext.telemetryPluginAdded = true;
        plugins.push(new TelemetryWebpackPlugin());
    }

    // tslint:disable-next-line:no-unnecessary-local-variable
    const webpackConfig: webpack.Configuration = {
        name: libConfig.name,
        entry: (() => ({})) as any,
        output: {
            path: outputPath,
            filename: '[name].js'
        },
        context: projectRoot,
        plugins: plugins,
        stats: 'errors-only'
    };

    return webpackConfig;
}
