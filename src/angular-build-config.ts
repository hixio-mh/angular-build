// Ref: https://webpack.js.org/configuration/
// ReSharper disable InconsistentNaming
import * as path from 'path';
import * as fs from 'fs';

// Webpack built-in plugins
const ContextReplacementPlugin = require('webpack/lib/ContextReplacementPlugin');
const NormalModuleReplacementPlugin = require('webpack/lib/NormalModuleReplacementPlugin');
const LoaderOptionsPlugin = require('webpack/lib/LoaderOptionsPlugin');

// Typescript plugins
//import { AotPlugin } from '@ngtools/webpack';
// Or
//import { CheckerPlugin } from 'awesome-typescript-loader';
//import { TsConfigPathsPlugin } from 'awesome-typescript-loader';
// ReSharper disable CommonJsExternalModule
const { CheckerPlugin } = require('awesome-typescript-loader');
const TsConfigPathsPlugin = require('awesome-typescript-loader').TsConfigPathsPlugin;
// ReSharper restore CommonJsExternalModule


// Other plugins
const webpackMerge = require('webpack-merge');

// Local
import { AngularAppConfig, AngularBuildOptions } from './models';
import { readJsonSync, isDevelopmentBuild, isDllBuildFromNpmEvent, isAoTBuildFromNpmEvent } from './utils';
import { getWebpackCommonConfig } from './webpack-build-common';

const defaultAppConfig = {
    root: 'src',
    outDir: 'wwwroot'
};

export function getWebpackAngularConfigs(projectRoot: string, configPath?: string, buildOptions?: AngularBuildOptions) {
  projectRoot = projectRoot || process.cwd();

  let configFileExists = false;
  configPath = configPath || 'angular-build.json';
  if (!fs.existsSync(path.resolve(projectRoot, configPath))) {
    const tmpConfigPath = 'angular-cli.json';
    if (fs.existsSync(path.resolve(projectRoot, tmpConfigPath))) {
      configPath = tmpConfigPath;
      configFileExists = true;
    }
  } else {
    configFileExists = true;
  }

  if (!configFileExists) {
    throw new Error(`'angular-build.json' or 'angular-cli.json' file cound not be found at project root ${projectRoot}.`);
  }

  const appsConfig = readJsonSync(path.resolve(projectRoot, configPath));
  buildOptions = buildOptions || {};
  buildOptions.dll = typeof buildOptions.dll === 'undefined' ? isDllBuildFromNpmEvent() : buildOptions.dll;

  // Extends
  const appConfigs = appsConfig.apps.map((app: AngularAppConfig) => {
    let cloneApp = Object.assign({}, app);
    if (cloneApp.extends) {
      const baseApps = appsConfig.apps.filter((a: AngularAppConfig) => a.name === cloneApp.extends);
      if (baseApps && baseApps.length > 0) {
        const cloneBaseApp = Object.assign({}, baseApps[0]);
        cloneApp = Object.assign({}, cloneBaseApp, cloneApp);
      }
    }
    return cloneApp;
  });

  return appConfigs.filter((app: AngularAppConfig) => (app.enabled || (typeof app.enabled === 'undefined')) &&
    (!buildOptions.dll ||
    (buildOptions.dll && app.dlls && app.dlls.length && (typeof app.skipOnDllBuild === 'undefined' || !app.skipOnDllBuild))
    ))
    .map((app: AngularAppConfig) => {
      const cloneBuildOption = Object.assign({}, buildOptions);
      return getWebpackAngularConfig(projectRoot, app, cloneBuildOption);
    });
}

