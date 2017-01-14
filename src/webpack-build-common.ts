// see: https://webpack.js.org/configuration/
// Ref: https://github.com/AngularClass/angular2-webpack-starter
// Ref: https://github.com/MarkPieszak/aspnetcore-angular2-universal
// Ref: https://github.com/aspnet/JavaScriptServices/tree/dev/templates/Angular2Spa
// Ref: https://github.com/angular/angular-cli

import * as path from 'path';
import * as fs from 'fs';

// ReSharper disable InconsistentNaming
const CommonsChunkPlugin = require('webpack/lib/optimize/CommonsChunkPlugin');
const DefinePlugin = require('webpack/lib/DefinePlugin');
const DllPlugin = require('webpack/lib/DllPlugin');
const DllReferencePlugin = require('webpack/lib/DllReferencePlugin');
const IgnorePlugin = require('webpack/lib/IgnorePlugin');
const LoaderOptionsPlugin = require('webpack/lib/LoaderOptionsPlugin');
const NamedModulesPlugin = require('webpack/lib/NamedModulesPlugin');
const NormalModuleReplacementPlugin = require('webpack/lib/NormalModuleReplacementPlugin');
const ProgressPlugin = require('webpack/lib/ProgressPlugin');
const ProvidePlugin = require('webpack/lib/ProvidePlugin');
const UglifyJsPlugin = require('webpack/lib/optimize/UglifyJsPlugin');

