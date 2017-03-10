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
