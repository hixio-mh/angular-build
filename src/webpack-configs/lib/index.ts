import * as path from 'path';
import * as webpack from 'webpack';

import { AngularBuildContextWebpackPlugin } from '../../plugins/angular-build-context-webpack-plugin';
import { CleanWebpackPlugin } from '../../plugins/clean-webpack-plugin';
import { CopyWebpackPlugin } from '../../plugins/copy-webpack-plugin';
import { LibBundleWebpackPlugin } from '../../plugins/lib-bundle-webpack-plugin';
import { TelemetryWebpackPlugin } from '../../plugins/telemetry-webpack-plugin';

import { AngularBuildContext, LibProjectConfigInternal } from '../../build-context';
import { InvalidConfigError } from '../../error-models';
import { BeforeBuildCleanOptions, CleanOptions } from '../../interfaces';

export function
    getLibWebpackConfig<TConfig extends LibProjectConfigInternal>(angularBuildContext: AngularBuildContext<TConfig>):
    webpack.Configuration {
    const libConfig = angularBuildContext.projectConfig as LibProjectConfigInternal;

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
            cleanOptions = Object.assign(cleanOptions, libConfig.clean || {});
        }

        let beforeBuildOptionsUndefined = false;
        if (typeof cleanOptions.beforeBuild === 'undefined') {
            beforeBuildOptionsUndefined = true;
        }

        cleanOptions.beforeBuild = cleanOptions.beforeBuild || {} as BeforeBuildCleanOptions;
        const beforeBuildOption = cleanOptions.beforeBuild;
        if (beforeBuildOptionsUndefined && angularBuildContext.buildOptions.cleanOutDir) {
            beforeBuildOption.cleanOutDir = true;
        }

        plugins.push(new CleanWebpackPlugin({
            ...cleanOptions,
            workspaceRoot: AngularBuildContext.workspaceRoot,
            outputPath: outputPath,
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
