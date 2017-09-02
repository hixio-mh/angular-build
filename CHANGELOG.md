# v4.0.4
- Fixed - rollup deprecation warnings
- updated npm packages

# v4.0.3
- Bug fixed - incorrect path in global scripts html injection 

# v4.0.2
- Updated to .Net Core 2.0.0 in ASP.Net Core template
- Package dependencies updated
- Updated .appveyor and .travis.yml files
- Removed script-loader dependency 'cause it used `eval` instead we use webpack-concat-plugin (ref: [angular-cli](https://github.com/angular/angular-cli/commit/e8f27f029ad89f963547d03afdc06c77550b9ee6))
- Removed json-loader dependency
- Other minor bug fixes and improvements

# v4.0.1
- Package dependencies updated
- support includePaths for less
- 'ngb init' bug fixed on lib project- Error: Cannot convert undefined or null to object - angular-build\src\cli\init\init.ts:468:41
- other improvements and bug fixes in 'ngb init' lib project
- removed - noEmit from TsTranspilation option

# v4.0.0
#### Features
- added - build support for angular lib projects

#### Bug fixes and changes
- bug fixes, code refactoring and npm packages updates  

# v2.0.1  
#### Bug fixes
- bug fix and update packages
  
# v2.0.1  
#### Bug fixes
- bug fix - copy webpack config file  
  
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