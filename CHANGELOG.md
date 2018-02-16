# Change Logs

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