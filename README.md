angular-build
=====================

<!-- Badges section here. -->
[![Build Status](https://dev.azure.com/bizappframework/BizAppFramework/_apis/build/status/BizAppFramework.angular-build)](https://dev.azure.com/bizappframework/BizAppFramework/_build/latest?definitionId=35)
[![Build status](https://img.shields.io/appveyor/ci/mmzliveid/angular-build.svg?label=appveyor)](https://ci.appveyor.com/project/mmzliveid/angular-build)
[![Build Status](https://img.shields.io/travis/BizAppFramework/angular-build/master.svg?label=travis)](https://travis-ci.org/BizAppFramework/angular-build)
[![npm version](https://badge.fury.io/js/%40bizappframework%2Fangular-build.svg)](https://badge.fury.io/js/%40bizappframework%2Fangular-build)
[![Dependency Status](https://david-dm.org/bizappframework/angular-build.svg)](https://david-dm.org/bizappframework/angular-build)
[![npm](https://img.shields.io/npm/dm/@bizappframework/angular-build.svg)](https://www.npmjs.com/package/@bizappframework/angular-build)
[![Gitter](https://badges.gitter.im/BizAppFramework/angular-build.svg)](https://gitter.im/BizAppFramework/angular-build?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge)

What is this
---------------

Another build tool for [Angular](https://github.com/angular/angular) application and library projects based on [Anglar CLI](https://github.com/angular/angular-cli).

Features
---------------

- Build support for both [library projects](https://github.com/BizAppFramework/angular-build/wiki/Build-Library-Projects) (internally with [rollup](https://github.com/rollup/rollup)) and [app projects](https://github.com/BizAppFramework/angular-build/wiki/Build-App-Projects) (internally with [webpack](https://github.com/webpack/webpack))
- This npm package can be consumed by [Angular CLI](https://github.com/BizAppFramework/angular-build/wiki/Angular-CLI-Integration), [Webpack CLI](https://github.com/BizAppFramework/angular-build/wiki/Webpack-CLI-Integration), or [Built-in CLI](https://github.com/BizAppFramework/angular-build/wiki/Build-with-Built-in-CLI)
- Bundle your library in fesm2015, fesm5, umd formats, and [more](https://github.com/BizAppFramework/angular-build/wiki/Build-Library-Projects)
- [DLL bundling](https://github.com/BizAppFramework/angular-build/wiki/DLL-Bundling) support for optimizing build time, internally using [DllPlugin](https://github.com/webpack/docs/wiki/list-of-plugins#dllplugin), [DllReferencePlugin](https://github.com/webpack/docs/wiki/list-of-plugins#dllreferenceplugin)
- Flexable configurations with [Extendable config options](https://github.com/BizAppFramework/angular-build/wiki/Extending-Configs) - [Customizable html injection](https://github.com/BizAppFramework/angular-build/wiki/Custom-Html-Injection), can inject bundled scripts, links, resource hints, etc into separate files or [ASP.Net Core MVC](https://docs.microsoft.com/en-us/aspnet/core/mvc/overview) partial views
- Support to [merge with custom webpack config](https://github.com/BizAppFramework/angular-build/wiki/Merge-with-Custom-Webpack-Config)

Prerequisites
---------------

Make sure you have [Node](https://nodejs.org/en/download/) version >= 8.9 and npm >= 5.5.1.

Installation
---------------

**BEFORE YOU INSTALL:** please read the [prerequisites](#prerequisites)

```bash
npm install -g @bizappframework/angular-build
```

How to use
---------------

See [Wiki](https://github.com/BizAppFramework/angular-build/wiki).

Feedback
---------------

Check out the [contributing](https://github.com/BizAppFramework/angular-build/blob/master/CONTRIBUTING.md) page to see the best places to log issues and start discussions.

License
---------------

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg?style=flat)](/LICENSE)