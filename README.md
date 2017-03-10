# @bizappframework/angular-build  

## What is this?  
Easy and customizable angular build system based on [angular-cli](https://github.com/angular/angular-cli). Build config file is similar to angular-cli.json but includes some customizations:  
- Webpack config file to project folder in order to integrate with some packages such as [Microsoft.AspNetCore.SpaServices.Webpack](https://github.com/aspnet/JavaScriptServices)  
- DLL bundling support for optimizing webpack build time in development, see [DllPlugin](https://github.com/webpack/docs/wiki/list-of-plugins#dllplugin), [DllReferencePlugin](https://github.com/webpack/docs/wiki/list-of-plugins#dllreferenceplugin)  
- Multiple app configs suitable for client/server apps, see [Angular Universal](https://github.com/angular/universal)  
- Online or offline favicons generation - integration with [realfavicongenerator](http://realfavicongenerator.net) and [haydenbleasel/favicons](https://github.com/haydenbleasel/favicons)  
- Customizable html injection support, single or separate output file(s) for bundled tags (styles, scripts, favicons), and can add custom link and script attribues (such as *asp-append-version*) to injected result  
- Build target overrides support - e.g. for AoT build ->   *"aot": { "main": "main.browser.aot.ts",  "tsconfig": "../tsconfig.webpack.aot.json" }*, for Prod build -> *prod: { "extractCss": true }*  
- Easy configuration with [angular-build.json](https://github.com/BizAppFramework/angular-build/blob/master/configs/angular-build.json)  
  
## Background  
[Angular-Cli](https://github.com/angular/angular-cli) is a great tool for building angular apps! I tried and tested it in my asp.net core angular projects for long weeks. I like its configuration (angular-cli.json) because it is easy and understandable. However, for some environments (such as ASP.Net Core), we want to inject bundled tags to partial views (separate cshtml files), add custom tag attributes (such as defer, asp-append-version), support for server-side prerendering, and more. So we made this package.  
  
## Quick Start:  
Make sure you have Node version >= 6.9.1 and npm >= 3.  
  
#### 1. Installation
For global installation,  
```<language>
npm i @bizappframework/angular-build -g
```
  
Or, for local installation,  
```<language>
npm i @bizappframework/angular-build --save-dev
```
  
#### 2. Download/clone starter repo  
ASP.Net Core (1.1) starter repo  
[angular-build-aspnetcore-starter](https://github.com/mmzliveid/angular-build-aspnetcore-starter)  
    
#### 3. Install dependencies, build and run  
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
