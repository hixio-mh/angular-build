// Ref: https://github.com/angular/angular-cli
import * as path from 'path';
import * as webpack from 'webpack';

import * as autoprefixer from 'autoprefixer';
import * as ExtractTextPlugin from 'extract-text-webpack-plugin';

// ReSharper disable CommonJsExternalModule
const cssnano = require('cssnano');
const postcssUrl = require('postcss-url');
// ReSharper restore CommonJsExternalModule

import { SuppressEntryChunksWebpackPlugin } from '../plugins/suppress-entry-chunks-webpack-plugin';

import { parseStyleEntry, StyleParsedEntry } from '../helpers';
import { AppProjectConfig, BuildOptions, ProjectConfig } from '../models';

import { WebpackConfigOptions } from './webpack-config-options';

/**
 * Enumerate loaders and their dependencies from this file to let the dependency validator
 * know they are used.
 * require('css-loader')
 * require('exports-loader')
 * require('less')
 * require('less-loader')
 * require('node-sass')
 * require('raw-loader')
 * require('postcss-loader')
 * require('sass-loader')
 * require('style-loader')
 */

export function getStylesWebpackConfigPartial(webpackConfigOptions: WebpackConfigOptions): webpack.Configuration {
    const projectRoot = webpackConfigOptions.projectRoot;
    const buildOptions = webpackConfigOptions.buildOptions;
    const environment = buildOptions.environment || {};
    const projectConfig = webpackConfigOptions.projectConfig as ProjectConfig;

    const srcDir = path.resolve(projectRoot, projectConfig.srcDir || '');

    const entryPoints: { [key: string]: string[] } = {};
    const plugins: any[] = [];

    // TODO: to review for test
    let extractCss = (projectConfig as AppProjectConfig).extractCss;
    if (!extractCss && environment.dll && projectConfig.projectType === 'app' &&
        (!projectConfig.platformTarget || projectConfig.platformTarget === 'web')) {
        extractCss = true;
    }

    // style-loader does not support sourcemaps without absolute publicPath, so it's
    // better to disable them when not extracting css
    // https://github.com/webpack-contrib/style-loader#recommended-configuration
    const cssSourceMap = extractCss && projectConfig.sourceMap;

    const minimizeCss = buildOptions.production;

    // Convert absolute resource URLs to account for base-href and deploy-url.
    const publicPath = (projectConfig as AppProjectConfig).publicPath || (buildOptions as any).publicPath || '';
    const baseHref = (projectConfig as AppProjectConfig).baseHref || (buildOptions as any).baseHref || '';

    const includePaths: string[] = [];
    if (projectConfig.stylePreprocessorOptions &&
        projectConfig.stylePreprocessorOptions.includePaths &&
        projectConfig.stylePreprocessorOptions.includePaths.length > 0
    ) {
        projectConfig.stylePreprocessorOptions.includePaths.forEach((includePath: string) => {
            const includePathAbs = path.resolve(srcDir, includePath);
            includePaths.push(includePathAbs);
        });
    }

    const cliIsLocal = (buildOptions as any).cliIsLocal !== false;

    const cssLoader = cliIsLocal ? 'css-loader' : require.resolve('css-loader');
    const sassLoader = cliIsLocal ? 'sass-loader' : require.resolve('sass-loader');
    const lessLoader = cliIsLocal ? 'less-loader' : require.resolve('less-loader');
    const postcssLoader = cliIsLocal ? 'postcss-loader' : require.resolve('postcss-loader');
    const exportsLoader = cliIsLocal ? 'exports-loader' : require.resolve('exports-loader');
    const styleLoader = cliIsLocal ? 'style-loader' : require.resolve('style-loader');

    const baseRules: any[] = [
        { test: /\.css$/, use: [] },
        {
            test: /\.scss$|\.sass$/,
            use: [
                {
                    loader: sassLoader,
                    options: {
                        // sourceMap: cssSourceMap,
                        // bootstrap-sass requires a minimum precision of 8
                        precision: 8,
                        includePaths
                    }
                }
            ]
        },
        {
            test: /\.less$/,
            use: [
                {
                    loader: lessLoader,
                    options: {
                        // sourceMap: cssSourceMap
                    }
                }
            ]
        }
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
                url: (asset: any) => {
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
            autoprefixer()
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
                // ident: 'postcss',
                plugins: postcssPluginFactory
                // If set true, 'Previous source map found, but options.sourceMap isn't set.'
                // will disapper, but will add absolute sourceMap
                // sourceMap: cssSourceMap
            }
        }
    ];

    // process global styles
    let globalStyleParsedEntries = getGlobalStyleEntries(projectRoot, projectConfig, buildOptions);
    const globalStylePaths = globalStyleParsedEntries.map(style => style.path);

    // rules
    const rules: any[] = [];

    // inline styles
    const componentStyleRules = baseRules.map(({ test, use }) => ({
        exclude: globalStylePaths,
        test,
        use: [
            exportsLoader + '?module.exports.toString()'
        ].concat(commonLoaders).concat(use)
    }));
    rules.push(...componentStyleRules);

    // global styles
    if (globalStyleParsedEntries.length > 0) {
        rules.push(...baseRules.map(({ test, use }) => {
            const extractTextPluginOptions = {
                use: [
                    ...commonLoaders,
                    ...(use as any[])
                ],
                // publicPath needed as a workaround https://github.com/angular/angular-cli/issues/4035
                publicPath: ''
            };
            const ret: any = {
                include: globalStylePaths,
                test,
                use: extractCss
                    ? ExtractTextPlugin.extract(extractTextPluginOptions)
                    : (environment.dll ||
                        projectConfig.platformTarget === 'node' ||
                        projectConfig.platformTarget === 'async-node')
                        ? [
                            // TODO: to review to-string-loader?
                            exportsLoader + '?module.exports.toString()',
                            ...extractTextPluginOptions.use
                        ]
                        : [
                            styleLoader,
                            ...extractTextPluginOptions.use
                        ]
            };

            return ret;
        }));

    }

    // extract css
    // TODO: to review for environment.test
    if (globalStyleParsedEntries.length > 0 &&
        projectConfig.projectType === 'app' &&
        (!projectConfig.platformTarget || projectConfig.platformTarget === 'web') &&
        (!environment.test || (environment.test && extractCss)) &&
        (!environment.dll || (environment.dll && extractCss))) {
        // determine hashing format
        const hashFormat = (projectConfig as AppProjectConfig).appendOutputHash ? `.[contenthash:${20}]` : '';

        // add style entry points
        globalStyleParsedEntries.forEach(style =>
            entryPoints[style.entry]
                ? entryPoints[style.entry].push(style.path)
                : entryPoints[style.entry] = [style.path]
        );

        // suppress empty .js files in css only entry points
        if (extractCss) {
            const supressExcludes: string[] = [];
            const vendorChunkName = (projectConfig as AppProjectConfig).vendorChunkName || 'vendor';
            if (environment.dll) {
                supressExcludes.push(vendorChunkName);
            }

            // extract global css from js files into own css file
            plugins.push(
                new ExtractTextPlugin({
                    filename: `[name]${hashFormat}.css`
                }));
            plugins.push(new SuppressEntryChunksWebpackPlugin({
                chunks: Object.keys(entryPoints),
                excludes: supressExcludes,
                supressPattern: /\.js(\.map)?$/,
                assetTagsFilterFunc: (tag: any) => !(tag.tagName === 'script' &&
                    tag.attributes.src &&
                    tag.attributes.src.match(/\.css$/i))

            }));
        }
    }

    return {
        entry: entryPoints,
        module: { rules: rules },
        plugins: plugins
    };
}

