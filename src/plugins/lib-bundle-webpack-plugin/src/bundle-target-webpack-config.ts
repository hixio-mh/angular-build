import { existsSync } from 'fs';
import * as path from 'path';

import * as resolve from 'resolve';
import * as webpack from 'webpack';

import { AngularBuildContext, LibBundleOptionsInternal, LibProjectConfigInternal } from '../../../build-context';
import { InternalError, InvalidConfigError } from '../../../error-models';
import { getCustomWebpackConfig } from '../../../helpers/get-custom-webpack-config';
import { isFromWebpackCli } from '../../../helpers/detect-cli';

import { getAngularGlobals } from './angular-globals';
import { getRxJsGlobals } from './rxjs-globals';

const UglifyJSPlugin = require('uglifyjs-webpack-plugin');
const nodeExternals = require('webpack-node-externals');
const webpackMerge = require('webpack-merge');

export function getBundleTargetWebpackConfig<TConfig extends LibProjectConfigInternal>(angularBuildContext:
  AngularBuildContext<TConfig>,
  currentBundle: LibBundleOptionsInternal): { [key: string]: any } {
  if (!currentBundle._entryFilePath) {
    throw new InternalError("The 'currentBundle._entryFilePath' is not set.");
  }

  const logger = AngularBuildContext.logger;
  const logLevel = angularBuildContext.buildOptions.logLevel;
  const verbose = logLevel === 'debug';

  const libConfig = angularBuildContext.projectConfig;

  const projectRoot = path.resolve(AngularBuildContext.workspaceRoot, libConfig.root || '');
  const isTsEntry = /\.ts$/i.test(currentBundle._entryFilePath);
  let moduleName = libConfig.libraryName;
  if (!moduleName && libConfig._packageNameWithoutScope) {
    moduleName = libConfig._packageNameWithoutScope.replace(/\//gm, '.');
  }

  // library target
  if (currentBundle.libraryTarget === 'es') {
    throw new InvalidConfigError(
      `The 'projects[${libConfig.name || libConfig._index}].bundles[${currentBundle._index
      }].libraryTarget = es' is currently not supported by webpack.`);
  }

  // externals
  const externals: any = [];
  let includeCommonJsModules = true;

  if (currentBundle.nodeModulesAsExternals !== false) {
    externals.push(nodeExternals());
    includeCommonJsModules = false;
  }

  if (typeof currentBundle.externals === 'undefined') {
    if (currentBundle.includeDefaultAngularAndRxJsGlobals ||
      (currentBundle.includeDefaultAngularAndRxJsGlobals !== false && !includeCommonJsModules)) {
      externals.push(getAngularGlobals());
      externals.push(getRxJsGlobals());
    }
  } else {
    let noExternals = false;
    if (!currentBundle.externals ||
      (Array.isArray(currentBundle.externals) && !currentBundle.externals.length) ||
      (typeof currentBundle.externals === 'object' && !Object.keys(currentBundle.externals).length)) {
      noExternals = true;
    }

    if (noExternals) {
      if (currentBundle.includeDefaultAngularAndRxJsGlobals !== false) {
        externals.push(getAngularGlobals());
        externals.push(getRxJsGlobals());
      }
    } else {
      if (Array.isArray(currentBundle.externals)) {
        externals.push(...currentBundle.externals);
      } else {
        externals.push(currentBundle.externals);
      }

      if (currentBundle.includeDefaultAngularAndRxJsGlobals !== false) {
        externals.push(getAngularGlobals());
        externals.push(getRxJsGlobals());
      }
    }
  }

  const rules: webpack.RuleSetRule[] = [];
  const plugins: webpack.Plugin[] = [];
  const resolvePlugins: webpack.Plugin[] = [];

  // progress
  if (angularBuildContext.buildOptions.progress && !isFromWebpackCli()) {
    plugins.push(new webpack.ProgressPlugin());
  }

  // banner
  if (libConfig.banner &&
    libConfig._bannerText) {
    const bannerText = libConfig._bannerText;
    plugins.push(new webpack.BannerPlugin({
      banner: bannerText,
      raw: true,
      entryOnly: true
    }));
  }

  if (isTsEntry) {
    const tsConfigPath = currentBundle._tsConfigPath;
    const tsLoaderOptions: { [key: string]: any } = {
      instance: `at-${libConfig.name || 'libs[' + (libConfig.name || libConfig._index) + ']'}-loader`,
      transpileOnly: currentBundle.tsConfig ? false : true,
      onlyCompileBundledFiles: currentBundle.tsConfig ? false : true,
      silent: !verbose
    };

    if (currentBundle.tsConfig && tsConfigPath) {
      tsLoaderOptions.configFile = tsConfigPath;
    }
    if (logLevel) {
      tsLoaderOptions.logLevel = logLevel;
    }

    rules.push({
      test: /\.ts$/,
      use: [
        {
          loader: 'ts-loader',
          options: tsLoaderOptions
        }
      ]
    });
  }

  const nodeModulePaths = ['node_modules'];
  if (AngularBuildContext.nodeModulesPath) {
    nodeModulePaths.push(AngularBuildContext.nodeModulesPath);
  }

  const loaderModulePaths = [...nodeModulePaths];
  if (AngularBuildContext.cliRootPath) {
    const cliNodeModulePath = path.resolve(AngularBuildContext.cliRootPath, 'node_modules');
    if (!loaderModulePaths.includes(cliNodeModulePath)) {
      loaderModulePaths.push(cliNodeModulePath);
    }
  } else if (AngularBuildContext.nodeModulesPath) {
    const cliNodeModulePath = path.resolve(AngularBuildContext.nodeModulesPath,
      '@bizappframework/angular-build/node_modules');
    if (!loaderModulePaths.includes(cliNodeModulePath)) {
      loaderModulePaths.push(cliNodeModulePath);
    }
  }

  let symlinks = true;
  if (isTsEntry &&
    currentBundle._tsConfigPath &&
    currentBundle._tsCompilerConfig &&
    currentBundle._tsCompilerConfig.options.preserveSymlinks) {
    symlinks = false;
  }

  let alias: any = {};
  if (!currentBundle.nodeModulesAsExternals &&
    !currentBundle.includeDefaultAngularAndRxJsGlobals &&
    AngularBuildContext.nodeModulesPath &&
    existsSync(path.resolve(AngularBuildContext.nodeModulesPath, 'rxjs'))) {
    try {
      const rxjsPathMappingImportModuleName =
        currentBundle._supportES2015
          ? 'rxjs/_esm2015/path-mapping'
          : 'rxjs/_esm5/path-mapping';
      const pathMapping = require(resolve.sync(rxjsPathMappingImportModuleName,
        { basedir: AngularBuildContext.nodeModulesPath || AngularBuildContext.workspaceRoot }));
      alias = pathMapping();
    } catch (e) {
      logger.warn(`Failed rxjs path alias. ${e.message}`);
    }
  }

  const webpackConfig: webpack.Configuration = {
    target: libConfig.platformTarget,
    devtool: libConfig.sourceMap ? 'source-map' : undefined,
    entry: currentBundle._entryFilePath,
    output: {
      path: path.dirname(currentBundle._outputFilePath),
      filename: path.basename(currentBundle._outputFilePath),
      library: moduleName,
      libraryTarget: 'umd',
      umdNamedDefine: true
    },
    resolve: {
      extensions: isTsEntry ? ['.ts', '.js'] : ['.js'],
      symlinks: symlinks,
      modules: nodeModulePaths,
      mainFields: currentBundle._nodeResolveFields,
      alias: alias,
      plugins: resolvePlugins
    },
    resolveLoader: {
      modules: loaderModulePaths
    },
    externals: externals,
    context: projectRoot,
    module: {
      rules: rules
    },
    plugins: plugins,
    stats: 'errors-only'
  };

  if (currentBundle.minify) {
    webpackConfig.optimization = {
      minimizer: [
        new webpack.HashedModuleIdsPlugin(),
        new UglifyJSPlugin({
          // extractComments: true,
          sourceMap: libConfig.sourceMap,
          // warningsFilter: (resourceId: string): boolean => {
          //    return !!resourceId && /(\\|\/)node_modules(\\|\/)/.test(resourceId);
          // },
          parallel: true,
          cache: true,
          uglifyOptions: {
            // ie8: true, // default false
            ecma: currentBundle._ecmaVersion, // default undefined
            safari10: true,
            compress: {
              pure_getters: true,
              passes: 3,
              // Workaround known uglify-es issue
              // See https://github.com/mishoo/UglifyJS2/issues/2949#issuecomment-368070307
              inline: currentBundle._supportES2015 ? 1 : 3
            },
            warnings: verbose, // default false
            output: {
              ascii_only: true, // default false
              // comments: false, // default false
              beautify: false, // default true
              comments: false,
              webkit: true
            }
          }
        })
      ]
    };
  }

  if (currentBundle.webpackConfig) {
    const customWebpackConfigPath =
      path.resolve(AngularBuildContext.workspaceRoot, libConfig.root || '', currentBundle.webpackConfig);
    const customWebpackConfig =
      getCustomWebpackConfig(customWebpackConfigPath, angularBuildContext) || {};

    const mergedConfig = webpackMerge([
      webpackConfig,
      customWebpackConfig
    ]) as webpack.Configuration;

    return mergedConfig;
  }

  return webpackConfig;
}
