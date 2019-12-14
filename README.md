# Angular Build & Packaging Tool

[![Build Status](https://github.com/DagonMetric/angular-build/workflows/Build/badge.svg)](https://github.com/DagonMetric/angular-build/actions)
[![Build Status](https://dev.azure.com/DagonMetric/angular-build/_apis/build/status/DagonMetric.angular-build?branchName=master)](https://dev.azure.com/DagonMetric/angular-build/_build/latest?definitionId=3&branchName=master)
[![CircleCI](https://circleci.com/gh/DagonMetric/angular-build/tree/master.svg?style=svg)](https://circleci.com/gh/DagonMetric/angular-build/tree/master)
[![npm (scoped)](https://img.shields.io/npm/v/@dagonmetric/angular-build.svg)](https://www.npmjs.com/package/@dagonmetric/angular-build)
[![npm](https://img.shields.io/npm/dm/@dagonmetric/angular-build.svg)](https://www.npmjs.com/package/@dagonmetric/angular-build)
[![Gitter](https://badges.gitter.im/DagonMetric/general.svg)](https://gitter.im/DagonMetric/general?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge)

Another build and packaging tool for [Angular](https://angular.io/) applications and library projects.

## Features

* Build support for both library projects (internally with [rollup](https://rollupjs.org)) and app projects (internally with [webpack](https://webpack.js.org)).
* This npm package can be consumed by [Angular Cli](https://cli.angular.io), [Webpack Cli](https://www.npmjs.com/package/webpack-cli), or built-in cli.
* Flexable JSON configuration with extendable config options.

### Library Project Build / Packaging Features

* Can bundles library projects into either [Angular Package Format 8.0](https://docs.google.com/document/d/1CZC2rcpxffTDfRDs6p1cfbmKNLA6x5O-NtkJglDaBVs/preview) (fesm2015, fesm5, umd formats) or custom output formats.
* Can customize ngc typescript transpilations and bundle options.
* Supports secondary entry points such as @angular/common/http.
* Can inline/embed Angular resources such as templateUrl and styleUrls.
* Supports built-in style processing of .css and .scss files.
* Supports style preprocessor options for .scss files.
* Automatic copying and entry point processing of package.json file to output directory.
* Can copy assets (README, LICENSE, etc.) to output directory.
* Can replace individual package.json version, name, description, etc with root package.json one or command argument.
* Can replace version placeholder in typescript file.
* Can replace version, package name placeholders in banner file.

### Application Project Build Features

* Most of [@angular-devkit/build-angular](https://www.npmjs.com/package/@angular-devkit/build-angular) options are supported
* Customizable html injection - can inject bundled scripts, links, resource hints, etc into separate files or partial views.
* DLL bundling support for optimizing build time.
* Can merge built-in configurations with custom webpack configuration.

## Getting Started

### Prerequisites

* [Node.js](https://nodejs.org/en/download/) requirement:  >= v10.9

### Supported Angular Versions

* Angular v8.0.0 or greater

### Installation

To install the angular-build to your workspace root:

npm

```bash
npm install -D @dagonmetric/angular-build
```

or yarn

```bash
yarn add -D @dagonmetric/angular-build
```

### Guides

* [Building and Packaging Library Projects](https://github.com/DagonMetric/angular-build/wiki/Building-and-Packaging-Angular-Library-Projects)

* [Building Application Projects](https://github.com/DagonMetric/angular-build/wiki/Building-Angular-Application-Projects)

## Some projects with Angular Build configuration

* [ng-translit](https://github.com/DagonMetric/ng-translit) - Transliterate service for Angular

* [ng-config](https://github.com/DagonMetric/ng-config) - Configuration service for Angular

* [ng-cache](https://github.com/DagonMetric/ng-cache) - Caching service for Angular

* [ng-log](https://github.com/DagonMetric/ng-log) - Logging service for Angular

## Feedback and Contributing

Check out the [Contributing](https://github.com/DagonMetric/angular-build/blob/master/CONTRIBUTING.md) page to see the best places to log issues and start discussions.

## License

This repository is licensed with the [MIT](https://github.com/DagonMetric/angular-build/blob/master/LICENSE) license.