export function getGlobalStyleEntries(projectRoot: string, projectConfig: ProjectConfig, buildOptions: BuildOptions): StyleParsedEntry[] {
    const environment = buildOptions.environment || {};

    const srcDir = path.resolve(projectRoot, projectConfig.srcDir || '');
    const nodeModulesPath = path.resolve(projectRoot, 'node_modules');

    const vendorChunkName = (projectConfig as AppProjectConfig).vendorChunkName || 'vendor';
    const defaultStyleEntryName = 'styles';

    const globalStyleParsedEntries: StyleParsedEntry[] = [];

    if (projectConfig.styles && projectConfig.styles.length > 0) {
        const parsedEntries = parseStyleEntry(projectConfig.styles, srcDir, defaultStyleEntryName);
        parsedEntries.forEach(style => {
            if (environment.dll) {
                if (style.path.startsWith(nodeModulesPath)) {
                    if (style.entry === defaultStyleEntryName) {
                        style.entry = vendorChunkName;
                    }
                    globalStyleParsedEntries.push(style);
                }
            } else if ((projectConfig as AppProjectConfig).referenceDll) {
                if (!style.path.startsWith(nodeModulesPath)) {
                    globalStyleParsedEntries.push(style);
                }
            } else {
                globalStyleParsedEntries.push(style);
            }
        });
    }

    return globalStyleParsedEntries;
}
