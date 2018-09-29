import * as path from 'path';

import * as webpack from 'webpack';

import { DynamicDllWebpackPlugin } from '../../plugins/dynamic-dll-webpack-plugin';

import { AngularBuildContext } from '../../build-context';
import { applyProjectConfigWithEnvironment } from '../../helpers';
import { InternalError } from '../../models/errors';
import { AppProjectConfigInternal } from '../../models/internals';

import { getAppDllWebpackConfig } from './dll';

export function getAppReferenceDllWebpackConfigPartial(angularBuildContext:
    AngularBuildContext<AppProjectConfigInternal>): webpack.Configuration {
    const logLevel = angularBuildContext.buildOptions.logLevel;

    const appConfig = angularBuildContext.projectConfig;

    if (!appConfig.referenceDll || !appConfig.entry) {
        return {};
    }

    if (!appConfig._projectRoot) {
        throw new InternalError("The 'appConfig._projectRoot' is not set.");
    }

    if (!appConfig._outputPath) {
        throw new InternalError("The 'appConfig._outputPath' is not set.");
    }

    const projectRoot = appConfig._projectRoot;
    const outputPath = appConfig._outputPath;

    const dllEnvironment = { ...angularBuildContext.buildOptions.environment };
    dllEnvironment.dll = true;

    if (dllEnvironment.aot) {
        dllEnvironment.aot = false;
    }

    const dllProjectConfig =
        JSON.parse(JSON.stringify(angularBuildContext.projectConfigWithoutEnvApplied)) as AppProjectConfigInternal;
    applyProjectConfigWithEnvironment(dllProjectConfig, dllEnvironment);
    dllProjectConfig._isDll = true;

    const dllBuildOptions = { ...angularBuildContext.buildOptions };
    dllBuildOptions.environment = dllEnvironment;

    if (!dllProjectConfig.vendors || !dllProjectConfig.vendors.length) {
        return {};
    }

    const plugins: webpack.Plugin[] = [];

    const vendorChunkName = appConfig.vendorChunkName || 'vendor';
    const manifests: { file: string; chunkName: string }[] = [];
    manifests.push(
        {
            file: path.resolve(outputPath, `${vendorChunkName}-manifest.json`),
            chunkName: vendorChunkName
        }
    );

    const dllAngularBuildContext = new AngularBuildContext({
        workspaceRoot: AngularBuildContext.workspaceRoot,
        host: angularBuildContext.host,
        projectConfigWithoutEnvApplied: angularBuildContext.projectConfigWithoutEnvApplied,
        projectConfig: dllProjectConfig,
        buildOptions: dllBuildOptions
    });

    // dynamic dll
    plugins.push(new DynamicDllWebpackPlugin({
        manifests: manifests,
        getDllConfigFunc: () => getAppDllWebpackConfig(dllAngularBuildContext),
        logLevel: logLevel
    }));

    let sourceType = dllProjectConfig.libraryTarget;
    if (!sourceType && appConfig.platformTarget === 'node') {
        sourceType = 'commonjs2';
    }
    manifests.forEach(manifest => {
        plugins.push(
            new webpack.DllReferencePlugin({
                context: projectRoot,
                manifest: manifest.file,
                name: appConfig.platformTarget === 'node' ? `./${manifest.chunkName}` : undefined,
                sourceType: sourceType
            })
        );
    });

    // tslint:disable-next-line:no-unnecessary-local-variable
    const webpackReferenceDllConfig: webpack.Configuration = {
        plugins: plugins
    };

    return webpackReferenceDllConfig;
}
