//import 'angular2-universal-polyfills/browser'; // This needs to be at the top, Universal neccessary polyfills
// TODO:
//import './__2.1.1.workaround.ts'; // temporary until 2.1.1 things are patched in Core

// OTE: Starting Typescript 2.1 this package won't be needed anymore
//import 'ts-helpers';


// import 'core-js/es6';
// Added parts of es6 which are necessary for your project or your browser support requirements.
//import 'core-js/es6/symbol';
//import 'core-js/es6/object';
//import 'core-js/es6/function';
//import 'core-js/es6/parse-int';
//import 'core-js/es6/parse-float';
//import 'core-js/es6/number';
//import 'core-js/es6/math';
//import 'core-js/es6/string';
//import 'core-js/es6/date';
//import 'core-js/es6/array';
//import 'core-js/es6/regexp';
//import 'core-js/es6/map';
//import 'core-js/es6/set';
//import 'core-js/es6/weak-map';
//import 'core-js/es6/weak-set';
//import 'core-js/es6/typed';
//import 'core-js/es6/reflect';
//// see issue https://github.com/AngularClass/angular2-webpack-starter/issues/709
//// import 'core-js/es6/promise';

//import 'core-js/es7/reflect';
//import 'zone.js/dist/zone';

// Typescript emit helpers polyfill
//import 'ts-helpers';
//require('zone.js/dist/long-stack-trace-zone');

import 'es6-shim';
import 'es6-promise';
import 'reflect-metadata';

  // zone.js
import 'zone.js/dist/zone';

// --------------------------------------------------------------------------------
import { enableProdMode, PlatformRef} from '@angular/core';
import { environment } from './environments/environment';

// We're going to let Universal take over the Clients "bootstrap" (instead of the normal platformBrowserDynamic)
//import { platformUniversalDynamic } from 'angular2-universal';
import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';

// Grab the browser-specific NgModule, and HMR state management
import { AppBrowserModule } from './app/app.browser.module';
import { handleHmr } from './app';

let platform: PlatformRef;
if (process.env.ENV === 'production' || environment.production) {
    enableProdMode();
    //platform = platformUniversalDynamic();
    platform = platformBrowserDynamic();
} else {
  // Development mode
  platform = platformBrowserDynamic();
}

// Boot the application normally
const bootApplication = () => platform.bootstrapModule(AppBrowserModule);

// HMR bootstrap overload
const hmrBootstrap = () => { handleHmr(module, bootApplication); };
if ((<any>module).hot) {
  hmrBootstrap();
} else {
  bootApplication();
}
