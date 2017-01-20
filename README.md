# @bizappframework/angular-build

#### What is this repo?
Webpack configuration for Angular 2/4 apps based on [angular-cli](https://github.com/angular/angular-cli), [AngularClass's angular2-webpack-starter](https://github.com/AngularClass/angular2-webpack-starter) and [Angular Universal](https://github.com/angular/universal).  
This configuration is utilized for:
- Server-side rendering (see [Angular Universal](https://github.com/angular/universal))  
- HMR - Hot Module Reloading/Replacement (see [Angular Universal](https://github.com/angular/universal))  
- Development builds (JIT/[AoT](https://angular.io/docs/ts/latest/cookbook/aot-compiler.html))  
- Production builds (JIT/[AoT](https://angular.io/docs/ts/latest/cookbook/aot-compiler.html))  
- Optimizing webpack build times with DLL bundles (see [DllPlugin](https://github.com/webpack/docs/wiki/list-of-plugins#dllplugin), [DllReferencePlugin](https://github.com/webpack/docs/wiki/list-of-plugins#dllreferenceplugin))
- Online or offline favicons generation - integration with [realfavicongenerator](http://realfavicongenerator.net) and [haydenbleasel favicons](https://github.com/haydenbleasel/favicons)
- Easy configuration with [angular-build.json](https://github.com/BizAppFramework/angular-build/blob/master/config/angular-build.json) or [angular-cli.json](https://github.com/angular/angular-cli)   

## How to Install
```<language>
// Angular dependencies
npm install --save @angular/core @angular/compiler reflect-metadata rxjs zone.js

// Other dependencies
npm install --save-dev  @angular/compiler-cli @ngtools/webpack typescript ts-node cross-env rimraf 

// main package
npm install --save-dev @bizappframework/angular-build
```  

## Init configurations
```<language>
angular-build init --prompt
```  

## Builds
```<language>
// For dll bundle only
npm run build:dll

// For debug/development build
npm run build:dev

// For production JIT build
npm run build:prod

// For production AoT build
npm run build:aot
```  
