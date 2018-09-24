# Change Logs

## 6.1.5

### Features

- N/A

### Bugs

- Fix polyfills entry parsing logic
- Fix error non-existed file copy

### Misc

- Update dependencies

## 6.1.4

### Features

- N/A

### Bugs

- N/A

### Misc

- Change cleanOutDir default to true
- Change forkTypeChecker default to true
- Change libraryTarget options
- Remove bundleTool options from library bundle config
- Update dependencies

## 6.1.3

### Features

- N/A
  
### Bugs

- N/A

### Misc

- Update dependencies

## 6.1.2

### Features

- N/A
  
### Bugs

- N/A

### Misc

- Update dependencies

## 6.1.1

### Features

- N/A
  
### Bugs

- Fix @angular-devkit/build-angular:browser compatibility. [#9f42a6df](https://github.com/BizAppFramework/angular-build/commit/9f42a6df05078e9086887b228ec7ba744838e4a6)

### Misc

- Update dependencies

## 6.1.0

### Changes

- Code refactoring, bug fixes and updated npm dependencies

## 6.0.0

### Features

- Angular 6 support
- Added architect builders (app and lib) to work with [Angular CLI workspace file](https://github.com/angular/angular-cli/wiki/angular-workspace) (angular.json)
- Added angular service worker support

### Changes

- Updated app config schema to compat with angular cli
- Code refactoring
- Updated npm dependencies
- Updated README file

## 6.0.0-rc.6

- Fixed - ignore empty array in build options
- Fixed - avoid reusing main chunk for common modules
- Fixed - disable sourcemaps with JS style
- Updated README file
- Updated npm dependencies

## 6.0.0-rc.5

- Updated generate schemas logic to compat with angular cli
- Updated npm dependencies

## 6.0.0-rc.4

- Added angular service worker support
- Updated app config schema to compat with angular cli

## 6.0.0-rc.3

- Fixed output paths for library projects
- Updated npm dependencies

## 6.0.0-rc.2

- Fixed webpack deprecation warnings inside `@angular/core` as using SystemJS style dynamic imports
- Fixed split small common modules into one
- Updated npm dependencies

## 6.0.0-rc.1

- Fixed array types in schema to compatible with Angular CLI
- Updated npm dependencies

## 6.0.0-rc.0

- Added builders which can be consumed by @angular/cli
- Code refactoring
- Updated npm dependencies

## 6.0.0-beta.4

- Updated angular 6
- Updated npm dependencies

## 6.0.0-beta.3

- Updated angular and rxjs globals handling for rollup
- Updated npm dependencies

## 6.0.0-beta.2

- Updated to webpack 4 and @ngtools/webpack@6.0.0-beta.4
- Added moduleRoots option to config
- Added some properties to htmlInject options - (runtimeChunkInline, dlls, icons, runtimeInlineOut, etc)
- Added internal html-inject-webpack-plugin
- Added lazyModules option to config
- Added feature to pass global environment variable
- When setting environmentVariables to false, node simulation will be disabled if targeting to web
- Changed in config model options
- Updated samples
- Updated npm dependencies

## 5.2.5

- Fixed error 'Cannot find module @angular-devkit/build-optimizer ...' [#89d00657](https://github.com/BizAppFramework/angular-build/commit/89d0065787a08d835f7eb43f5c12c3f76984a29b)
- Set rollup-plugin-typescript2 cacheRoot directory to srcDir/.rts2_cache [#50e7850f](https://github.com/BizAppFramework/angular-build/commit/50e7850f861ace19e21b103179b998631cad4350)
- Updated npm dependencies [#f7d69eda](https://github.com/BizAppFramework/angular-build/commit/f7d69eda0f91500b76c0845ee449a999b9c27eb7)

## 5.2.4

- Added cliIsLink flag to cli option [#962bb0be](https://github.com/BizAppFramework/angular-build/commit/962bb0be75eef907d6517098e48404a7d6c30361)
- Fixed error - cannot find module ..../@bizappframework\angular-build\dist\package.json when link [#493719ac](https://github.com/BizAppFramework/angular-build/commit/493719ac417ce265bb05451edc0006282d31eed8)
- Fixed not copying some root package.json options [#41c97d2a](https://github.com/BizAppFramework/angular-build/commit/41c97d2a725034909e867e3ae8428f9425f17f23)
- Updated npm packages [#f7d69eda](https://github.com/BizAppFramework/angular-build/commit/f7d69eda0f91500b76c0845ee449a999b9c27eb7)

## 5.2.3

- Simplify paths module resolution [#fb38acaa](https://github.com/BizAppFramework/angular-build/commit/fb38acaa422b31272e888d66e512b96987f5b30b)
- Updated webpack stats option [#cd4224f0](https://github.com/BizAppFramework/angular-build/commit/cd4224f0f4575d12f8bf65ba96d66f0c460258ff)
- Updated npm packages [#77eb7e3a](https://github.com/BizAppFramework/angular-build/commit/77eb7e3ab996f776013f156060a05ffce4258043)

## 5.2.2

- Added moduleConcatenation option to app config model [#bd471e0c](https://github.com/BizAppFramework/angular-build/commit/bd471e0c93536db07644fb7cac1e0f4a1d121ad9)
- Improved and refactored internal BundleAnalyzerPlugin [#59bf6339](https://github.com/BizAppFramework/angular-build/commit/59bf63397e816168507a4b4f6a84d5fe53793229)
- Fixed error - maximum call stack size exceeded at mapToRollupGlobalsAndExternals [#79ec5211](https://github.com/BizAppFramework/angular-build/commit/79ec5211a232c02fc36be85c21dfbd99b9d5132a)
- Updated npm packages [#d51e2657](https://github.com/BizAppFramework/angular-build/commit/d51e265727d52ca3fba5066696319340b65f15a2)

## v5.2.1

- Fix defining global environment variables

## v5.2.0

- Added fature for separate output hashing for bundle scripts, css, extracted assets and chunks
- Fixed node_modules path resolution
- Updated npm packages

## v5.1.0

- Bug fixes, Improvement in error handling and logging logic
- Updated npm packages
- Improvement in before run clean logic
- Added ngb build --config option
- Added telemetry client to collect usage statistics to improve user experience
- Added angular app and lib test projects for build integration tests

## v5.0.2

- Fix webpack loader module paths
- Solve invalid configuration object webpack has been initialised - configuration[0] has an unknown property '_projectConfig' ... when building form webapck cli directly
- Copy schemas folder from dist to root to work with npm link
- Update .appveyor.yml and .travis.yml files for npm publish and improve caching
- Add missing closing bracket to sourceMapDevToolModuleFilenameTemplate(s)
- Update dependencies

## v5.0.1

- Update ReadMe file

## v5.0.0

- Version 5.0.0 contains a lot of changes in the source code to improve the quality and performance in the build process