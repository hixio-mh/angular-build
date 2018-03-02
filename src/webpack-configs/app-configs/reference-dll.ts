import * as path from 'path';
import * as webpack from 'webpack';

import { DynamicDllWebpackPlugin } from '../../plugins/dynamic-dll-webpack-plugin';

import {
    AngularBuildContext,
    AppProjectConfigInternal,
    InvalidConfigError,
    PreDefinedEnvironment,
    ProjectConfigInternal
} from '../../models';
import { applyProjectConfigWithEnvOverrides, applyProjectConfigDefaults } from '../../helpers/prepare-configs';

import { getAppDllWebpackConfig } from './dll';

export function getAppReferenceDllWebpackConfigPartial(angularBuildContext: AngularBuildContext, env?: PreDefinedEnvironment): webpack.
    Configuration {
    const appConfig = angularBuildContext.projectConfig as AppProjectConfigInternal;

    if (!appConfig.referenceDll || !appConfig.entry) {
        return {};
    }

    if (!appConfig.outDir) {
        throw new InvalidConfigError(`The 'apps[${appConfig._index
            }].outDir' propertry is required at angular-build.json file.`);
    }

    const environment = env ? env as PreDefinedEnvironment : AngularBuildContext.environment;
    const projectRoot = AngularBuildContext.projectRoot;

    const dllEnvironment =
        JSON.parse(JSON.stringify(environment)) as PreDefinedEnvironment;
    dllEnvironment.aot = false;
    dllEnvironment.dll = true;

    const dllProjectConfig =
        JSON.parse(JSON.stringify(angularBuildContext.projectConfigMaster)) as AppProjectConfigInternal;
    applyProjectConfigWithEnvOverrides(dllProjectConfig, dllEnvironment);
    applyProjectConfigDefaults(projectRoot,
        dllProjectConfig,
        dllEnvironment,
        AngularBuildContext.isProductionMode,
        AngularBuildContext.commandOptions || {});

    if (!dllProjectConfig.dll ||
        (Array.isArray(dllProjectConfig.dll) && !dllProjectConfig.dll.length) ||
        (typeof dllProjectConfig.dll === 'object' && !Object.keys(dllProjectConfig.dll).length)) {
        return {};
    }

    const plugins: webpack.Plugin[] = [];

    const vendorChunkName = appConfig.vendorChunkName || 'vendor';
    const manifests: { file: string; chunkName: string; }[] = [];
    manifests.push(
        {
            file: path.resolve(projectRoot, appConfig.outDir, `${vendorChunkName}-manifest.json`),
            chunkName: vendorChunkName
        }
    );

    const dllAngularBuildContext = new AngularBuildContext(
        angularBuildContext.projectConfigMaster,
        dllProjectConfig as ProjectConfigInternal
    );

    // dynamic dll
    plugins.push(new DynamicDllWebpackPlugin({
        manifests: manifests,
        getDllConfigFunc: () => getAppDllWebpackConfig(dllAngularBuildContext, dllEnvironment),
        loggerOptions: {
            logLevel: AngularBuildContext.angularBuildConfig.logLevel
        }
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

    const webpackReferenceDllConfig: webpack.Configuration = {
        plugins: plugins
    };

    return webpackReferenceDllConfig;
}