const autoprefixer = require('autoprefixer');
const postcssDiscardComments = require('postcss-discard-comments');
const ExtractTextPlugin = require('extract-text-webpack-plugin');
const CompressionPlugin = require('compression-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const AssetsPlugin = require('assets-webpack-plugin');
var StatsPlugin = require('stats-webpack-plugin');
//const ScriptExtHtmlWebpackPlugin = require('script-ext-html-webpack-plugin');
const WebpackMd5Hash = require('webpack-md5-hash');
const CopyWebpackPlugin = require('copy-webpack-plugin');
// ReSharper restore InconsistentNaming

// Internal plugins
//import { ResolvePublicPathHtmlWebpackPlugin } from './plugins/resolve-public-path-html-webpack-plugin';
import { IconWebpackPlugin, IconPluginOptions } from './plugins/icon-webpack-plugin';
import { SuppressEntryChunksWebpackPlugin } from './plugins/suppress-entry-chunks-webpack-plugin';
import { CustomizeAssetsHtmlWebpackPlugin } from './plugins/customize-assets-html-webpack-plugin';

//import { GlobCopyWebpackPlugin } from './plugins/glob-copy-webpack-plugin';

import { AppConfig, BuildOptions, DllEntry, HtmlInjectOptions, ReplacementModuleEntry } from './models';
import {
  readJsonSync, parseDllEntryValues, extraEntryParser, makeCssLoaders, packageChunkSort, tryBuildDll, isDevelopmentBuild, isDllBuildFromNpmEvent, isWebpackDevServer
  } from './utils';

const defaultBuildOption : BuildOptions = {
  copyAssetsOnDllBuild: true,
  generateIconssOnDllBuild: true
};

// js, json, html, css(s) and fonts
export function getWebpackCommonConfig(projectRoot: string, appConfig: AppConfig, buildOptions?: BuildOptions) {
  projectRoot = projectRoot || process.cwd();
  buildOptions = Object.assign(defaultBuildOption, buildOptions || {});
  buildOptions.debug = typeof buildOptions.debug === 'undefined' ? isDevelopmentBuild() : buildOptions.debug;
  buildOptions.dll = typeof buildOptions.dll === 'undefined' ? isDllBuildFromNpmEvent() : buildOptions.dll;

  // Validations
  if (typeof appConfig !== 'object') {
    throw new Error(`Invalid 'appConfig'.`);
  }

  if (!appConfig.root) {
    throw new Error(`'appConfig.root' value is required.`);
  }
  if (!appConfig.outDir) {
    throw new Error(`'appConfig.outDir' value is required.`);
  }
  if (!buildOptions.dll && !appConfig.main) {
    throw new Error(`'appConfig.main' value is required.`);
  }
  if (buildOptions.dll && !appConfig.dlls) {
    throw new Error(`'appConfig.dlls' value is required.`);
  }

  if (buildOptions.dll && appConfig.skipOnDllBuild) {
    return null;
  }

  // Variables
  const appRoot = path.resolve(projectRoot, appConfig.root);
  const nodeModulesPath = path.resolve(projectRoot, 'node_modules');

  let entryPoints: { [key: string]: string[] } = {};
  let suppressPlugins: any[] = [];
  let extraRules: any[] = [];
  let lazyChunks: string[] = [];

  const envLong = buildOptions.debug ? 'development' : 'production';
  const envShort = buildOptions.debug ? 'dev' : 'prod';
  const metadata = {
    'ENV': JSON.stringify(envLong),
    'process.env': {
      ENV: JSON.stringify(envLong),
      NODE_ENV: JSON.stringify(process.env.NODE_ENV)
    }
  };

  // Set defaults
  //
  appConfig.scripts = appConfig.scripts || [];
  appConfig.styles = appConfig.styles || [];
  appConfig.dllEntryChunkName = appConfig.dllEntryChunkName || 'vendor';
  if (appConfig.publicPath || appConfig.publicPath === '') {
    appConfig.publicPath = /\/$/.test(appConfig.publicPath) ? appConfig.publicPath : appConfig.publicPath + '/';
  }
  appConfig.target = appConfig.target || 'web';

  let polyfills: string[] = [];
  let dllVendors: string[] = [];
  if (appConfig.dlls &&
  (buildOptions.dll || appConfig.importPolyfillsToMain ||
    (buildOptions.debug && appConfig.referenceDllOnDevelopment) ||
      (!buildOptions.debug && appConfig.referenceDllOnProduction))) {
    (<any[]>appConfig.dlls).map((e: string|DllEntry) => {
      if (typeof e === 'string') {
        return {
          entry: e
        };
      }
      return e || {};
    }).filter((e: DllEntry) =>
        // entry
        e.entry &&
        e.entry.length > 0 &&
        // targets
        (!e.targets || e.targets.length === 0 || e.targets.indexOf(appConfig.target) > -1) &&
        // env
        (!e.env || e.env === envShort || e.env === envLong))
      .forEach((dllEntryObj: DllEntry) => {
        if (dllEntryObj.isPolyfills || (typeof dllEntryObj.entry === 'string' && dllEntryObj.entry.match(/polyfill/i)) || (Array.isArray(dllEntryObj.entry) && dllEntryObj.entry[0].match(/polyfill/i)) ) {
          polyfills.push(...parseDllEntryValues(appRoot, dllEntryObj.entry, envLong));
        } else {
          dllVendors.push(...parseDllEntryValues(appRoot, dllEntryObj.entry, envLong));
        }
      });
  }

  const jsSourceMapExcludes = [nodeModulesPath];

  // Try dlls
  //
  if (((buildOptions.debug && appConfig.referenceDllOnDevelopment) ||
      (!buildOptions.debug && appConfig.referenceDllOnProduction)) &&
    appConfig.tryBuildDll &&
    !buildOptions.dll) {
    const dllManifestFiles: string[] = [
      path.resolve(projectRoot, appConfig.outDir, `${appConfig.dllEntryChunkName}-manifest.json`)
    ];
    tryBuildDll(dllManifestFiles,
      buildOptions.debug,
      projectRoot,
      appConfig.tryBuildDllCommand,
      appConfig.tryBuildDllCommandArgs);
  }

  // Global scripts
  //
  if (appConfig.scripts && appConfig.scripts.length > 0 && !buildOptions.dll) {
    // Process global scripts
    if (appConfig.scripts && appConfig.scripts.length > 0) {
      const globalScripts = extraEntryParser(appConfig.scripts, appRoot, 'scripts');

      // Add entry points and lazy chunks
      globalScripts.forEach(script => {
        if (script.lazy) {
          lazyChunks.push(script.entry);
        }
        entryPoints[script.entry] = (entryPoints[script.entry] || []).concat(script.path);
      });

      // Load global scripts using script-loader
      extraRules.push({
        include: globalScripts.map((script) => script.path),
        test: /\.js$/,
        loader: 'script-loader'
      });
    }
  }

  // Global styles
  //
  if (appConfig.styles && appConfig.styles.length > 0 && !buildOptions.dll) {
    const globalStyles = extraEntryParser(appConfig.styles, appRoot, 'styles');
    let extractedCssEntryPoints: string[] = [];

    // Add entry points and lazy chunks
    globalStyles.forEach(style => {
      if (style.lazy) {
        lazyChunks.push(style.entry);
      }

      if (!entryPoints[style.entry]) {
        // Since this entry point doesn't exist yet, it's going to only have
        // extracted css and we can supress the entry point
        extractedCssEntryPoints.push(style.entry);
        entryPoints[style.entry] = (entryPoints[style.entry] || []).concat(style.path);
      } else {
        // Existing entry point, just push the css in
        entryPoints[style.entry].push(style.path);
      }
    });

    // Create css loaders for component css and for global css
    extraRules.push(...makeCssLoaders(globalStyles.map((style) => style.path)));

    if (extractedCssEntryPoints.length > 0) {
      // Don't emit the .js entry point for extracted styles
      suppressPlugins.push(new SuppressEntryChunksWebpackPlugin({
        chunks: extractedCssEntryPoints,
        supressPattern: /\.js$/i,
        assetTagsFilterFunc: (tag: any) => !(tag.tagName === 'script' && tag.attributes.src && tag.attributes.src.match(/\.css$/i))

      }));
    }
  }

  // Non global styles
  //
  if ((!appConfig.styles || appConfig.styles.length === 0) && !buildOptions.dll) {
    // create css loaders for component css
    extraRules.push(...makeCssLoaders());
  }

  // Build main/dll entry
  //
  if (buildOptions.dll) {
    entryPoints[appConfig.dllEntryChunkName] = polyfills.concat(dllVendors);
  } else {
    const appMain = path.resolve(projectRoot, appConfig.root, appConfig.main);

    if (appConfig.importPolyfillsToMain) {
      entryPoints['main'] = polyfills.concat([appMain]);
    } else {
      entryPoints['main'] = [appMain];
    }
  }

  const commonRules: any = [
    // js source map
    {
      enforce: 'pre',
      test: /\.js$/,
      loader: 'source-map-loader',
      exclude: jsSourceMapExcludes
    },

    // .json files are now supported without the json-loader, webpack >= 2.2
    {
      test: /\.json$/,
      loader: 'json-loader'
    },

    // html
    {
      test: /\.html$/,
      loader: 'raw-loader',
      exclude: [path.resolve(projectRoot, appConfig.root, appConfig.index || 'index.html')]
    },

    // font loaders
    {
      test: /\.(otf|ttf|woff|woff2)(\?v=\d+\.\d+\.\d+)?$/,
      loader: 'url-loader?limit=10000&name=assets/[name].[ext]'
    },
    {
      test: /\.eot(\?v=\d+\.\d+\.\d+)?$/,
      loader: 'file-loader?name=assets/[name].[ext]'
    },

    // Image loaders
    {
      test: /\.(jpg|png|gif)$/,
      loader: 'url-loader?limit=10000&name=assets/[name].[ext]'
    },
    {
      test: /\.(jpe?g|png|gif|svg)(\?{0}(?=\?|$))/,
      use: [
        'file-loader?name=assets/[name].[ext]',
        {
          loader: 'image-webpack-loader',
          options: {
            progressive: true,
            optimizationLevel: 7,
            interlaced: false
          }
        }
      ]
    }
  ].concat(extraRules);

  const commonPlugins: any = [
    new ExtractTextPlugin({
      filename: ((buildOptions.debug && appConfig.appendHashVersionOnDevelopment) ||
          (!buildOptions.debug && appConfig.appendHashVersionOnProduction))
        ? '[name].[chunkhash].css'
        : '[name].css',
      disable: false,
      allChunks: true
    }),
    new LoaderOptionsPlugin({
      test: /\.(css|scss|sass|less|styl)$/,
      options: {
        postcss: buildOptions.debug
          ? [autoprefixer()]
          : [
            autoprefixer(),
            postcssDiscardComments
          ],
        cssLoader: { sourceMap: buildOptions.debug ? true : buildOptions.sourcemapOnProduction },
        sassLoader: { sourceMap: buildOptions.debug ? true : buildOptions.sourcemapOnProduction },
        lessLoader: { sourceMap: buildOptions.debug ? true : buildOptions.sourcemapOnProduction },
        stylusLoader: { sourceMap: buildOptions.debug ? true : buildOptions.sourcemapOnProduction },
        // context needed as a workaround https://github.com/jtangelder/sass-loader/issues/285
        context: projectRoot
      }
    })
  ];

  // ProgressPlugin
  //
  if (buildOptions.progress) {
    commonPlugins.push(new ProgressPlugin());
  }

  // Copy assets
  //
  let shouldCopyAssets = typeof appConfig.assets !== 'undefined' && Array.isArray(appConfig.assets);
  if (shouldCopyAssets && buildOptions.dll && !buildOptions.copyAssetsOnDllBuild) {
    shouldCopyAssets = false;
  }
  if (shouldCopyAssets && !buildOptions.dll && buildOptions.copyAssetsOnDllBuild && ((buildOptions.debug && appConfig.referenceDllOnDevelopment) ||
    (!buildOptions.debug && appConfig.referenceDllOnProduction))) {
    shouldCopyAssets = false;
  }
  if (shouldCopyAssets) {

    const assets = appConfig.assets.map((asset: any) => {
      if (typeof asset === 'string') {
        // convert dir patterns to globs
        if (asset.lastIndexOf('*') === -1 && fs.statSync(path.resolve(appRoot, asset)).isDirectory()) {
          asset += '/**/*';
        }

        return {
          from: {
            glob: asset,
            dot: true
          },
          context: appRoot
        };
      } else if (typeof asset === 'object' && asset.from) {
        if (!asset.context) {
          asset.context = appRoot;
        }
        if (typeof asset.from === 'string') {
          let fromGlob = asset.from;
          if (asset.from.lastIndexOf('*') === -1 && fs.statSync(path.resolve(appRoot, asset.from)).isDirectory()) {
            fromGlob += '/**/*';
          }

          asset.from = {
            glob: fromGlob,
            dot: true
          };
        }
        return asset;
      } else {
        throw new Error(`Invalid 'assets' value in appConfig.`);
      }
    });
    //commonPlugins.push(new GlobCopyWebpackPlugin({
    //  patterns: assets,
    //  globOptions: { cwd: appRoot, dot: true, ignore: '**/.gitkeep' }
    //}));
    commonPlugins.push(new CopyWebpackPlugin(assets,
    {
      ignore: ['**/.gitkeep']
      //copyUnmodified: false
    }));

  }

  // Generate assets
  //
  if ((buildOptions.debug && buildOptions.generateAssetsOnDevelopment) || (!buildOptions.debug && buildOptions.generateAssetsOnProduction)) {
    commonPlugins.push(new AssetsPlugin({
      path: path.resolve(appConfig.outDir),
      filename: buildOptions.dll ? 'webpack.dll.assets.json' : 'webpack.assets.json',
      prettyPrint: true
    }));
  }

  // Generate stats
  //
  if ((buildOptions.debug && buildOptions.generateStatsOnDevelopment) || (!buildOptions.debug && buildOptions.generateStatsOnProduction)) {
    commonPlugins.push(new StatsPlugin(path.resolve(appConfig.outDir, 'stats.json'),
      {
        chunkModules: true
        //exclude: [/node_modules[\\\/]react/]
      }));
  }

  // NamedModulesPlugin
  //
  if (buildOptions.useNameModuleOnDevelopment && buildOptions.debug) {
    commonPlugins.push(new NamedModulesPlugin());
  }

  // Provide plugin
  //
  if (appConfig.provide && typeof appConfig.provide === 'object') {
    commonPlugins.push(
      // NOTE: when adding more properties make sure you include them in custom-typings.d.ts
      new ProvidePlugin(appConfig.provide)
    );
  }

  // DefinePlugin
  //
  if (metadata && !buildOptions.dll) {
    commonPlugins.push(
      // NOTE: when adding more properties make sure you include them in custom-typings.d.ts
      new DefinePlugin(metadata)
    );
  }

  // NormalModuleReplacementPlugin
  //
  if (appConfig.environments && appConfig.environments[envShort] && !buildOptions.dll) {
    commonPlugins.push(new NormalModuleReplacementPlugin(
      // This plugin is responsible for swapping the environment files.
      // Since it takes a RegExp as first parameter, we need to escape the path.
      // See https://webpack.github.io/docs/list-of-plugins.html#normalmodulereplacementplugin
      new RegExp(path.resolve(appRoot, appConfig.environments['source'])
        .replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, '\\$&')),
      path.resolve(appRoot, appConfig.environments[envShort])
    ));
  }

  // Html injection
  //

  // htmlAttributes
  //
  let customTagAttributes: any = null;
  if (appConfig.htmlInjectOptions && (appConfig.htmlInjectOptions.customScriptAttributes || appConfig.htmlInjectOptions.customLinkAttributes)) {
    customTagAttributes = {
      scriptAttributes: appConfig.htmlInjectOptions.customScriptAttributes,
      linkAttributes: appConfig.htmlInjectOptions.customLinkAttributes
    };

  }

  // Styles Inject
  const separateStylesOut = appConfig.htmlInjectOptions && appConfig.htmlInjectOptions.stylesInjectOutFileName && entryPoints['styles'] && !buildOptions.dll;
  const stylesHtmlWebpackPluginId = separateStylesOut ? 'StylesHtmlWebpackPlugin' : null;
  if (separateStylesOut) {
    //const seperateOutput = true;

    commonPlugins.push(new HtmlWebpackPlugin({
      templateContent: ' ',
      filename: path.resolve(projectRoot, appConfig.outDir, appConfig.htmlInjectOptions.stylesInjectOutFileName),
      title: '',
      chunks: ['styles'],
      customAttributes: customTagAttributes,
      inject: true,
      id: stylesHtmlWebpackPluginId
    }));

    // custom link attributes
    if (customTagAttributes) {
      commonPlugins.push(new CustomizeAssetsHtmlWebpackPlugin({
        targetHtmlWebpackPluginId: stylesHtmlWebpackPluginId,
        customLinkAttributes: customTagAttributes.linkAttributes
      }));
    }

    // move head assets to body
    if (customTagAttributes) {
      commonPlugins.push(new CustomizeAssetsHtmlWebpackPlugin({
        targetHtmlWebpackPluginId: stylesHtmlWebpackPluginId,
        moveHeadAssetsToBody: true
      }));
    }
  }


  // Icons, inject
  //
  let shouldGenerateIcons = typeof appConfig.icon !== 'undefined' && appConfig.icon !== null;
  if (shouldGenerateIcons && buildOptions.dll && !buildOptions.generateIconssOnDllBuild) {
    shouldGenerateIcons = false;
  }
  if (shouldGenerateIcons &&
    !buildOptions.dll &&
    buildOptions.generateIconssOnDllBuild &&
    ((buildOptions.debug && appConfig.referenceDllOnDevelopment) ||
      (!buildOptions.debug && appConfig.referenceDllOnProduction))) {
    shouldGenerateIcons = false;
  }
  if (shouldGenerateIcons) {
    let iconConfig: IconPluginOptions = null;
    if (typeof appConfig.icon === 'object') {
      iconConfig = appConfig.icon;
    } else if (typeof appConfig.icon === 'string' && appConfig.icon.match(/\.json$/i)) {
      iconConfig = readJsonSync(path.resolve(appRoot, appConfig.icon));
    } else if (typeof appConfig.icon === 'string' && appConfig.icon.match(/\.[a-zA-Z]{3,4}$/i)) {
      iconConfig = {
        masterPicture: appConfig.icon
      }
    }
    if (!iconConfig || !iconConfig.masterPicture) {
      throw new Error('Invalid favicon format or configuration.');
    }

    iconConfig.masterPicture = path.resolve(appRoot, iconConfig.masterPicture);

    if (!iconConfig.iconsPath) {
      iconConfig.iconsPath = ((buildOptions.debug && appConfig.appendHashVersionOnDevelopment) ||
        (!buildOptions.debug && appConfig.appendHashVersionOnProduction))
        ? 'icons-[hash]/'
        : 'icons/';
    }
    if (!iconConfig.statsFilename) {
      iconConfig.statsFilename = ((buildOptions.debug && appConfig.appendHashVersionOnDevelopment) ||
        (!buildOptions.debug && appConfig.appendHashVersionOnProduction))
        ? 'iconstats-[hash].json'
        : 'iconstats.json';
    }
    if (typeof iconConfig.emitStats === 'undefined') {
      iconConfig.emitStats = (buildOptions.debug && buildOptions.generateStatsOnDevelopment) ||
        (!buildOptions.debug && buildOptions.generateStatsOnProduction);
    }

    let iconsInjectOutFileName = null;
    if (iconConfig['iconsInjectOutFileName']) {
      iconsInjectOutFileName = iconConfig['iconsInjectOutFileName'];
    } else if (appConfig.htmlInjectOptions && appConfig.htmlInjectOptions.iconsInjectOutFileName) {
      iconsInjectOutFileName = appConfig.htmlInjectOptions.iconsInjectOutFileName;
    }

    let iconHtmlSeparateOut = iconsInjectOutFileName !== null &&
      ((iconsInjectOutFileName !== appConfig.indexOutFileName) ||
      (iconsInjectOutFileName !== appConfig.index));

    if (typeof iconConfig.inject === 'undefined') {
      if (appConfig.index || appConfig.indexOutFileName || iconHtmlSeparateOut) {
        iconConfig.inject = true;
      } else {
        iconConfig.inject = true;
      }
    }

    const targetHtmlWebpackPluginId = (iconConfig.inject && iconHtmlSeparateOut)
      ? 'IconsHtmlWebpackPlugin'
      : stylesHtmlWebpackPluginId;

    let seperateOutput = false;
    // Seperate inject output
    if (iconConfig.inject && iconHtmlSeparateOut) {
      seperateOutput = true;

      commonPlugins.push(new HtmlWebpackPlugin({
        templateContent: ' ',
        filename: path.resolve(projectRoot, appConfig.outDir, iconsInjectOutFileName),
        chunks: [],
        title: '',
        customAttributes: customTagAttributes,
        inject: true,
        id: targetHtmlWebpackPluginId
      }));
    }

    iconConfig.targetHtmlWebpackPluginId = targetHtmlWebpackPluginId;
    iconConfig.seperateOutput = seperateOutput;

    commonPlugins.push(
      new IconWebpackPlugin(iconConfig)
    );
  }

  // Default inject
  if ((appConfig.index || appConfig.indexOutFileName) && !buildOptions.dll) {
    const defaultHtmlWebpackPluginId = 'DefaultHtmlWebpackPlugin';
    const excludeChunks = lazyChunks;
    if (separateStylesOut) {
      excludeChunks.push('styles');
    }

    if (appConfig.index && appConfig.index.trim()) {
      commonPlugins.push(new HtmlWebpackPlugin({
        template: path.resolve(appRoot, appConfig.index),
        filename: path.resolve(projectRoot, appConfig.outDir, appConfig.indexOutFileName || appConfig.index),
        chunksSortMode: packageChunkSort(['inline', 'styles', 'scripts', appConfig.dllEntryChunkName , 'main']),
        excludeChunks: excludeChunks,
        title: '',
        isDevServer: isWebpackDevServer(),
        metadata: metadata,
        customAttributes: customTagAttributes,
        id: defaultHtmlWebpackPluginId
        //hot:
        //hash: false,
        //favicon: false,
        //minify: false,
        //cache: true,
        //compile: true,
        //chunks: "all",
        //inject: 'body' //'head' || 'body' || true || false
      }));
    } else {
      commonPlugins.push(new HtmlWebpackPlugin({
        templateContent: ' ',
        filename: path.resolve(projectRoot, appConfig.outDir, appConfig.indexOutFileName || appConfig.index),
        chunksSortMode: packageChunkSort(['inline', 'styles', 'scripts', appConfig.dllEntryChunkName, 'main']),
        excludeChunks: excludeChunks,
        title: '',
        customAttributes: customTagAttributes,
        id: defaultHtmlWebpackPluginId,
        inject: true
      }));

      // move head assets to body
      if (customTagAttributes) {
        commonPlugins.push(new CustomizeAssetsHtmlWebpackPlugin({
          targetHtmlWebpackPluginId: defaultHtmlWebpackPluginId,
          moveHeadAssetsToBody: true
        }));
      }
    }

    // add dll entry - vendor.js
    if ((buildOptions.debug && appConfig.referenceDllOnDevelopment) ||
      (!buildOptions.debug && appConfig.referenceDllOnProduction)) {
      const dllRefScript = `${appConfig.dllEntryChunkName}.js`;
      commonPlugins.push(new CustomizeAssetsHtmlWebpackPlugin({
        targetHtmlWebpackPluginId: defaultHtmlWebpackPluginId,
        scriptSrcToBodyAssets: [dllRefScript],
        customScriptAttributes: customTagAttributes ? customTagAttributes.scriptAttributes : [],
        addPublicPath: true
      }));
    }

    // ** Order is import
    // custom script/link attributes
    if (customTagAttributes) {
      commonPlugins.push(new CustomizeAssetsHtmlWebpackPlugin({
        targetHtmlWebpackPluginId: defaultHtmlWebpackPluginId,
        customScriptAttributes: customTagAttributes.scriptAttributes,
        customLinkAttributes: customTagAttributes.linkAttributes
      }));
    }
  }

  // remove starting slash
  commonPlugins.push(new CustomizeAssetsHtmlWebpackPlugin({
    removeStartingSlash: true
  }));

  // DllPlugin, DllReferencePlugin or CommonsChunkPlugin
  //
  if (buildOptions.dll) {
    const dllPlugins = [
      new DllPlugin({
        path: path.resolve(projectRoot, appConfig.outDir, `[name]-manifest.json`),
        name: '[name]_[chunkhash]' //'[name]_lib' || [name]_[chunkhash]' || '[name]_[hash]'
      }),

      // Workaround for https://github.com/stefanpenner/es6-promise/issues/100
      new IgnorePlugin(/^vertx$/)

      // Workaround for https://github.com/andris9/encoding/issues/16
      //new NormalModuleReplacementPlugin(/\/iconv-loader$/, require.resolve('node-noop')))
    ];
    commonPlugins.push(...dllPlugins);

  } else {
    if ((buildOptions.debug && appConfig.referenceDllOnDevelopment) || (!buildOptions.debug && appConfig.referenceDllOnProduction)) {
      if (appConfig.target === 'node') {
        commonPlugins.push(
          new DllReferencePlugin({
            context: projectRoot, // or '.'
            sourceType: 'commonjs2',
            manifest: require(path.resolve(projectRoot, appConfig.outDir, `${appConfig.dllEntryChunkName}-manifest.json`)),
            name: `./${appConfig.dllEntryChunkName}`
          })
        );
      } else {
        commonPlugins.push(
          new DllReferencePlugin({
            context: projectRoot, //'.',
            manifest: require(path.resolve(projectRoot, appConfig.outDir, `${appConfig.dllEntryChunkName}-manifest.json`))
          })
        );
      }

      commonPlugins.push(new CommonsChunkPlugin({
        minChunks: Infinity,
        name: 'inline'
      }));

    } else {
      commonPlugins.push(new CommonsChunkPlugin({
        minChunks: Infinity,
        name: 'inline'
      }));

      // This enables tree shaking of the vendor modules
      commonPlugins.push(new CommonsChunkPlugin({
        name: appConfig.dllEntryChunkName,
        chunks: ['main'],
        minChunks: (module: any) => module.userRequest && module.userRequest.startsWith(nodeModulesPath)
        // Or
        //minChunks: module => /node_modules\//.test(module.resource)
      }));
    }
  }

  // Suppress plugins
  commonPlugins.push(...suppressPlugins);

  // Production plugins
  if (buildOptions.debug === false) {
    const prodPlugins = [
      new WebpackMd5Hash(),
      new LoaderOptionsPlugin({ debug: false, minimize: true }),
      new UglifyJsPlugin({
        beautify: false,
        mangle: {
          screw_ie8: true,
          keep_fnames: true
        },
        compress: {
          screw_ie8: true
        },
        comments: false,
        sourceMap: buildOptions.sourcemapOnProduction
      })
    ];

    if (appConfig.compressAssetsOnProduction) {
      prodPlugins.push(new CompressionPlugin({
        asset: '[path].gz[query]',
        algorithm: 'gzip',
        test: /\.js$|\.html$|\.css$/,
        threshold: 10240,
        minRatio: 0.8
      }));
    }

    if (buildOptions.productionReplacementModules && buildOptions.productionReplacementModules.length) {
      buildOptions.productionReplacementModules.forEach((entry: ReplacementModuleEntry) => {
        prodPlugins.push(new NormalModuleReplacementPlugin(
          new RegExp(entry.resourceRegExp, 'i'),
          entry.newResource
        ));
      });
    }
    commonPlugins.push(...prodPlugins);
  }

  let webpackConfig = {
    target: appConfig.target === 'node' ? 'node' : 'web',
    devtool: buildOptions.debug ? 'source-map' : false, // Or 'cheap-module-source-map'
    resolve: {
      extensions: buildOptions.dll ? ['.js'] : ['.js', '.json'],
      modules: [appRoot, nodeModulesPath]
    },
    context: projectRoot,
    entry: entryPoints,
    output: {
      path: path.resolve(projectRoot, appConfig.outDir),
      publicPath: appConfig.publicPath,
      filename: ((buildOptions.debug && appConfig.appendHashVersionOnDevelopment) ||
        (!buildOptions.debug && appConfig.appendHashVersionOnProduction))
        ? '[name].[chunkhash].js'
        : '[name].js',
      sourceMapFilename: ((buildOptions.debug && appConfig.appendHashVersionOnDevelopment) ||
        (!buildOptions.debug && appConfig.appendHashVersionOnProduction))
        ? '[name].[chunkhash].map'
        : '[name].map',
      chunkFilename: ((buildOptions.debug && appConfig.appendHashVersionOnDevelopment) ||
        (!buildOptions.debug && appConfig.appendHashVersionOnProduction))
        ? '[id].[chunkhash].js'
        : '[id].js',
      libraryTarget: appConfig.target === 'node' ? buildOptions.dll ? 'commonjs2' : 'commonjs' : 'var',
      // For dll only
      // The name of the global variable which the library's
      // require() function will be assigned to
      library: '[name]_[chunkhash]' //'[name]_lib' || '[name]_[hash]'
    },
    module: {
      rules: commonRules
    },
    plugins: commonPlugins,
    // >= version 2.2
    performance: {
        hints: buildOptions.dll ? false : 'warning', // boolean | "error" | "warning"
        maxAssetSize: 320000, // int (in bytes),
        maxEntrypointSize: 400000, // int (in bytes)
        assetFilter(assetFilename) {
            // Function predicate that provides asset filenames
            return assetFilename.endsWith('.css') || assetFilename.endsWith('.js');
        }
    },
    node: {
      fs: 'empty',
      global: true,
      crypto: 'empty',
      tls: 'empty',
      net: 'empty',
      process: true,
      module: false,
      clearImmediate: false,
      setImmediate: false
    }
    // See: https://webpack.js.org/configuration/stats/
    //stats: {
    //    colors: true,
    //    errors: true,
    //    errorDetails: true,
    //    reasons: true,
    //    timings: true,
    //    assets: true,
    //    version: true,
    //    warnings: true,
    //    // Add the source code of modules
    //    source: true,
    //    // Add information about cached (not built) modules
    //    children: true,
    //    publicPath: false,
    //    //modules: false,
    //    hash: false,
    //    // make sure 'chunks' is false or it will add 5-10 seconds to your build and incremental build time, due to excessive output.
    //    chunks: false
    //    // Add built modules information to chunk information
    //    //chunkModules: false,
    //    // Add the origins of chunks and chunk merging info
    //    //chunkOrigins: false
    //}
  };

  return webpackConfig;

}

