import * as path from 'path';
import * as webpack from 'webpack';

import { BundleDllWebpackPlugin } from '../plugins/bundle-dll-webpack-plugin';

import { AppProjectConfig } from '../models';
import { mergeProjectConfigWithEnvOverrides } from '../helpers';

import { getDllWebpackConfig } from './dll';

import { WebpackConfigOptions } from './webpack-config-options';

export function getAppReferenceDllWebpackConfigPartial(webpackConfigOptions: WebpackConfigOptions): webpack.Configuration {
    const projectRoot = webpackConfigOptions.projectRoot;
    const appConfig = webpackConfigOptions.projectConfig as AppProjectConfig;

    if (!appConfig.referenceDll) {
        return {};
    }

    const plugins: any[] = [];

    const vendorChunkName = appConfig.vendorChunkName || 'vendor';

    const manifests: { file: string; chunkName: string; }[] = [];
    manifests.push(
        {
            file: path.resolve(projectRoot, appConfig.outDir, `${vendorChunkName}-manifest.json`),
            chunkName: vendorChunkName
        }
    );

    const cloneWebpackConfigOptions = Object.assign({}, webpackConfigOptions);
    cloneWebpackConfigOptions.buildOptions = JSON.parse(JSON.stringify(cloneWebpackConfigOptions.buildOptions));
    cloneWebpackConfigOptions.buildOptions.environment = cloneWebpackConfigOptions.buildOptions.environment || {};

    cloneWebpackConfigOptions.buildOptions.environment.dll = true;
    cloneWebpackConfigOptions.buildOptions.environment.aot = false;

    cloneWebpackConfigOptions.projectConfig = JSON.parse(JSON.stringify(cloneWebpackConfigOptions.projectConfigMaster));
    (cloneWebpackConfigOptions.projectConfig as AppProjectConfig).referenceDll = false;
    mergeProjectConfigWithEnvOverrides((cloneWebpackConfigOptions.projectConfig as AppProjectConfig),
        cloneWebpackConfigOptions.buildOptions);
    (cloneWebpackConfigOptions.projectConfig as AppProjectConfig).htmlInjectOptions = {};

    // try bundle dll
    plugins.push(new BundleDllWebpackPlugin({
        context: projectRoot,
        debug: cloneWebpackConfigOptions.buildOptions.verbose,
        manifests: manifests,
        sourceLibraryType: cloneWebpackConfigOptions.projectConfig.libraryTarget,
        getDllConfigFunc: (silent?: boolean) => {
            if (silent) {
                cloneWebpackConfigOptions.silent = true;
            }
            return getDllWebpackConfig(cloneWebpackConfigOptions);
        }
    }));

    const webpackReferenceDllConfig: webpack.Configuration = {
        plugins: plugins
    };

    return webpackReferenceDllConfig;
}
