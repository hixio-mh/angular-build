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
import { prepareCleanOptions } from '../../helpers';
import { LibProjectConfigInternal } from '../../interfaces/internals';

export function getLibWebpackConfig(angularBuildContext: AngularBuildContext<LibProjectConfigInternal>): webpack.Configuration {
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
        (angularBuildContext.buildOptions.cleanOutDir || libConfig.clean !== false);
    if (libConfig.clean === false) {
        shouldClean = false;
    }
    if (shouldClean) {
        const cleanOptions = prepareCleanOptions(libConfig);
        const cacheDirs: string[] = [];

        if (cleanOptions.beforeBuild && cleanOptions.beforeBuild.cleanCache) {
            if (libConfig._buildOptimizerCacheDirectory) {
                cacheDirs.push(libConfig._buildOptimizerCacheDirectory);
            }
            if (libConfig._rptCacheDirectory) {
                cacheDirs.push(libConfig._rptCacheDirectory);
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
