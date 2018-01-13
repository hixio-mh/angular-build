// Ref: https://github.com/angular/angular-cli
import * as path from 'path';
import * as webpack from 'webpack';

import * as autoprefixer from 'autoprefixer';
import * as ExtractTextPlugin from 'extract-text-webpack-plugin';

import { CleanCssWebpackPlugin } from '../../plugins/cleancss-webpack-plugin';
import { SuppressEntryChunksWebpackPlugin } from '../../plugins/suppress-entry-chunks-webpack-plugin';

import { AppBuildContext, AppProjectConfigInternal } from '../../models';
import { parseDllEntries, parseGlobalEntries } from '../../helpers';

const postcssImports = require('postcss-import');
const postcssUrl = require('postcss-url');

/**
 * Enumerate loaders and their dependencies from this file to let the dependency validator
 * know they are used.
 * require('css-loader')
 * require('exports-loader')
 * require('node-sass')
 * require('postcss-loader')
 * require('sass-loader')
 * require('style-loader')
 */

interface PostcssUrlAsset {
    url: string;
    hash: string;
    absolutePath: string;
}

export function getAppStylesWebpackConfigPartial(angularBuildContext: AppBuildContext): webpack.Configuration {
    const projectRoot = angularBuildContext.projectRoot;
    const appConfig = angularBuildContext.projectConfig as AppProjectConfigInternal;
    const environment = angularBuildContext.environment;
    const cliIsGlobal = angularBuildContext.cliIsGlobal;
    const isDll = environment.dll;

    const srcDir = path.resolve(projectRoot, appConfig.srcDir || '');

    let extractCss = appConfig.extractCss;
    const hashFormat = appConfig.appendOutputHash ? `.[contenthash:${20}]` : '';

    // style-loader does not support sourcemaps without absolute publicPath, so it's
    // better to disable them when not extracting css
    // https://github.com/webpack-contrib/style-loader#recommended-configuration
    const cssSourceMap = extractCss && appConfig.sourceMap;

    const minimizeCss = environment.prod;

    // Convert absolute resource URLs to account for base-href and deploy-url.
    const publicPath = appConfig.publicPath || '';
    const baseHref = appConfig.baseHref || '';

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

    const cssLoader = cliIsGlobal ? require.resolve('css-loader') : 'css-loader';
    const sassLoader = cliIsGlobal ? require.resolve('sass-loader') : 'sass-loader';
    const postcssLoader = cliIsGlobal ? require.resolve('postcss-loader') : 'postcss-loader';
    const exportsLoader = cliIsGlobal ? require.resolve('exports-loader') : 'exports-loader';
    const styleLoader = cliIsGlobal ? require.resolve('style-loader') : 'style-loader';

    // rules
    const rules: webpack.Rule[] = [];
    
    // ReSharper disable once Lambda
    const postcssPluginFactory = function (loader: webpack.loader.LoaderContext): any[] {        
        return [
            postcssImports({
                resolve: (url: string, context: string) => {
                    return new Promise<string>((resolve, reject) => {
                        if (url && url.startsWith('~')) {
                            url = url.substr(1);
                        }
                        loader.resolve(context, url, (err: Error, result: string) => {
                            if (err) {
                                reject(err);
                                return;
                            }

                            resolve(result);
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
                    const fullPath = path.join(projectRoot, 'node_modules', url.substr(1));
                    return path.relative(loader.context, fullPath).replace(/\\/g, '/');
                }
            }),

            postcssUrl([
                {
                    // Only convert root relative URLs, which CSS-Loader won't process into require().
                    filter: ({ url }: PostcssUrlAsset) => url.startsWith('/') && !url.startsWith('//'),
                    url: ({ url }: PostcssUrlAsset) => {
                        if (publicPath.match(/:\/\//) || publicPath.startsWith('/')) {
                            // If deployUrl is absolute or root relative, ignore baseHref & use deployUrl as is.
                            return `${publicPath.replace(/\/$/, '')}${url}`;
                        } else if (baseHref.match(/:\/\//)) {
                            // If baseHref contains a scheme, include it as is.
                            return baseHref.replace(/\/$/, '') +
                                `/${publicPath}/${url}`.replace(/\/\/+/g, '/');
                        } else {
                            // Join together base-href, deploy-url and the original URL.
                            // Also dedupe multiple slashes into single ones.
                            return `/${baseHref}/${publicPath}/${url}`.replace(/\/\/+/g, '/');
                        }
                    }
                },
                {
                    // TODO: inline .cur if not supporting IE (use browserslist to check)
                    filter: (asset: PostcssUrlAsset) => !asset.hash && !asset.absolutePath.endsWith('.cur'),
                    url: 'inline',
                    // NOTE: maxSize is in KB
                    maxSize: 10,
                    fallback: 'rebase',
                }
            ]),            
            autoprefixer()            
        ];
    };

    const baseRules: any[] = [
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
                        // TODO: not working
                        sourceMap: cssSourceMap,
                    }
                }
            ]
        }
        // {
        //    test: /\.less$/,
        //    use: [
        //        {
        //            loader: lessLoader,
        //            options: {
        //                paths: includePaths
        //                // TODO: not working
        //                // sourceMap: cssSourceMap
        //            }
        //        }
        //    ]
        // }
    ];

    const commonLoaders: any[] = [
        {
            loader: cssLoader,
            options: {
                sourceMap: cssSourceMap,
                import: false
                //importLoaders: 1
            }
        },
        {
            loader: postcssLoader,
            options: {
                // non-function property is required to workaround a webpack option handling abug
                ident: 'postcss',
                plugins: postcssPluginFactory,
                // If set true, 'Previous source map found, but options.sourceMap isn't set.'
                // will disapper, but will add absolute sourceMap
                // TODO: to review
                sourceMap: cssSourceMap
            }
        }
    ];

    const entryPoints: { [key: string]: string[] } = {};
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
            const styleParsedEntries = appConfig._styleParsedEntries
                ? appConfig._styleParsedEntries
                : parseGlobalEntries(appConfig.styles, srcDir, 'styles');
            if (!appConfig._styleParsedEntries) {
                appConfig._styleParsedEntries = styleParsedEntries;
            }

            styleParsedEntries.forEach(style => {
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
                    ...(use as any[])
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
                            exportsLoader + '?module.exports.toString()',
                            ...extractTextPluginOptions.use
                        ]
                        : [
                            styleLoader,
                            ...extractTextPluginOptions.use
                        ]
            };
        }));

        if (extractCss) {
            // extract global css from js files into own css file
            plugins.push(
                new ExtractTextPlugin({
                    filename: `[name]${hashFormat}.css`
                }));

            if (shouldSuppressChunk) {
                const vendorChunkName = appConfig.vendorChunkName || 'vendor';
                const chunks = isDll ? [vendorChunkName] : Object.keys(entryPoints);
                // suppress empty .js files in css only entry points
                plugins.push(new SuppressEntryChunksWebpackPlugin({
                    chunks: chunks,
                    supressPattern: /\.js(\.map)?$/,
                    assetTagsFilterFunc: (tag: any) => !(tag.tagName === 'script' &&
                        tag.attributes.src &&
                        tag.attributes.src.match(/\.css$/i))

                }));
            }
        }
    }

    // inline styles
    const componentStyleRules = baseRules.map(({ test, use }) => ({
        exclude: globalStylePaths,
        test,
        use: [
            exportsLoader + '?module.exports.toString()'
        ].concat(commonLoaders).concat(use)
    }));
    rules.push(...componentStyleRules);

    if (minimizeCss) {
        plugins.push(new CleanCssWebpackPlugin({ sourceMap: cssSourceMap }));
    }
    
    return {
        entry: Object.keys(entryPoints).length ? entryPoints : undefined,
        module: { rules: rules },
        plugins: plugins
    };
}
