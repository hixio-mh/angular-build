const path = require('path');
const fs = reequire('fs');

const CopyWebpackPlugin = require('copy-webpack-plugin');
const StaticAssetWebpackPlugin = require('@bizappframework/angular-build/static-asset-webpack-plugin').StaticAssetWebpackPlugin;

export default function (projectRoot, appConfig) {
    const plugins = [];
    const nodeModulesPath = path.resolve(projectRoot, 'node_modules');
    const entryPoints = {};

    const swModule = path.resolve(nodeModulesPath, '@angular/service-worker');

    // @angular/service-worker is required to be installed when serviceWorker is true.
    if (!fs.existsSync(swModule)) {
        throw new Error(`@angular/service-worker is not installed.`);
    }

    // Path to the worker script itself.
    const workerPath = path.resolve(swModule, 'bundles/worker-basic.min.js');

    // Path to a small script to register a service worker.
    const registerPath = path.resolve(swModule, 'build/assets/register-basic.min.js');

    // Sanity check - both of these files should be present in @angular/service-worker.
    if (!fs.existsSync(workerPath) || !fs.existsSync(registerPath)) {
        throw new
            Error(`The installed version of @angular/service-worker isn't supported. Please install a supported version. The following files should exist: \n${registerPath}\n${workerPath}`);
    }

    plugins.push(new CopyWebpackPlugin([
        {
            from: {
                glob: 'ngsw-manifest.json',
                dot: true
            }
        }
    ]));

    // Load the Webpack plugin for manifest generation and install it.
    const AngularServiceWorkerPlugin = require('@angular/service-worker/build/webpack')
        .AngularServiceWorkerPlugin;
    plugins.push(new AngularServiceWorkerPlugin({
        baseHref: appConfig.publicPath || appConfig.deployUrl || '/'
    }));

    // Copy the worker script into assets.
    const workerContents = fs.readFileSync(workerPath).toString();
    plugins.push(new StaticAssetWebpackPlugin('worker-basic.min.js', workerContents));

    // Add a script to index.html that registers the service worker.
    // TODO(alxhub): inline this script somehow.
    entryPoints['sw-register'] = [registerPath];

    return {
        entry: entryPoints,
        plugins: plugins
    };
}
