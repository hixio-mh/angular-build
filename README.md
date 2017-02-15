# @bizappframework/angular-build

## What is this repo?  
Easy and customizable angular build system based on [angular-cli](https://github.com/angular/angular-cli). Build config file is similar to angular-cli.json but includes some customizations:  
- Webpack config file to project folder in order to integrate with some packages such as [Microsoft.AspNetCore.SpaServices.Webpack](https://github.com/aspnet/JavaScriptServices)    
- DLL bundling support for optimizing webpack build time in development, see [DllPlugin](https://github.com/webpack/docs/wiki/list-of-plugins#dllplugin), [DllReferencePlugin](https://github.com/webpack/docs/wiki/list-of-plugins#dllreferenceplugin)
- Online or offline favicons generation - integration with [realfavicongenerator](http://realfavicongenerator.net) and [haydenbleasel/favicons](https://github.com/haydenbleasel/favicons)
- Customizable html injection support, single or separate output file(s) for bundled result tags (styles, scripts, favicons), and can add custom link and script attribues (such as asp-append-version) to injected result
- Build target overrides support - e.g. for production build - can disable using dll, for aot build - can use different bootstrap main entry
- Easy configuration with [angular-build.json](https://github.com/BizAppFramework/angular-build/blob/master/configs/angular-build.json)     
  
## Quick Start:  
Make sure you have Node version >= 6.9.1 and npm >= 3.  
  
**1. Installation**
```<language>
npm i -g @bizappframework/angular-build
```  

**2. Download/clone ASP.Net Core starter repo and open it in Visual Studio (2015 or later)**  
[angular-build-aspnetcore-starter](https://github.com/mmzliveid/angular-build-aspnetcore-starter)

**3. Install dependencies, build app and run**  
```<language>
# Change to the repo directory
cd <your-repo>

# Restore npm packages
npm install

# Init config files and link @bizappframework/angular-build
ngb init -l

# Wait a few minutes and then build your angular app
ngb build

# Run
Press F5
```  
  

## References:  
[angular/angular-cli](https://github.com/angular/angular-cli)  
[AngularClass/angular2-webpack-starter](https://github.com/AngularClass/angular2-webpack-starter)  
[realfavicongenerator.net](https://realfavicongenerator.net/api/non_interactive_api)  
[jantimon/favicons-webpack-plugin](https://github.com/jantimon/favicons-webpack-plugin)  
[haydenbleasel/favicons](https://github.com/haydenbleasel/favicons)  
[MarkPieszak/aspnetcore-angular2-universal](https://github.com/MarkPieszak/aspnetcore-angular2-universal)