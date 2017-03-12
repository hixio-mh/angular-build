# v2.0.0  
#### Features  
- added - karma unit test config
- added - protractor e2e test config
- added - custom environment name support
- added - custom webpack config support
- added - service worker
- added - filter in htmlInjectOptions -> customAttributes
  
#### Bug fixes and changes  
- bug fixes, code refactoring and npm packages update  
  
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