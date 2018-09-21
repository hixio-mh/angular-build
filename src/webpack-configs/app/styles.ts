// Ref: https://github.com/angular/angular-cli

// tslint:disable:no-any
// tslint:disable:no-unsafe-any
// tslint:disable:no-var-requires
// tslint:disable:no-require-imports

import * as path from 'path';

import * as autoprefixer from 'autoprefixer';
import * as webpack from 'webpack';

// tslint:disable-next-line:import-name
import PostcssCliResources from '../../plugins/postcss-cli-resources';
import { RawCssLoader } from '../../plugins/raw-css-loader';
import { RemoveHashWebpacklugin } from '../../plugins/remove-hash-webpack-plugin';
import { SuppressEntryChunksWebpackPlugin } from '../../plugins/suppress-entry-chunks-webpack-plugin';

import { AngularBuildContext } from '../../build-context';
import { InternalError } from '../../error-models';
import { outputHashFormat, resolveLoaderPath } from '../../helpers';
import { AppProjectConfigInternal } from '../../interfaces/internals';

// tslint:disable-next-line:variable-name
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const postcssImports = require('postcss-import');

// tslint:disable:max-func-body-length
export function
    getAppStylesWebpackConfigPartial(angularBuildContext: AngularBuildContext<AppProjectConfigInternal>): webpack.Configuration {
    const logLevel = angularBuildContext.buildOptions.logLevel;

    const appConfig = angularBuildContext.projectConfig;

    if (!appConfig._projectRoot) {
        throw new InternalError("The 'appConfig._projectRoot' is not set.");
    }

    const projectRoot = appConfig._projectRoot;

    const extractCss = appConfig.extractCss;
    const isDll = appConfig._isDll;

    const extractedAssetsHashFormat = (!appConfig.platformTarget || appConfig.platformTarget === 'web') &&
        appConfig._outputHashing &&
        appConfig._outputHashing.extractedAssets !== false
        ? outputHashFormat.extractedAssets
        : '';
    const extractedCssHashFormat = (!appConfig.platformTarget || appConfig.platformTarget === 'web') &&
        appConfig._outputHashing &&
        (appConfig._outputHashing.bundles || appConfig._outputHashing.chunks)
        ?
        // Note: MiniCssExtractPlugin doesn't support contenthash
        outputHashFormat.extractedAssets
        : '';

    const includePaths: string[] = [];
    if (appConfig.stylePreprocessorOptions &&
        appConfig.stylePreprocessorOptions.includePaths &&
        appConfig.stylePreprocessorOptions.includePaths.length > 0
    ) {
        appConfig.stylePreprocessorOptions.includePaths.forEach((includePath: string) => {
            const includePathAbs = path.resolve(projectRoot, includePath);
            includePaths.push(includePathAbs);
        });
    }

    // const cssSourceMap = extractCss && appConfig.sourceMap;
    const cssSourceMap = appConfig.sourceMap;
    const deployUrl = appConfig.publicPath || '';
    const baseHref = appConfig.baseHref || '';

    const rawLoader = resolveLoaderPath('raw-loader');
    const postcssLoader = resolveLoaderPath('postcss-loader');
    const sassLoader = resolveLoaderPath('sass-loader');
    const styleLoader = resolveLoaderPath('style-loader');

    const postcssPluginCreator = (loader: webpack.loader.LoaderContext) => [
        postcssImports({
            resolve: (url: string) => url.startsWith('~') ? url.substr(1) : url,
            load: async (filename: string) => {
                return new Promise<string>((resolve, reject) => {
                    loader.fs.readFile(filename, (err: Error, data: Buffer) => {
                        if (err) {
                            reject(err);

                            return;
                        }

                        const content = data.toString();
                        resolve(content);
                    });
                });
            },
        }),
        PostcssCliResources({
            baseHref,
            deployUrl,
            loader,
            filename: `[name]${extractedAssetsHashFormat}.[ext]`
        }),
        autoprefixer({ grid: true })
    ];

    let dartSass: {} | undefined;
    try {
        // tslint:disable-next-line:no-implicit-dependencies
        dartSass = require('sass');
    } catch (e1) {
        // Do nothing
    }

    let fiber: {} | undefined;
    if (dartSass) {
        try {
            // tslint:disable-next-line:no-implicit-dependencies
            fiber = require('fibers');
        } catch (e2) {
            // Do nothing
        }
    }

    const baseRules: webpack.RuleSetRule[] = [
        { test: /\.css$/, use: [] },
        {
            test: /\.scss$|\.sass$/,
            use: [
                {
                    loader: sassLoader,
                    options: {
                        implementation: dartSass,
                        fiber,
                        // bootstrap-sass requires a minimum precision of 8
                        precision: 8,
                        includePaths,
                        sourceMap: cssSourceMap
                    }
                }
            ]
        }
    ];

    const entrypoints: { [key: string]: string[] } = {};
    const rules: webpack.RuleSetRule[] = [];
    const plugins: webpack.Plugin[] = [];
    const globalStylePaths: string[] = [];

    let shouldSuppressChunk = false;
    if (isDll) {
        if (appConfig.vendors && appConfig.vendors.length > 0) {
            if (!appConfig._dllParsedResult) {
                throw new InternalError("The 'appConfig._dllParsedResult' is not set.");
            }

            const dllResult = appConfig._dllParsedResult;

            dllResult.styleEntries.forEach(styleEntry => {
                globalStylePaths.push(styleEntry);
            });

            shouldSuppressChunk = !dllResult.scriptEntries.length && !dllResult.tsEntries.length;
        }
    } else {
        if (appConfig.styles && Array.isArray(appConfig.styles) && appConfig.styles.length > 0) {
            if (!appConfig._styleParsedEntries) {
                throw new InternalError("The 'appConfig._styleParsedEntries' is not set.");
            }

            const chunkNames: string[] = [];

            appConfig._styleParsedEntries.forEach(style => {
                if (style.lazy) {
                    chunkNames.push(style.entry);
                }

                globalStylePaths.push(...style.paths);

                entrypoints[style.entry]
                    ? entrypoints[style.entry].push(...style.paths)
                    : entrypoints[style.entry] = style.paths;
            });

            if (chunkNames.length > 0) {
                // Add plugin to remove hashes from lazy styles.
                plugins.push(new RemoveHashWebpacklugin({ chunkNames, hashFormats: [extractedCssHashFormat] }));
            }

            shouldSuppressChunk = true;
        }
    }

    // rules for global styles
    if (globalStylePaths.length > 0) {
        rules.push(...baseRules.map(({ test, use }) => {
            return {
                include: globalStylePaths,
                test,
                use: [
                    // TODO: to review for appConfig.platformTarget === 'node'
                    extractCss
                        ? MiniCssExtractPlugin.loader
                        : styleLoader,
                    RawCssLoader,
                    {
                        loader: postcssLoader,
                        options: {
                            ident: extractCss ? 'extracted' : 'embedded',
                            plugins: postcssPluginCreator,
                            sourceMap: cssSourceMap && !extractCss ? 'inline' : cssSourceMap
                        }
                    },
                    ...(use as webpack.Loader[])
                ]
            };
        }));

        if (extractCss) {
            // extract global css from js files into own css file
            plugins.push(
                new MiniCssExtractPlugin({
                    filename: `[name]${extractedCssHashFormat}.css`
                }));

            if (shouldSuppressChunk) {
                const vendorChunkName = appConfig.vendorChunkName || 'vendor';
                const chunks = isDll ? [vendorChunkName] : Object.keys(entrypoints);
                // suppress empty .js files in css only entry points
                plugins.push(new SuppressEntryChunksWebpackPlugin({
                    chunks: chunks,
                    supressPattern: /\.js(\.map)?$/,
                    loggerOptions: {
                        logLevel: logLevel
                    }
                }));
            }
        }
    }

    // inline styles
    const componentStyleRules = baseRules.map(({ test, use }) => ({
        exclude: globalStylePaths,
        test,
        use: [
            {
                loader: rawLoader
            },
            {
                loader: postcssLoader,
                options: {
                    ident: 'embedded',
                    plugins: postcssPluginCreator,
                    sourceMap: cssSourceMap ? 'inline' : false
                }
            },
            ...(use as webpack.Loader[])
        ]
    }));

    rules.push(...componentStyleRules);

    return {
        entry: Object.keys(entrypoints).length ? entrypoints : undefined,
        module: { rules: rules },
        plugins: plugins
    };
}
