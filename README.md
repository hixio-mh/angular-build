# angular-build

![Build status](https://ci.appveyor.com/api/projects/status/3srmiuom52hs9b82?svg=true)

## What is this?

Build system for Angular app and lib projects. This is similar to [angular-cli](https://github.com/angular/angular-cli) with some features and customizations. Some of those are:

- Build support for library projects (internally with [rollup](https://github.com/rollup/rollup)) and app projects (internally with [webpack](https://github.com/webpack/webpack))
- DLL bundling support for optimizing build time in development, see [DllPlugin](https://github.com/webpack/docs/wiki/list-of-plugins#dllplugin), [DllReferencePlugin](https://github.com/webpack/docs/wiki/list-of-plugins#dllreferenceplugin)
- Multiple project configs support
- Cross-platform favicons generation (online/offline)- integration with [realfavicongenerator](http://realfavicongenerator.net) and [haydenbleasel/favicons](https://github.com/haydenbleasel/favicons)
- Customizable html injection support - can inject scripts, styles, favicons, etc into separate partial views
- Can work with [Microsoft ASP.NET Core Spa Services](https://github.com/aspnet/JavaScriptServices)
- Can use webpack config files to build directly with webpack

## Prerequisites

Make sure you have [Node](https://nodejs.org/en/download/) version >= 6.9.1 and npm >= 3. 

## Table of Contents

* [Installation](#installation)
* [Create, build and run a new Angular Starter app](#create-build-and-run-a-new-angular-starter-app)
* [Create, build and run a new ASP.Net Core Angular Universal Starter app](#create-build-and-run-a-new-aspnet-core-angular-universal-starter-app)
* [Build your existing library/app project](#build-your-existing-libraryapp-project)
* [More about ngb](#more-about-ngb)
* [angular-build.json config file](#angular-buildjson-config-file)
* [favicon-config.json config file](#favicon-configjson-config-file)
* [License](#license)

## Installation

**BEFORE YOU INSTALL:** please read the [prerequisites](#prerequisites)
```bash
npm install -g @bizappframework/angular-build
```

## Create, build and run a new Angular Starter app

1. In command prompt or terminal, type '**ngb new**'.
2. Choose '**Angular Starter**' template (Use down arrow key and then press Enter/Return key).
3. Enter project name (e.g. ng-app1).
4. Go to your newly created project directory and run **ngb build**.
5. To run the app, run '**npm run http-server**'.

## Create, build and run a new ASP.Net Core Angular Universal Starter app

**BEFORE YOU START:** make sure dotnet core version >= 2.0.0-preview2 is installed by typing '**dotnet --version**' in command prompt or terminal. [.Net Core Download Page](https://www.microsoft.com/net/download/core).

1. In command prompt or terminal, type '**ngb new**'.
2. Choose '**ASP.NET Core Angular Universal Starter**' template.
3. Enter project name (e.g. WebApplication1).
4. Go to your newly created project directory and run **ngb build**.
5. To run the app, run '**dotnet run**'.

## Build your existing library/app project

1. Go to your project directory and run **ngb init** to init configuration files.
2. To build your project, run '**ngb build**'.

## More about ngb

```bash
ngb --help
```

## angular-build.json config file

The main configuration file to build your angular project.

```<language>
{
  "apps": [
    {
      // Your angular app src directory.
      "srcDir": "ClientApp",

      // The output directory for build results.
      "outDir": "wwwroot",

      // The main entry file to be bundled.
      "entry": "main.browser.ts",

      // List of assets to be copied to bundle output location.
      "assets": [
        "favicon.ico",
        {
          "from": "assets/**/*",
          "to": "assets"
        }
      ],

      // Global style entries to be included in the build.       
      "styles": [
        "styles.scss"
      ],      

      // The polyfill entries for app.
      "polyfills": [
        "core-js/es6/reflect",
        "core-js/es7/reflect",
        "zone.js/dist/zone"
      ],

      // The typescript configuration file
      "tsconfig": "tsconfig.app.json",

      // The favicon configuration file.
      "faviconConfig": "favicon-config.json",

      // The public url address of the output files.
      "publicPath": "/",

      // The html injection options.
      "htmlInjectOptions": {
        "index": "index.html"
      },

      // Build target overrides
      "envOverrides": {

        // For development build
        "dev": {
          "referenceDll": true
        },

        // For production build
        "prod": {
          "moduleReplacements": [
            {
              "resourcePath": "environments/environment.ts",
              "newResourcePath": "environments/environment.prod.ts"
            }
          ]
        }
      }
    }
  ]
}
```

The typescript model is [here](https://github.com/BizAppFramework/angular-build/blob/master/src/models/public-models.ts).

## favicon-config.json config file

The configuration file for cross-platform favicons generation.

```<language>
{
  // Your API key. No key yet? Register it now.
  "apiKey": "87d5cd739b05c00416c4a19cd14a8bb5632ea563",

  // Indicate how the master picture (used to generate the various favicon pictures) is transmitted to RealFaviconGenerator.
  "masterPicture": "favicon.svg",

  // These values reflect the various choices offered when you generate a favicon manually.
  "design": {
    "desktopBrowser": {},
    "androidChrome": {
      "pictureAspect": "noChange",
      "assets": {
        "legacyIcon": false,
        "lowResolutionIcons": false
      }
    },
    "ios": {
      "pictureAspect": "backgroundAndMargin",
      "margin": "0",
      "assets": {
        "declareOnlyDefaultIcon": true
      }
    }
  },

  // The background color applied as the background of the icon.
  "background": "#ffffff",

  // Use online realfavicongenerator.net only.
  "online": false,

  // If true, first try to generate using realfavicongenerator.net, if failed, use local generator.
  "preferOnline": true
}
```

For more information see  [realfavicongenerator.net](https://realfavicongenerator.net/api/non_interactive_api#.WKUizzt96Uk), ** note use lower camel case instead and replace 'favicon_design' with 'design'.  
The typescript model is [here](https://github.com/BizAppFramework/angular-build/blob/master/src/plugins/icon-webpack-plugin/src/interfaces.ts)  

## License

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg?style=flat)](/LICENSE) 