export function getWebpackAngularConfig(projectRoot: string, appConfig: AngularAppConfig, buildOptions?: AngularBuildOptions) {
  projectRoot = projectRoot || process.cwd();
  buildOptions = buildOptions || {};
  buildOptions.debug = typeof buildOptions.debug === 'undefined' ? isDevelopmentBuild() : buildOptions.debug;
  buildOptions.dll = typeof buildOptions.dll === 'undefined' ? isDllBuildFromNpmEvent() : buildOptions.dll;
  buildOptions.aot = typeof buildOptions.aot === 'undefined' ? isAoTBuildFromNpmEvent() : buildOptions.aot;

  if (!appConfig) {
    throw new Error(`'appConfig' is required.`);
  }
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

  const appRoot = path.resolve(projectRoot, appConfig.root);
  const tsConfigPath = path.resolve(projectRoot, appConfig.root, appConfig.tsconfig || 'tsconfig.json');

  let emptyModulePath = buildOptions['emptyModule'];
  if (!emptyModulePath) {
    emptyModulePath = path.resolve(projectRoot, 'empty.js');
    if (!fs.existsSync(emptyModulePath)) {
      emptyModulePath = path.resolve(projectRoot, appConfig.root, 'empty.js');
    }
    if (!fs.existsSync(emptyModulePath)) {
      emptyModulePath = require.resolve('./empty.js');
    }
    if (!fs.existsSync(emptyModulePath)) {
      emptyModulePath = require.resolve('../empty.js');
    }
    // ts
    if (!fs.existsSync(emptyModulePath)) {
      emptyModulePath = path.resolve(projectRoot, 'empty.ts');
    }
    if (!fs.existsSync(emptyModulePath)) {
      emptyModulePath = path.resolve(projectRoot, appConfig.root, 'empty.ts');
    }
    if (!fs.existsSync(emptyModulePath)) {
      emptyModulePath = require.resolve('./empty.ts');
    }
    if (!fs.existsSync(emptyModulePath)) {
      emptyModulePath = require.resolve('../empty.ts');
    }
    buildOptions['emptyModule'] = emptyModulePath;
  }

  const rules: any = [];
  const plugins: any = [];

  const commonConfig = getWebpackCommonConfig(projectRoot, appConfig, buildOptions);

  // rules
  //
  if (!buildOptions.dll) {

    // Typescript rules, AoT and Non-AoT
    const tsRules = [
      {
        test: /\.ts$/,
        use: [
          //'@angularclass/hmr-loader?pretty=' + buildOptions.debug + '&prod=' + !buildOptions.debug,
          //'awesome-typescript-loader?{configFileName: "' + tsConfigPath + '", instance: "at-' + appConfig.name || 'app' +'-loader"}',
          {
            loader: 'awesome-typescript-loader',
            options: {
              instance: `at-${appConfig.name || 'app'}-loader`,
              configFileName: tsConfigPath
            }
          },
          {
            loader: 'string-replace-loader',
            options: {
              search: 'moduleId:\s*module.id\s*[,]?',
              replace: '',
              flags: 'g'
            }
          },
          //{
          //    test: /\.ts$/,
          //    loader: 'string-replace-loader',
          //    query: {
          //        search: '(System|SystemJS)(.*[\\n\\r]\\s*\\.|\\.)import\\((.+)\\)',
          //        replace: '$1.import($3).then(mod => (mod.__esModule && mod.default) ? mod.default : mod)',
          //        flags: 'g'
          //    },
          //    include: [appRoot]
          //},
          'angular2-template-loader',
          //'angular-router-loader?loader=system&genDir=aot-compiled/src/app&aot=' + buildOption.aot
          {
              loader: 'angular2-router-loader',
              options: {
                loader: 'system'
                  //TODO: to review
                  //aot: buildOptions.aot,
                  //genDir: 'aot-compiled/src/app'
              }
          }
        ],
        //include: [appRoot]
        exclude: [/\.(spec|e2e|e2e-spec)\.ts$/]
      }
      // TODO: to review
      // Or
      //{
      //    test: /\.ts$/,
      //    loader: '@ngtools/webpack',
      //    exclude: [/\.(spec|e2e|e2e-spec)\.ts$/]
      //}
    ];
    rules.push(...tsRules);
  }

  // plugins
  //
  // fix angular2
  const angular2fixPlugins = [

    // see:  https://github.com/angular/angular/issues/11580
    new ContextReplacementPlugin(
      // The (\\|\/) piece accounts for path separators in *nix and Windows
      /angular(\\|\/)core(\\|\/)(esm(\\|\/)src|src)(\\|\/)linker/,
      appRoot
      //resolveNgRoute(root(options.srcRoot))
    ),

    new NormalModuleReplacementPlugin(
        /facade(\\|\/)async/,
        path.resolve(projectRoot, 'node_modules/@angular/core/src/facade/async.js')
    ),
    new NormalModuleReplacementPlugin(
        /facade(\\|\/)collection/,
        path.resolve(projectRoot, 'node_modules/@angular/core/src/facade/collection.js')
    ),
    new NormalModuleReplacementPlugin(
        /facade(\\|\/)errors/,
        path.resolve(projectRoot, 'node_modules/@angular/core/src/facade/errors.js')
    ),
    new NormalModuleReplacementPlugin(
        /facade(\\|\/)lang/,
        path.resolve(projectRoot, 'node_modules/@angular/core/src/facade/lang.js')
    ),
    new NormalModuleReplacementPlugin(
        /facade(\\|\/)math/,
        path.resolve(projectRoot, 'node_modules/@angular/core/src/facade/math.js')
    )
  ];
  plugins.push(...angular2fixPlugins);

  if (!buildOptions.dll) {
    // Typescript plugins, Aot and Non-Aot
    //
    const tsPlugins = [
        new CheckerPlugin()
    ];
    plugins.push(...tsPlugins);
    // Or
    //if (buildOptions.aot) {
    //    const aotPlugins = [
    //        new AotPlugin({
    //            tsConfigPath: tsConfigPath,
    //            mainPath: path.join(projectRoot, appConfig.root, appConfig.main),
    //            i18nFile: appConfig.i18nFile,
    //            i18nFormat: appConfig.i18nFormat,
    //            locale: appConfig.locale,
    //            exclude: [
    //                path.join(projectRoot, appConfig.root, appConfig.test || 'test.ts'),
    //                '**/*.spec.ts'
    //            ]
    //        })
    //    ];
    //    plugins.push(...aotPlugins);
    //} else {
    //    const nonAoTPlugins = [
    //        //new AotPlugin({
    //        //    tsConfigPath: tsConfigPath,
    //        //    mainPath: path.join(projectRoot, appConfig.root, appConfig.main),
    //        //    exclude: [
    //        //        path.join(projectRoot, appConfig.root, appConfig.test),
    //        //        '**/*.spec.ts'
    //        //    ],
    //        //    skipCodeGeneration: true
    //        //})
    //    ];
    //    plugins.push(...nonAoTPlugins);
    //}
  }

  // Ignore plugins
  //
  if (buildOptions.aot || !buildOptions.debug) {
    const prodPlugins = [
      new NormalModuleReplacementPlugin(
        /zone\.js(\\|\/)dist(\\|\/)long-stack-trace-zone/,
        emptyModulePath
      ),

      // AoT
      // problem with platformUniversalDynamic on the server/client
      //new IgnorePlugin(/@angular(\\|\/)compiler/),
      // Or
      //new NormalModuleReplacementPlugin(
      //    /@angular(\\|\/)compiler/,
      //    emptyModulePath
      //),

      // AoT
      // new NormalModuleReplacementPlugin(
      //   /@angular(\\|\/)upgrade/,
      //    emptyModulePath
      // ),
      // new NormalModuleReplacementPlugin(
      //   /@angular(\\|\/)platform-browser-dynamic/,
      //    emptyModulePath
      // ),
      // new NormalModuleReplacementPlugin(
      //   /dom(\\|\/)debug(\\|\/)ng_probe/,
      //    emptyModulePath
      // ),
      // new NormalModuleReplacementPlugin(
      //   /dom(\\|\/)debug(\\|\/)by/,
      //    emptyModulePath
      // ),
      // new NormalModuleReplacementPlugin(
      //   /src(\\|\/)debug(\\|\/)debug_node/,
      //    emptyModulePath
      // ),
      // new NormalModuleReplacementPlugin(
      //   /src(\\|\/)debug(\\|\/)debug_renderer/,
      //    emptyModulePath
      // ),

      new LoaderOptionsPlugin({
        options: {
           /**
           * Static analysis linter for TypeScript advanced options configuration
           * Description: An extensible linter for the TypeScript language.
           *
           * See: https://github.com/wbuchwalter/tslint-loader
           */
            tslint: {
              emitErrors: true,
              failOnHint: true,
              resourcePath: 'src'
            },

              /**
               * Html loader advanced options
               *
               * See: https://github.com/webpack/html-loader#advanced-options
               */
              // TODO: Need to workaround Angular 2's html syntax => #id [bind] (event) *ngFor
              htmlLoader: {
                  minimize: true,
                  removeAttributeQuotes: false,
                  caseSensitive: true,
                  customAttrSurround: [
                      [/#/, /(?:)/],
                      [/\*/, /(?:)/],
                      [/\[?\(?/, /(?:)/]
                  ],
                  customAttrAssign: [/\)?\]?=/]
              }

          }
      })

    ];

    if (buildOptions.aot) {
      const aotProdPlugins = [
        // AoT
        // problem with platformUniversalDynamic on the server/client
        //new IgnorePlugin(/@angular(\\|\/)compiler/),
        // Or
        new NormalModuleReplacementPlugin(
            /@angular(\\|\/)compiler/,
            emptyModulePath
        )

        // AoT
        // new NormalModuleReplacementPlugin(
        //   /@angular(\\|\/)upgrade/,
        //    emptyModulePath
        // ),
        // new NormalModuleReplacementPlugin(
        //   /@angular(\\|\/)platform-browser-dynamic/,
        //    emptyModulePath
        // ),
        // new NormalModuleReplacementPlugin(
        //   /dom(\\|\/)debug(\\|\/)ng_probe/,
        //    emptyModulePath
        // ),
        // new NormalModuleReplacementPlugin(
        //   /dom(\\|\/)debug(\\|\/)by/,
        //    emptyModulePath
        // ),
        // new NormalModuleReplacementPlugin(
        //   /src(\\|\/)debug(\\|\/)debug_node/,
        //    emptyModulePath
        // ),
        // new NormalModuleReplacementPlugin(
        //   /src(\\|\/)debug(\\|\/)debug_renderer/,
        //    emptyModulePath
        // ),
      ];
      prodPlugins.push(...aotProdPlugins);
    }

    //if (typeof buildOptions.replaceHmrOnProduction === 'undefined' || buildOptions.replaceHmrOnProduction) {
    //  prodPlugins.push(new NormalModuleReplacementPlugin(
    //    /angular2-hmr/,
    //    emptyModulePath
    //  ));
    //}
    plugins.push(...prodPlugins);

  }

  if (buildOptions.aot && appConfig.mainAoT && commonConfig.entry && commonConfig.entry['main']) {
      const appAoTMain = path.resolve(projectRoot, appConfig.root, appConfig.mainAoT);
      commonConfig.entry['main'] = [appAoTMain];
  }

  let angularConfig = {
    resolve: {
      extensions: buildOptions.dll ? ['.js'] : ['.ts', '.js', '.json']
    },
    module: {
      rules: rules
    },
    plugins: plugins
  };
  angularConfig = webpackMerge(commonConfig, angularConfig);

  if (!buildOptions.dll) {
    //const alias = {};
    //if (fs.existsSync(tsConfigPath)) {
    //    const tsConfigContent = readJsonSync(tsConfigPath);
    //    const compilerOptions = tsConfigContent.compilerOptions || {};
    //    const tsPaths = compilerOptions.paths || {};
    //    for (let prop in tsPaths) {
    //        if (tsPaths.hasOwnProperty(prop)) {
    //            alias[prop] = path.resolve(projectRoot, tsPaths[prop][0]);
    //        }
    //    }
    //}

    angularConfig = webpackMerge(angularConfig, {
        resolve: {
            // alias: alias,
            // Or
            plugins: [
                // TODO: to review
                new TsConfigPathsPlugin({
                    configFileName: tsConfigPath
                })
            ]
        }
    });
  }
  return angularConfig;
}
