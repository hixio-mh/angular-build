// Ref: https://github.com/angular/angular-cli
import * as path from 'path';
import * as webpack from 'webpack';

import * as autoprefixer from 'autoprefixer';
import * as ExtractTextPlugin from 'extract-text-webpack-plugin';

import { SuppressEntryChunksWebpackPlugin } from '../../plugins/suppress-entry-chunks-webpack-plugin';

import { AppBuildContext, AppProjectConfigInternal } from '../../models';
import { parseDllEntries, parseGlobalEntries } from '../../helpers';

const cssnano = require('cssnano');
const postcssUrl = require('postcss-url');
const customProperties = require('postcss-custom-properties');

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
                        includePaths
                        // TODO: not working
                        // sourceMap: cssSourceMap,
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

    // ReSharper disable once Lambda
    const postcssPluginFactory = function (): any[] {
        // safe settings based on: https://github.com/ben-eb/cssnano/issues/358#issuecomment-283696193
        const importantCommentRegex = /@preserve|@license|[@#]\s*source(?:Mapping)?URL|^!/i;
        const minimizeOptions = {
            autoprefixer: false, // full pass with autoprefixer is run separately
            safe: true,
            mergeLonghand: false, // version 3+ should be safe; cssnano currently uses 2.x
            discardComments: { remove: (comment: string) => !importantCommentRegex.test(comment) }
        };

        return [
            // require('postcss-import')({ root: loader.resourcePath }),
            // require('postcss-cssnext')(),
            //  require('stylelint')(),
            postcssUrl({
                url: (asset: string | { url: string; }) => {
                    const u = typeof asset === 'string' ? asset : asset.url;
                    if (!u || typeof u !== 'string') {
                        return u;
                    }

                    // Only convert root relative URLs, which CSS-Loader won't process into require().
                    if (!u.startsWith('/') || u.startsWith('//')) {
                        return u;
                    }

                    if (publicPath.match(/:\/\//)) {
                        // If deployUrl contains a scheme, ignore baseHref use deployUrl as is.
                        return `${publicPath.replace(/\/$/, '')}${u}`;
                    } else if (baseHref.match(/:\/\//)) {
                        // If baseHref contains a scheme, include it as is.
                        return baseHref.replace(/\/$/, '') +
                            `/${publicPath}/${u}`.replace(/\/\/+/g, '/');
                    } else {
                        // Join together base-href, deploy-url and the original URL.
                        // Also dedupe multiple slashes into single ones.
                        return `/${baseHref}/${publicPath}/${u}`.replace(/\/\/+/g, '/');
                    }
                }
            }),
            autoprefixer(),
            customProperties({ preserve: true })
        ].concat(
            minimizeCss ? [cssnano(minimizeOptions)] : []
            );
    };

    const commonLoaders: any[] = [
        {
            loader: cssLoader,
            options: {
                sourceMap: cssSourceMap,
                importLoaders: 1
            }
        },
        {
            loader: postcssLoader,
            options: {
                // non-function property is required to workaround a webpack option handling abug
                ident: 'postcss',
                plugins: postcssPluginFactory
                // If set true, 'Previous source map found, but options.sourceMap isn't set.'
                // will disapper, but will add absolute sourceMap
                // sourceMap: cssSourceMap
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

    return {
        entry: Object.keys(entryPoints).length ? entryPoints : undefined,
        module: { rules: rules },
        plugins: plugins
    };
}
