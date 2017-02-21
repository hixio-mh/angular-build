import * as path from 'path';
import * as webpack from 'webpack';

// ReSharper disable once InconsistentNaming
const LoaderOptionsPlugin = webpack.LoaderOptionsPlugin;

const autoprefixer = require('autoprefixer');
const cssnano = require('cssnano');
//const postcssDiscardComments = require('postcss-discard-comments');
// ReSharper disable once InconsistentNaming
const ExtractTextPlugin = require('extract-text-webpack-plugin');

import { SuppressEntryChunksWebpackPlugin } from '../plugins/suppress-entry-chunks-webpack-plugin';

import { AppConfig, BuildOptions } from '../models';
import { parseGlobalScopedEntry } from './helpers';

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
 */

// Ref: https://github.com/angular/angular-cli
export function getStylesConfigPartial(projectRoot: string, appConfig: AppConfig, buildOptions: BuildOptions):
    { entry: { [key: string]: string[] }, module: { rules: any[] }, plugins: any[] } {

    const appRoot = path.resolve(projectRoot, appConfig.root);
    const entryPoints: { [key: string]: string[] } = {};
    const globalStylePaths: string[] = [];
    const stylePlugins: any[] = [];

    // style-loader does not support sourcemaps without absolute publicPath, so it's
    // better to disable them when not extracting css
    // https://github.com/webpack-contrib/style-loader#recommended-configuration
    const sourceMap = appConfig.extractCss !== false && appConfig.sourceMap;

    // minify/optimize css in production
    // autoprefixer is always run separately so disable here
    const extraPostCssPlugins = buildOptions.production
        ? [cssnano({ safe: true, autoprefixer: false })]
        : [];

    // determine hashing format
    const hashFormat = appConfig.appendOutputHash ? `.[contenthash:${20}]` : '';

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
    const baseRules = [
        { test: /\.css$/, use: [] as any[] },
        { test: /\.scss$|\.sass$/, use: ['sass-loader'] },
        { test: /\.less$/, use: ['less-loader'] },
        // stylus-loader doesn't support webpack.LoaderOptionsPlugin properly,
        // so we need to add options in its query
        {
            test: /\.styl$/,
            use: [
                `stylus-loader?${JSON.stringify({
                    sourceMap: sourceMap,
                    paths: includePaths
                })}`
            ]
        }
    ];

    //const commonLoaders = ['postcss-loader'];
    const commonLoaders = [
        // css-loader doesn't support webpack.LoaderOptionsPlugin properly,
        // so we need to add options in its query
        `css-loader?${JSON.stringify({ sourceMap: sourceMap, importLoaders: 1 })}`,
        'postcss-loader'
    ];


    // load component css as raw strings
    //const styleRules: any = baseRules.map(({ test, use }) => ({
    //    exclude: globalStylePaths,
    //    test,
    //    use: ['raw-loader'].concat(commonLoaders).concat(use)
    //}));
    const styleRules: any = baseRules.map(({ test, use }) => ({
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

    // supress empty .js files in css only entry points
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
            }),
            // TODO: when merge with webpackMerge and two LoaderOptionsPlugin(s), options object is override with last LoaderOptionsPlugin
            new LoaderOptionsPlugin({
                sourceMap: sourceMap,
                options: {
                    postcss: [autoprefixer()].concat(extraPostCssPlugins),
                    // css-loader, stylus-loader don't support LoaderOptionsPlugin properly
                    // options are in query instead
                    sassLoader: { sourceMap: sourceMap, includePaths },
                    // less-loader doesn't support paths
                    lessLoader: { sourceMap: sourceMap },
                    // context needed as a workaround https://github.com/jtangelder/sass-loader/issues/285
                    context: projectRoot
                }
            })
        ].concat(stylePlugins)
    };
}