// Ref: https://github.com/angular/angular-cli
import * as path from 'path';
import * as webpack from 'webpack';

import * as autoprefixer from 'autoprefixer';
import * as ExtractTextPlugin from 'extract-text-webpack-plugin';

import PostcssCliResources from '../../plugins/postcss-cli-resources';
import { SuppressEntryChunksWebpackPlugin } from '../../plugins/suppress-entry-chunks-webpack-plugin';

import { AngularBuildContext, AppProjectConfigInternal, InternalError, PreDefinedEnvironment } from '../../models';
import { outputHashFormat } from '../../helpers/output-hash-format';
import { parseDllEntries } from '../../helpers/parse-dll-entry';

const postcssImports = require('postcss-import');
const postcssUrl = require('postcss-url');

/**
 * Enumerate loaders and their dependencies from this file to let the dependency validator
 * know they are used.
 * require('node-sass')
 * require('postcss-loader')
 * require('raw-loader')
 * require('sass-loader')
 * require('style-loader')
 */

interface PostcssUrlAsset {
    url: string;
    hash: string;
    absolutePath: string;
}

export function getAppStylesWebpackConfigPartial(angularBuildContext: AngularBuildContext,
    env?: PreDefinedEnvironment): webpack.Configuration {
    const environment = env ? env as PreDefinedEnvironment : AngularBuildContext.environment;
    const projectRoot = AngularBuildContext.projectRoot;
    const isDll = environment.dll;

    const appConfig = angularBuildContext.projectConfig as AppProjectConfigInternal;

    const srcDir = path.resolve(projectRoot, appConfig.srcDir || '');

    const extractCss = appConfig.extractCss;

    const extractedAssetsHashFormat = (!appConfig.platformTarget || appConfig.platformTarget === 'web') &&
        appConfig.extractedAssetsHash !== false
        ? outputHashFormat.extractedAssets
        : '';
    const extractedCssHashFormat = (!appConfig.platformTarget || appConfig.platformTarget === 'web') &&
        appConfig.bundlesHash
        ? outputHashFormat.extractedCss
        : '';

    const includePaths: string[] = [];
    if (appConfig.stylePreprocessorOptions &&
        appConfig.stylePreprocessorOptions.includePaths &&
        appConfig.stylePreprocessorOptions.includePaths.length > 0
    ) {
        appConfig.stylePreprocessorOptions.includePaths.forEach((includePath: string) => {
            const includePathAbs = path.resolve(srcDir, includePath);
            includePaths.push(includePathAbs);
        });
    }

    const cssSourceMap = extractCss && appConfig.sourceMap;
    const maximumInlineSize = 10;
    const deployUrl = appConfig.publicPath || '';
    const baseHref = appConfig.baseHref || '';

    const postcssPluginCreator = (loader: webpack.loader.LoaderContext) => [
        postcssImports({
            resolve: (url: string, context: string) => {
                return new Promise<string>((resolve, reject) => {
                    let hadTilde = false;
                    if (url && url.startsWith('~')) {
                        url = url.substr(1);
                        hadTilde = true;
                    }
                    loader.resolve(context, (hadTilde ? '' : './') + url, (err: Error, result: string) => {
                        if (err) {
                            if (hadTilde) {
                                reject(err);
                                return;
                            }
                            loader.resolve(context, url, (err2: Error, result2: string) => {
                                if (err2) {
                                    reject(err2);
                                } else {
                                    resolve(result2);
                                }
                            });
                        } else {
                            resolve(result);
                        }
                    });
                });
            },
            load: (filename: string) => {
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
            }
        }),
        postcssUrl({
            filter: ({ url }: PostcssUrlAsset) => url.startsWith('~'),
            url: ({ url }: PostcssUrlAsset) => {
                const fullPath =
                    path.join(AngularBuildContext.nodeModulesPath || path.resolve(projectRoot, 'node_modules'),
                        url.substr(1));
                return path.relative(loader.context, fullPath).replace(/\\/g, '/');
            }
        }),
        postcssUrl([
            {
                // Only convert root relative URLs, which CSS-Loader won't process into require().
                filter: ({ url }: PostcssUrlAsset) => url.startsWith('/') && !url.startsWith('//'),
                url: ({ url }: PostcssUrlAsset) => {
                    if (deployUrl.match(/:\/\//) || deployUrl.startsWith('/')) {
                        // If deployUrl is absolute or root relative, ignore baseHref & use deployUrl as is.
                        return `${deployUrl.replace(/\/$/, '')}${url}`;
                    } else if (baseHref.match(/:\/\//)) {
                        // If baseHref contains a scheme, include it as is.
                        return baseHref.replace(/\/$/, '') +
                            `/${deployUrl}/${url}`.replace(/\/\/+/g, '/');
                    } else {
                        // Join together base-href, deploy-url and the original URL.
                        // Also dedupe multiple slashes into single ones.
                        return `/${baseHref}/${deployUrl}/${url}`.replace(/\/\/+/g, '/');
                    }
                }
            },
            {
                // TODO: inline .cur if not supporting IE (use browserslist to check)
                filter: (asset: PostcssUrlAsset) => {
                    return maximumInlineSize > 0 && !asset.hash && !asset.absolutePath.endsWith('.cur');
                },
                url: 'inline',
                // NOTE: maxSize is in KB
                maxSize: maximumInlineSize,
                fallback: 'rebase',
            },
            { url: 'rebase' }
        ]),
        PostcssCliResources({
            deployUrl: loader.loaders[loader.loaderIndex].options.ident === 'extracted' ? '' : deployUrl,
            loader,
            filename: `[name]${extractedAssetsHashFormat}.[ext]`,
        }),
        autoprefixer({ grid: true })
    ];

    const baseRules: webpack.NewUseRule[] = [
        { test: /\.css$/, use: [] },
        {
            test: /\.scss$|\.sass$/,
            use: [
                {
                    loader: 'sass-loader',
                    options: {
                        // bootstrap-sass requires a minimum precision of 8
                        precision: 8,
                        includePaths,
                        // TODO: to review
                        sourceMap: cssSourceMap,
                    }
                }
            ]
        }
    ];

    const commonLoaders: webpack.Loader[] = [
        { loader: 'raw-loader' }
        // Or
        // {
        //    loader: cssLoader,
        //    options: {
        //        sourceMap: cssSourceMap,
        //        import: false
        //        //importLoaders: 1
        //    }
        // }
    ];

    const entryPoints: { [key: string]: string[] } = {};
    const rules: webpack.Rule[] = [];
    const plugins: webpack.Plugin[] = [];
    const globalStylePaths: string[] = [];

    let shouldSuppressChunk = false;
    if (isDll) {
        if (appConfig.dll) {
            const dllResult = appConfig._dllParsedResult
                ? appConfig._dllParsedResult
                : parseDllEntries(srcDir, appConfig.dll);
            if (!appConfig._dllParsedResult) {
                appConfig._dllParsedResult = dllResult;
            }
            dllResult.styleEntries.forEach(styleEntry => {
                globalStylePaths.push(styleEntry);
            });

            shouldSuppressChunk = !dllResult.scriptEntries.length && !dllResult.tsEntries.length;
        }
    } else {
        if (appConfig.styles && appConfig.styles.length > 0) {
            if (!appConfig._styleParsedEntries) {
                throw new InternalError("The 'appConfig._styleParsedEntries' is not set.");
            }
            appConfig._styleParsedEntries.forEach(style => {
                globalStylePaths.push(...style.paths);

                entryPoints[style.entry]
                    ? entryPoints[style.entry].push(...style.paths)
                    : entryPoints[style.entry] = style.paths;
            });

            shouldSuppressChunk = true;
        }
    }

    // rules for global styles
    if (globalStylePaths.length > 0) {
        rules.push(...baseRules.map(({ test, use }) => {
            const extractTextPluginOptions = {
                use: [
                    ...commonLoaders,
                    {
                        loader: 'postcss-loader',
                        options: {
                            ident: extractCss ? 'extracted' : 'embedded',
                            plugins: postcssPluginCreator,
                            sourceMap: cssSourceMap
                        }
                    },
                    ...(use as webpack.Loader[])
                ],
                // publicPath needed as a workaround https://github.com/angular/angular-cli/issues/4035
                publicPath: ''
            };

            return {
                include: globalStylePaths,
                test,
                use: extractCss
                    ? ExtractTextPlugin.extract(extractTextPluginOptions)
                    : appConfig.platformTarget === 'node'
                        ? [
                            ...extractTextPluginOptions.use
                        ]
                        : [
                            'style-loader',
                            ...extractTextPluginOptions.use
                        ]
            };
        }));

        if (extractCss) {
            // extract global css from js files into own css file
            plugins.push(
                new ExtractTextPlugin({
                    filename: `[name]${extractedCssHashFormat}.css`
                }));

            if (shouldSuppressChunk) {
                const vendorChunkName = appConfig.vendorChunkName || 'vendor';
                const chunks = isDll ? [vendorChunkName] : Object.keys(entryPoints);
                // suppress empty .js files in css only entry points
                plugins.push(new SuppressEntryChunksWebpackPlugin({
                    chunks: chunks,
                    supressPattern: /\.js(\.map)?$/,
                    loggerOptions: {
                        logLevel: AngularBuildContext.angularBuildConfig.logLevel
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
            ...commonLoaders,
            {
                loader: 'postcss-loader',
                options: {
                    ident: 'embedded',
                    plugins: postcssPluginCreator,
                    sourceMap: cssSourceMap
                }
            },
            ...(use as webpack.Loader[])
        ]
    }));

    rules.push(...componentStyleRules);

    return {
        entry: Object.keys(entryPoints).length ? entryPoints : undefined,
        module: { rules: rules },
        plugins: plugins
    };
}
