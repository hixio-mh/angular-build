// Ref/fork from: https://github.com/angular/angular-cli
import * as path from 'path';
//import * as webpack from 'webpack';

// ReSharper disable once InconsistentNaming
const autoprefixer = require('autoprefixer');
const cssnano = require('cssnano');
const postcssUrl = require('postcss-url');
//const postcssDiscardComments = require('postcss-discard-comments');
// ReSharper disable once InconsistentNaming
const ExtractTextPlugin = require('extract-text-webpack-plugin');

import { SuppressEntryChunksWebpackPlugin } from '../plugins/suppress-entry-chunks-webpack-plugin';

import { AppConfig, BuildOptions } from '../models';
import { parseGlobalScopedEntry } from '../helpers';

/**
 * Enumerate loaders and their dependencies from this file to let the dependency validator
 * know they are used.
 *
 * require('exports-loader')
 * require('style-loader')
 * require('postcss-loader')
 * require('css-loader')
 * require('stylus')
 * require('stylus-loader')
 * require('less')
 * require('less-loader')
 * require('node-sass')
 * require('sass-loader')
 * require('raw-loader')
 * require('to-string-loader')
 */

// Ref: https://github.com/angular/angular-cli
export function getStylesConfigPartial(projectRoot: string, appConfig: AppConfig, buildOptions: BuildOptions): { entry: { [key: string]: string[] }, module: { rules: any[] }, plugins: any[] } {

    if (buildOptions.dll || buildOptions.test) {
        const testDllStyleRules: any[] = [
            {
                test: /\.css(\?|$)/,
                use: ['to-string-loader', 'css-loader'],
                exclude: [path.resolve(projectRoot, appConfig.root, 'index.html')]
            },
            {
                test: /\.scss$|\.sass$/,
                use: ['raw-loader', 'sass-loader'],
                exclude: [path.resolve(projectRoot, appConfig.root, 'index.html')]
            },
            {
                test: /\.less/,
                use: ['raw-loader', 'less-loader'],
                exclude: [path.resolve(projectRoot, appConfig.root, 'index.html')]
            },
            {
                test: /\.styl$/,
                use: ['raw-loader', 'stylus-loader'],
                exclude: [path.resolve(projectRoot, appConfig.root, 'index.html')]
            }
        ];
        const testDllWebpackConfig : any = {
            module: { rules: testDllStyleRules }
        };
        return testDllWebpackConfig;
    }

    const appRoot = path.resolve(projectRoot, appConfig.root);
    const entryPoints: { [key: string]: string[] } = {};
    const globalStylePaths: string[] = [];
    const stylePlugins: any[] = [];

    // style-loader does not support sourcemaps without absolute publicPath, so it's
    // better to disable them when not extracting css
    // https://github.com/webpack-contrib/style-loader#recommended-configuration
    const cssSourceMap = appConfig.extractCss !== false && appConfig.sourceMap;

    const minimizeCss = buildOptions.production;
    const publicPath = appConfig.publicPath;
    const baseHref = (<any>appConfig).baseHref || '';
    // determine hashing format
    const hashFormat = appConfig.appendOutputHash ? `.[contenthash:${20}]` : '';

// ReSharper disable once Lambda
    const postcssPluginCreator = function () {
        return [
            autoprefixer(),
            postcssUrl({
// ReSharper disable once InconsistentNaming
                url: (URL: string) => {
                    // Only convert root relative URLs, which CSS-Loader won't process into require().
                    if (!URL.startsWith('/') || URL.startsWith('//')) {
                        return URL;
                    }

                    if (publicPath.match(/:\/\//)) {
                        // If deployUrl contains a scheme, ignore baseHref use deployUrl as is.
                        return `${publicPath.replace(/\/$/, '')}${URL}`;
                    } else if (baseHref.match(/:\/\//)) {
                        // If baseHref contains a scheme, include it as is.
                        return baseHref.replace(/\/$/, '') +
                            `/${publicPath}/${URL}`.replace(/\/\/+/g, '/');
                    } else {
                        // Join together base-href, deploy-url and the original URL.
                        // Also dedupe multiple slashes into single ones.
                        return `/${baseHref}/${publicPath}/${URL}`.replace(/\/\/+/g, '/');
                    }
                }
            })
        ].concat(
            minimizeCss ? [cssnano({ safe: true, autoprefixer: false })] : []
        );
    };

    // use includePaths from appConfig
    const includePaths: string[] = [];

    if (appConfig.stylePreprocessorOptions &&
        appConfig.stylePreprocessorOptions.includePaths &&
        appConfig.stylePreprocessorOptions.includePaths.length > 0
    ) {
        appConfig.stylePreprocessorOptions.includePaths.forEach((includePath: string) =>
            includePaths.push(path.resolve(appRoot, includePath)));
    }

    // process global styles
    if (appConfig.styles.length > 0) {
        const globalStyles = parseGlobalScopedEntry(appConfig.styles, appRoot, 'styles');
        // add style entry points
        globalStyles.forEach(style =>
            entryPoints[style.entry]
                ? entryPoints[style.entry].push(style.path)
                : entryPoints[style.entry] = [style.path]
        );
        // add global css paths
        globalStylePaths.push(...globalStyles.map((style) => style.path));
    }

    // set base rules to derive final rules from
    const baseRules : any[] = [
        { test: /\.css$/, use: []},
        {
            test: /\.scss$|\.sass$/, use: [{
                loader: 'sass-loader',
                options: {
                    sourceMap: cssSourceMap,
                    includePaths
                }
            }]
        },
        {
            test: /\.less$/, use: [{
                loader: 'less-loader',
                options: {
                    sourceMap: cssSourceMap
                }
            }]
        },
        {
            test: /\.styl$/, use: [{
                loader: 'stylus-loader',
                options: {
                    sourceMap: cssSourceMap,
                    paths: includePaths
                }
            }]
        }
    ];

    const commonLoaders: any[] = [
        {
            loader: 'css-loader',
            options: {
                sourceMap: cssSourceMap,
                importLoaders: 1
            }
        },
        {
            loader: 'postcss-loader',
            options: {
                // A non-function property is required to workaround a webpack option handling bug
                ident: 'postcss',
                plugins: postcssPluginCreator
            }
        }
    ];
    
    const styleRules: any[] = baseRules.map(({ test, use }) => ({
        exclude: globalStylePaths,
        test,
        use: [
            'exports-loader?module.exports.toString()'
        ].concat(commonLoaders).concat(use)
    }));


    // load global css as css files
    if (globalStylePaths.length > 0) {
        styleRules.push(...baseRules.map(({test, use}) => {
            const extractTextPlugin = {
                use: commonLoaders.concat(use),
                fallback: 'style-loader',
                // publicPath needed as a workaround https://github.com/angular/angular-cli/issues/4035
                publicPath: ''
            };
            const ret: any = {
                include: globalStylePaths,
                test,
                use: ExtractTextPlugin.extract(extractTextPlugin)
            };
            // Save the original options as arguments for eject.
            //ret[pluginArgs] = extractTextPlugin;
            return ret;
        }));
    }

    // Suppress empty .js files in css only entry points
    if (appConfig.extractCss !== false) {
        //extraPlugins.push(new SuppressExtractedTextChunksWebpackPlugin());
        stylePlugins.push(new SuppressEntryChunksWebpackPlugin({
            chunks: Object.keys(entryPoints),
            supressPattern: /\.js(\.map)?$/,
            assetTagsFilterFunc: (tag: any) => !(tag.tagName === 'script' &&
                tag.attributes.src &&
                tag.attributes.src.match(/\.css$/i))

        }));
    }

    return {
        entry: entryPoints,
        module: { rules: styleRules },
        plugins: [
            // extract global css from js files into own css file
            new ExtractTextPlugin({
                filename: `[name]${hashFormat}.css`,
                disable: appConfig.extractCss === false
            })
        ].concat(stylePlugins)
    };
}
