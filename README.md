[![Build status](https://ci.appveyor.com/api/projects/status/195c2h2orc2q2rur?svg=true)](https://ci.appveyor.com/project/admindagonmetriccom/angular-build)
[![Build Status](https://dev.azure.com/DagonMetric/angular-build/_apis/build/status/DagonMetric.angular-build?branchName=master)](https://dev.azure.com/DagonMetric/angular-build/_build/latest?definitionId=3&branchName=master)
[![npm (scoped)](https://img.shields.io/npm/v/@dagonmetric/angular-build.svg)](https://www.npmjs.com/package/@dagonmetric/angular-build)
[![npm](https://img.shields.io/npm/dm/@dagonmetric/angular-build.svg)](https://www.npmjs.com/package/@dagonmetric/angular-build)

# Angular Build & Packaging Tool

[![Gitter](https://badges.gitter.im/DagonMetric/angular-build.svg)](https://gitter.im/DagonMetric/angular-build?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge)

Another tool for building and packaging [Angular](https://angular.io/) application and library projects.

[WIP]

## Prerequisites

* [Node.js](https://nodejs.org/en/download/) requirement:  >= v10.9

## Supported Angular Versions

* Angular v8.0.0-beta.0 or greater

## Features

* Build support for both library projects (internally with [rollup](https://rollupjs.org)) and app projects (internally with [webpack](https://webpack.js.org)).
* This npm package can be consumed by [Angular Cli](https://cli.angular.io), [Webpack Cli](https://www.npmjs.com/package/webpack-cli), or built-in cli.
* Flexable configuration with extendable config options.

### Library Project Build / Packaging Features

Some of [ng-packagr](https://github.com/ng-packagr/ng-packagr) features are included plus

* Can bundles library projects into either [Angular Package Format 8.0](https://docs.google.com/document/d/1CZC2rcpxffTDfRDs6p1cfbmKNLA6x5O-NtkJglDaBVs/preview) (fesm2015, fesm5, umd formats) or custom output formats.
* Can customize ngc typescript transpilations and bundle options.
* Supports secondary entry points such as @angular/common/http, @dagonmetric/ng-config/http-loader.
* Can inline/embed Angular resources such as templateUrl and styleUrls.
* Supports built-in style processing of .css and .scss files.
* Supports style preprocessor options for .scss files.
* Automatic copying and entry point processing of package.json file to output directory.
* Can copy assets (README.md, LICENSE, etc.) to output directory.
* Can replace individual package.json version, name, description, etc with root package.json one or command argument.
* Can replace version placeholder in typescript file.
* Can replace version, package name placeholders in banner file.

### Application Project Build Features

Most of [@angular-devkit/build-angular](https://www.npmjs.com/package/@angular-devkit/build-angular) options are supported plus

* Customizable html injection - can inject bundled scripts, links, resource hints, etc into separate ASP.Net Core MVC partial views.
* DLL bundling support for optimizing build time.
* Can merge built-in webpack configuration with custom webpack configuration.

## Installation

Install [@dagonmetric/angular-build](https://www.npmjs.com/package/@dagonmetric/angular-build) in your project root

npm

```shell
npm install -D @dagonmetric/angular-build
```

or yarn

```shell
yarn add -D @dagonmetric/angular-build
```

## Building / Packaging Library Projects with Built-in Cli

1). Create angular-build.json file as following.

```json
{
  "libs": [{
    "root": "<your src folder>",
    "outputPath": "<your dist folder>",
    "libraryName": "<your library name>",
    "tsTranspilations": true,
    "packageJsonCopy": true,
    "envOverrides": {
      "prod": {
        "banner": "banner.txt",
        "copy": [
          "LICENSE",
          "README.md"
        ],
        "bundles": true
      }
    }
  }]
}
```

See [typescript model](https://github.com/DagonMetric/angular-build/blob/master/src/models/lib-project-config.ts) to learn more about schema and description.

2). Build / bundle your library

```shell
ngb build
```

### Library project demos with angular-build cli

[hello-world-ng-lib](https://github.com/DagonMetric/angular-build/tree/master/samples/hello-world-ng-lib) - Angular library project demo included in this repo.

## Building App Projects with Built-in Cli

1). Create angular-build.json file as following.

```json
{  
  "apps": [
    {
      "name": "browser-app",
      "platformTarget": "web",
      "root": "<your src folder>",
      "outputPath": "<your dist folder>",
      "entry": "main.ts",
      "polyfills": [
        "polyfills.ts"
      ],
      "tsConfig": "tsconfig.app.json",
      "copy": [
        "assets/**/*",
        "favicon.ico"
      ],
      "styles": [
        "styles.scss"
      ],
      "publicPath": "/",
      "baseHref": "/",
      "htmlInject": {
        "resourceHints": true,
        "baseHrefOut": "../../Views/Shared/_BaseHref.generated.cshtml",
        "resourceHintsOut": "../../Views/Shared/_ResourceHints.generated.cshtml",
        "runtimeInlineOut": "../../Views/Shared/_Runtime.generated.cshtml",
        "stylesOut": "../../Views/Shared/_Styles.generated.cshtml",
        "scriptsOut": "../../Views/Shared/_Scripts.generated.cshtml",
        "customAttributes": {
          "asp-append-version": "true"
        }
      },
      "envOverrides": {
        "prod": {
          "fileReplacements": [
            {
              "replace": "environments/environment.ts",
              "with": "environments/environment.prod.ts"
            }
          ]
        }
      }
    }
  ]
}
```

See [typescript model](https://github.com/DagonMetric/angular-build/blob/master/src/models/app-project-config.ts) to learn more about schema and description.

2). Build / bundle your library

```shell
ngb build
```

### App project demos with angular-build cli

[angular-aspnet-core-starter](https://github.com/mmzliveid/angular-aspnet-core-starter) - Angular ASP.Net Core MVC sample project using @dagonmetric/angular-build cli tool.

[hello-world-ng-app](https://github.com/DagonMetric/angular-build/tree/master/samples/hello-world-ng-app) - Angular app project demo included in this repo.

## Build with Angular Cli

1). Make sure you have [Angular Cli](https://www.npmjs.com/package/@angular/cli) version >=8.0.0-beta.7.

2). Create a new ng project with

```shell
ng new myapp1
```

3). Install [@dagonmetric/angular-build](https://www.npmjs.com/package/@dagonmetric/angular-build) in your project root.

npm

```shell
npm install -D @dagonmetric/angular-build
```

or yarn

```shell
yarn add -D @dagonmetric/angular-build
```

4). At your new project, open angular.json file and edit architect builder configuration as shown below.

```json
{
  "projects": {
    "myapp1": {
      "root": "",
      "projectType": "application",
      "architect": {
        "build": {
          "builder": "@dagonmetric/angular-build:app",
          "options": {

          },
        }
      }
    }
  }
}
```

See [AppBuilderOptions](https://github.com/DagonMetric/angular-build/blob/master/src/architect/models/app-builder-options.ts) to learn more about builder options.

5). Build your app

```shell
ng run myapp1:build
```

### App project demos with angular Cli Integration

[angular-build-architect-builder-sample](https://github.com/mmzliveid/angular-build-architect-builder-sample) - Angular starter project with @dagonmetric/angular-build architect builder.

## Feedback and Contributing

Check out the [Contributing](CONTRIBUTING.md) page to see the best places to log issues and start discussions.

## License

This repository is licensed with the [MIT](LICENSE) license.