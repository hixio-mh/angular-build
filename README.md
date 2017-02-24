# @bizappframework/angular-build  

## What is this repo?  
Easy and customizable angular build system based on [angular-cli](https://github.com/angular/angular-cli). Build config file is similar to angular-cli.json but includes some customizations:  
- Webpack config file to project folder in order to integrate with some packages such as [Microsoft.AspNetCore.SpaServices.Webpack](https://github.com/aspnet/JavaScriptServices)    
- DLL bundling support for optimizing webpack build time in development, see [DllPlugin](https://github.com/webpack/docs/wiki/list-of-plugins#dllplugin), [DllReferencePlugin](https://github.com/webpack/docs/wiki/list-of-plugins#dllreferenceplugin)  
- Multiple app configs suitable for client/server apps, see [Angular Universal](https://github.com/angular/universal)  
- Online or offline favicons generation - integration with [realfavicongenerator](http://realfavicongenerator.net) and [haydenbleasel/favicons](https://github.com/haydenbleasel/favicons)  
- Customizable html injection support, single or separate output file(s) for bundled tags (styles, scripts, favicons), and can add custom link and script attribues (such as *asp-append-version*) to injected result  
- Build target overrides support - e.g. for AoT build ->   *"aot": { "main": "main.browser.aot.ts",  "tsconfig": "../tsconfig.webpack.aot.json" }*, for Prod build -> *prod: { "extractCss": true,  "compressAssets": true }*  
- Easy configuration with [angular-build.json](https://github.com/BizAppFramework/angular-build/blob/master/configs/angular-build.json)  
  
**Note: This is NOT a replacement for angular-cli, but only for build/bundle process customization.  
  
## Background  
[Angular-Cli](https://github.com/angular/angular-cli) is a great tool for building angular apps! I tried and tested it in my asp.net core angular projects for long weeks. I like its configuration (angular-cli.json) because it is easy and understandable. However, for some environments (such as ASP.Net Core), we want to inject bundled tags to partial views (separate html files), add custom tag attributes (such as defer, asp-append-version), support for server-side prerendering, and more. So we decided to make this package.    

## Quick Start:  
Make sure you have Node version >= 6.9.1 and npm >= 3.  
  
**1. Installation**  
For global installation,  
```<language>
npm i -g @bizappframework/angular-build
```  
  
Or, for local installation,  
```<language>
npm i --save-dev @bizappframework/angular-build
```  
  
**2. Download/clone starter repo**  
ASP.Net Core (1.1) starter repo  
[angular-build-aspnetcore-starter](https://github.com/mmzliveid/angular-build-aspnetcore-starter)  
    
**3. Install dependencies, build and run**  
```<language>
# Change to the repo directory
cd <your-repo>

# Restore npm packages
npm install

# Init config files 
# Note: If you installed globally, run 'ngb init -l' to link global installed @bizappframework/angular-build
ngb init  

# Wait a few minutes and then build your angular app
ngb build

# Run your app
```  
  
## Ways to build your angular apps:  
You can build your angular apps using one of the following ways.  
  
**1.** Using **ngb build** / **angular-build build** cli command   
For dll build:  
```<language>
ngb build --dll
```  
  
For development build:  
```<language>
ngb build
```  

For production build:  
```<language>
ngb build --production
```  

For production AoT build:  
```<language>
ngb build --aot
```  

For production Universal AoT build:  
```<language>
ngb build --aot --universal
```  
  
For more info, type '*ngb build -h*'   
  
```<language>
angular-build 1.0.8

Usage:
  ngb build [options...]

Options:
  -h                     Show help                                     [boolean]
  --project              The target project location                    [string]
  --watch                Build/bundle the app(s) with watch mode       [boolean]
  --aot                  Set true for aot target.                      [boolean]
  --app                  To build only specific app. Use app's name.
  --append-output-hash   Appends version hash to the ouput files.      [boolean]
  --compress-assets      Compress assets.                              [boolean]
  --config-file-path     The 'angular-build.json' config file path.     [string]
  --dll                  Set true for dll build.                       [boolean]
  --extract-css          Extracts css.                                 [boolean]
  --performance-hint     Show performance hints.                       [boolean]
  --production           Set true for production.                      [boolean]
  --progress             Shows progress.                               [boolean]
  --reference-dll        To reference dlls for all apps.               [boolean]
  --skip-copy-assets     Skips copying assets.                         [boolean]
  --skip-generate-icons  Skips generating icons.                       [boolean]
  --source-map           Generates sourcemaps.                         [boolean]
  --universal            Set true for universal target.                [boolean]
  --verbose              If true, the console displays detailed diagnostic
                         information.                                  [boolean]
```  
  
**2.** Using **npm scripts**   
```<language>
#For dll build:
npm run build:dll

#For development build:
npm run build

#For production build:
npm run build:prod

#For production AoT build:
npm run build:aot

#For production Universal AoT build:
npm run build:universal:aot
```  
     
**3.** Using **WebpackDevMiddleware - ([Microsoft.AspNetCore.SpaServices.Webpack](https://github.com/aspnet/JavaScriptServices))**  

Add the following code to Startup.cs. See [angular-build-aspnetcore-starter](https://github.com/mmzliveid/angular-build-aspnetcore-starter) repo.  
```<language>
public void Configure(IApplicationBuilder app, IHostingEnvironment env, ILoggerFactory loggerFactory)
{
    // Other configurations...

    if (env.IsDevelopment())
    {
        app.UseWebpackDevMiddleware(new WebpackDevMiddlewareOptions
        {
          ConfigFile = "webpack.config.js",
          HotModuleReplacement = true
        });
    }
    
    // Other configurations...

```  
  
## More about ngb init:  
```<language>
# To init required config file for your app
ngb init

# To ask/prompt
ngb init -p

# To link globally installed angular-build cli with your project
ngb init -l

# More about init, show help
ngb init -h
```  
  
## Files:  
#### angular-build.json  
The main configuration file to build your angular apps. It is similar to [angular-cli](https://github.com/angular/angular-cli) config file - '*angular-cli.json*'. The following is an example configuration.  
```<language>
{
  "apps": [
    {
      // The root directory of angular app.
      "root": "Client",

      // The output directory of bundled assets.
      "outDir": "wwwroot",

      // The entry for app main bootstrap file.
      "main": "main.browser.ts",

      // The asset entries to be copied to output directory.
      "assets": [
        "assets/**/*"
      ],

      // Global script entries to be included in the build. Supported styles are .css, .scss, .less and .stylus.
      "styles": [
        "styles.scss"
      ],

      // Script entries to be added to the global scope.
      "scripts": [],

      // The entries for app polyfills to be imported to the main entry.
      "polyfills": [
        "polyfills.browser.ts"
      ],

      // The entries for dll bundle.
      "dlls": [
        {
          "entry": "rxjs.imports.ts",
          "importToMain": true
        },
        {
          "entry": "../package.json",
          "excludes": [
            "core-js",
            "zone.js"
          ]
        }
      ],

      // The typescript configuration file
      "tsconfig": "../tsconfig.webpack.json",

      // The favicon configuration file.
      "faviconConfig": "favicon-config.json",

      // The public url address of the output files.
      "publicPath": "/",

      // The html injection options.
      "htmlInjectOptions": {
        "indexOutFileName": "../Views/Shared/_BundledScripts.cshtml",
        "iconsOutFileName": "../Views/Shared/_FavIcons.cshtml",
        "stylesOutFileName": "../Views/Shared/_BundledStyles.cshtml",
        "customTagAttributes": [
          {
            "tagName": "link",
            "attribute": {
              "asp-append-version": true
            }
          },
          {
            "tagName": "script",
            "attribute": {
              "asp-append-version": true
            }
          }
        ]
      },

      // Source file for environment config.
      "environmentSource": "environments/environment.ts",

      // Build target overrides
      "buildTargetOverrides": {
        // For aot build with ngc, by default it uses ngtools/webpack if main entry does not end with *.aot.ts
        "aot": {
          "main": "main.browser.aot.ts",
          "tsconfig": "../tsconfig.webpack.aot.json"
        },

        // For universal build
        "universal": {
          "main": "main.universal.browser.ts"
        },

        // For development build
        "dev": {
          // Default - true
          "referenceDll": true
        },

        // For production build
        "prod": {
           // The environment file for the build target
           "environmentFile": "environments/environment.prod.ts",

          // Default - true
          "compressAssets": true,

          // Default - false
          "sourceMap": false,

          // Default - true
          "extractCss": true,

          // Module replacement for production build
          "moduleReplacements": [
            {
              "resourceRegExp": "angular2-hmr",

              // Path is relative to project root dir, Default - angular-build's empty.js module
              "newResource": "empty.js"
            }
          ]
        }
      }
    }
  ]
}
```  
  
The typescript model is [here](https://github.com/BizAppFramework/angular-build/blob/master/src/models/index.ts).  
  
### webpack.config.js  
```<language>
const getWebpackConfigs = require('@bizappframework/angular-build').getWebpackConfigs;
const configs = getWebpackConfigs(__dirname);
module.exports = configs;
```  

Pre-configured webpack config models for your angular apps can be get by **getWebpackConfigs** function. The role of this function is to provide webpack config models by parsing **angular-build.json** file.  
If you use **ngb build** cli command, this file will be skiped.   
  
### favicon.config.json  
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
  "preferOnline": true,

  // Apply custom attributes defined in htmlInjectOptions of angular-build.json
  "applyCustomAttributes": false
}
```  
For more information see  [realfavicongenerator.net](https://realfavicongenerator.net/api/non_interactive_api#.WKUizzt96Uk), ** note use lower camel case instead and replace 'favicon_design' with 'design'.  
The typescript model is [here](https://github.com/BizAppFramework/angular-build/blob/master/src/plugins/icon-webpack-plugin/src/models.ts)  
    
## References:  
[angular/angular-cli](https://github.com/angular/angular-cli)  
[AngularClass/angular2-webpack-starter](https://github.com/AngularClass/angular2-webpack-starter)  
[realfavicongenerator.net](https://realfavicongenerator.net/api/non_interactive_api)  
[jantimon/favicons-webpack-plugin](https://github.com/jantimon/favicons-webpack-plugin)  
[haydenbleasel/favicons](https://github.com/haydenbleasel/favicons)  
[MarkPieszak/aspnetcore-angular2-universal](https://github.com/MarkPieszak/aspnetcore-angular2-universal)  