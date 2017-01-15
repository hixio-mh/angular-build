# @bizappframework/angular-build

#### What is this repo?
Webpack configuration for Angular 2/4 apps based on [angular-cli](https://github.com/angular/angular-cli), [AngularClass's angular2-webpack-starter](https://github.com/AngularClass/angular2-webpack-starter) and [aspnetcore-angular2-universal](https://github.com/MarkPieszak/aspnetcore-angular2-universal).  
This configuration is utilized for:
- Server-side rendering (see [Angular Universal](https://github.com/angular/universal))  
- HMR - Hot Module Reloading/Replacement (see [Angular Universal](https://github.com/angular/universal))  
- Development builds (JIT/AoT)  
- Production builds (JIT/AoT)  
- Optimizing webpack build times and improving caching with DLL bundles  

## How to Install
```<language>
npm install --save-dev @bizappframework/angular-build  ts-node cross-env
```
## How to use
- Add a new **angular-build.json** file to your project root directory and configure your app build. The following example is minimal configuration.
```<language>
{
  "apps": [
    {
      "root": "src", // Replace with your app source directory.
      "outDir": "wwwroot/dist", // Bundle output directory.
      "publicPath": "/dist/", // Webpack dev middleware, if enabled, handles requests for this URL prefix
      "main": "main.ts", // Replace with your angular main bootstrap file.
      "index": "index.html", // Replace with your index template file.
      "tsconfig": "tsconfig.json" // Replace with yourtsconfig.json relative to app src "root".

    }
  ]
}
```

- Add a new **webpack.config.ts** file to your project root directory and add the following code.
```<language>
import {getWebpackConfigs} from '@bizappframework/angular-build';
const configs = getWebpackConfigs(__dirname);
module.exports = configs;
```  


- (Optional) add npm scripts to **package.json** file.
```<language>
{
  "scripts": {
    "tsc:webpack.config.ts": "tsc webpack.config.ts -t es6 -m commonjs --moduleResolution node --watch --pretty --sourceMap",
    "build:dll": "cross-env NODE_ENV=development webpack --profile --colors --bail",
    "build:dev": "cross-env NODE_ENV=development webpack --profile --colors --bail",
    "build:prod": "cross-env NODE_ENV=production webpack  --profile --colors --bail",
    "build:aot": "cross-env NODE_ENV=production webpack --profile --colors --bail",
    "build": "npm run build:dev",
    "cross-env": "cross-env"
  }
}
```  

- (Optional) compile **webpack.config.ts**, run the following command.
```<language>
npm run-script tsc:webpack.config.ts
```
