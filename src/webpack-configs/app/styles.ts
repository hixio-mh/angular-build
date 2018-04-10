// Ref: https://github.com/angular/angular-cli
import * as path from 'path';
import * as webpack from 'webpack';
import * as autoprefixer from 'autoprefixer';

import PostcssCliResources from '../../plugins/postcss-cli-resources';
import { RawCssLoader } from '../../plugins/raw-css-loader';
import { SuppressEntryChunksWebpackPlugin } from '../../plugins/suppress-entry-chunks-webpack-plugin';

import { AngularBuildContext, AppProjectConfigInternal } from '../../build-context';
import { InternalError } from '../../error-models';
import { outputHashFormat, resolveLoaderPath } from '../../helpers';

const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const postcssImports = require('postcss-import');
const postcssUrl = require('postcss-url');

interface PostcssUrlAsset {
    url: string;
    hash: string;
    absolutePath: string;
}

export function
    getAppStylesWebpackConfigPartial<TConfig extends AppProjectConfigInternal>(angularBuildContext:
        AngularBuildContext<TConfig>): webpack.Configuration {
    const logLevel = angularBuildContext.buildOptions.logLevel;

    const appConfig = angularBuildContext.projectConfig as AppProjectConfigInternal;

    const projectRoot = path.resolve(AngularBuildContext.workspaceRoot, appConfig.root || '');
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
    const maximumInlineSize = 10;
    const deployUrl = appConfig.publicPath || '';
    const baseHref = appConfig.baseHref || '';

    const rawLoader = resolveLoaderPath('raw-loader');
    const postcssLoader = resolveLoaderPath('postcss-loader');
    const sassLoader = resolveLoaderPath('sass-loader');
    const styleLoader = resolveLoaderPath('style-loader');

    const postcssPluginCreator = (loader: webpack.loader.LoaderContext) => [
        postcssImports({
            resolve: (url: string, context: string) => {
                return new Promise<string>((resolve, reject) => {
                    let hadTilde = false;
                    if (url && url.startsWith('~')) {
                        url = url.substr(1);
                        hadTilde = true;
                    }
                    loader.resolve(context,
                        (hadTilde ? '' : './') + url,
                        (err: Error, result: string) => {
                            if (err) {
                                if (hadTilde) {
                                    reject(err);
                                    return;
                                }
                                loader.resolve(context,
                                    url,
                                    (err2: Error, result2: string) => {
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
                    loader.fs.readFile(filename,
                        (err: Error, data: Buffer) => {
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
                // Note: This will only find the first node_modules folder.
                const nodeModules = AngularBuildContext.nodeModulesPath;
                if (!nodeModules) {
                    throw new Error('Cannot locate node_modules directory.');
                }
                const fullPath = path.join(nodeModules, url.substr(1));
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
            filename: `[name]${extractedAssetsHashFormat}.[ext]`
        }),
        autoprefixer({ grid: true })
    ];

    const baseRules: webpack.NewUseRule[] = [
        { test: /\.css$/, use: [] },
        {
            test: /\.scss$|\.sass$/,
            use: [
                {
                    loader: sassLoader,
                    options: {
                        // bootstrap-sass requires a minimum precision of 8
                        precision: 8,
                        includePaths,
                        sourceMap: cssSourceMap
                    }
                }
            ]
        }
    ];

    const entryPoints: { [key: string]: string[] } = {};
    const rules: webpack.Rule[] = [];
    const plugins: webpack.Plugin[] = [];
    const globalStylePaths: string[] = [];

    let shouldSuppressChunk = false;
    if (isDll) {
        if (appConfig.dlls) {
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
                    {
                        loader: RawCssLoader
                    },
                    {
                        loader: postcssLoader,
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
                use: [
                    // TODO: to review for appConfig.platformTarget === 'node'
                    extractCss
                        ? MiniCssExtractPlugin.loader
                        : styleLoader,
                    ...extractTextPluginOptions.use
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
                const chunks = isDll ? [vendorChunkName] : Object.keys(entryPoints);
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
