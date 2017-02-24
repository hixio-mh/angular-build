# v1.0.8  
#### Features  
- added universal property to BuildOptions  
- added - inlineChunk to AppConfig  
- added - vendorChunk to AppConfig  
- added - build:dev:universal to npm srcipts 
- added - build:prod:universal to npm srcipts 
      
#### Bug fixes  
    
#### Changes  
- in init, moved @angular deps to package.json -> dependencies section  
- removed - 'npm run clean:aot-compiled' from package.json -> scripts -> 'prebuild:aot'  
- removed - 'prebuild:prod' from npm scripts
- TODO: - Error: loaderUtils.parseQuery() received a non-string value which can be problematic  
  
# v1.0.7  
#### Bug fixes  
- fixed loaderUtils warnings  
  
#### Changes  
- updated some npm packages  
  
# v1.0.6  
#### Bug fixes  
- fixed problem on copy assets  
  
#### Changes  
- changed schema in angular-build.json
- changed AppConfig model
- changed source-map output file name to [file].map 
- changed to skip generating source-maps on dll build  
- made minor changes to files in src/webpack-configs/*
- updated some npm packages  
    
# v1.0.5  
#### Features  
Configuration and build/bundling process are similar or same as [angular/angular-cli](https://github.com/angular/angular-cli)'s [v1.0.0-beta.30](https://github.com/angular/angular-cli/releases/tag/v1.0.0-beta.30), plus:
- local webpack config file (.ts or .js) support  
- DLL bundling support  
- online or offline favicons generation  
- customizable html injection support  
- build target overrides support  