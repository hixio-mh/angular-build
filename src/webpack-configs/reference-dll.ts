import * as path from 'path';
import * as webpack from 'webpack';

import { TryBundleDllWebpackPlugin } from '../plugins/try-bundle-dll-webpack-plugin';

import { AppProjectConfig } from '../models';
import { mergeProjectConfigWithEnvOverrides } from '../helpers';

import { getAppDllConfig } from './dll';

import { WebpackConfigOptions } from './webpack-config-options';

export function getAppReferenceDllConfigPartial(webpackConfigOptions: WebpackConfigOptions): webpack.Configuration {
    const projectRoot = webpackConfigOptions.projectRoot;
    const appConfig = webpackConfigOptions.projectConfig as AppProjectConfig;

    if (!appConfig.referenceDll) {
        return {};
    }

    const entryPoints: { [key: string]: string[] } = {};
    const rules: any[] = [];
    const plugins: any[] = [];

    const vendorChunkName = appConfig.vendorChunkName || 'vendor';
    const polyfillsChunkName = appConfig.polyfillsChunkName || 'polyfills';

    const manifests: { file: string; chunkName: string; }[] = [];
    manifests.push(
        {
            file: path.resolve(projectRoot, appConfig.outDir, `${vendorChunkName}-manifest.json`),
            chunkName: vendorChunkName
        }
    );

    if (appConfig.polyfills && appConfig.polyfills.length > 0) {
        manifests.push({
            file: path.resolve(projectRoot, appConfig.outDir, `${polyfillsChunkName}-manifest.json`),
            chunkName: polyfillsChunkName
        });
    }

    const cloneWebpackConfigOptions = Object.assign({}, webpackConfigOptions);
    cloneWebpackConfigOptions.projectConfig = JSON.parse(JSON.stringify(cloneWebpackConfigOptions.projectConfig));
    cloneWebpackConfigOptions.buildOptions = JSON.parse(JSON.stringify(cloneWebpackConfigOptions.buildOptions));
    cloneWebpackConfigOptions.buildOptions.environment = cloneWebpackConfigOptions.buildOptions.environment || {};

    cloneWebpackConfigOptions.buildOptions.environment.dll = true;
    cloneWebpackConfigOptions.buildOptions.environment.aot = false;
    (cloneWebpackConfigOptions.projectConfig as AppProjectConfig).htmlInjectOptions = {};
    (cloneWebpackConfigOptions.projectConfig as AppProjectConfig).referenceDll = false;
    (cloneWebpackConfigOptions.projectConfig as AppProjectConfig).extractCss = false;
    mergeProjectConfigWithEnvOverrides((cloneWebpackConfigOptions.projectConfig as AppProjectConfig),
        cloneWebpackConfigOptions.buildOptions);

    // try bundle dll
    plugins.push(new TryBundleDllWebpackPlugin({
        context: projectRoot,
        debug: cloneWebpackConfigOptions.buildOptions.verbose,
        manifests: manifests,
        sourceLibraryType: cloneWebpackConfigOptions.projectConfig.libraryTarget,
        getDllConfigFunc: (silent?: boolean) => {
            if (silent) {
                cloneWebpackConfigOptions.silent = true;
            }
            return getAppDllConfig(cloneWebpackConfigOptions);
        }
    }));

    const webpackNonDllConfig: webpack.Configuration = {
        entry: entryPoints,
        module: {
            rules: rules
        },
        plugins: plugins
    };

    return webpackNonDllConfig;
}
