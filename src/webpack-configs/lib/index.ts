import { Configuration, Plugin } from 'webpack';

import { AngularBuildContextWebpackPlugin } from '../../plugins/angular-build-context-webpack-plugin';
import { CleanWebpackPlugin } from '../../plugins/clean-webpack-plugin';
import { CopyWebpackPlugin } from '../../plugins/copy-webpack-plugin';
import { LibBundleWebpackPlugin } from '../../plugins/lib-bundle-webpack-plugin';

import { AngularBuildContext } from '../../build-context';
import { prepareCleanOptions } from '../../helpers';
import { InternalError } from '../../models/errors';
import { LibProjectConfigInternal } from '../../models/internals';

export async function getLibWebpackConfig(angularBuildContext: AngularBuildContext<LibProjectConfigInternal>): Promise<Configuration> {
    const libConfig = angularBuildContext.projectConfig;

    if (!libConfig._projectRoot) {
        throw new InternalError("The 'libConfig._projectRoot' is not set.");
    }

    if (!libConfig._outputPath) {
        throw new InternalError("The 'libConfig._outputPath' is not set.");
    }

    const logLevel = angularBuildContext.buildOptions.logLevel;
    const projectRoot = libConfig._projectRoot;
    const outputPath = libConfig._outputPath;

    const plugins: Plugin[] = [
        new AngularBuildContextWebpackPlugin(angularBuildContext)
    ];

    // clean
    let shouldClean = (angularBuildContext.buildOptions.cleanOutDir && !libConfig._isNestedPackage) ||
        libConfig.clean || (libConfig.clean !== false && !libConfig._isNestedPackage);
    if (libConfig.clean === false) {
        shouldClean = false;
    }
    if (shouldClean) {
        const cleanOptions = prepareCleanOptions(libConfig);
        const cacheDirs: string[] = [];

        if (cleanOptions.beforeBuild && cleanOptions.beforeBuild.cleanCache) {
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
            logLevel: logLevel
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
            logLevel: logLevel
        }));
    }

    // tslint:disable-next-line:no-unnecessary-local-variable
    const webpackConfig: Configuration = {
        name: libConfig.name,
        entry: (() => ({})),
        output: {
            path: outputPath,
            filename: '[name].js'
        },
        context: projectRoot,
        plugins: plugins,
        stats: 'errors-only'
    };

    return Promise.resolve(webpackConfig);
}
