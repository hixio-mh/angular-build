//import 'angular2-universal-polyfills/browser'; // This needs to be at the top, Universal neccessary polyfills
// TODO:
import './__2.1.1.workaround.ts'; // temporary until 2.1.1 things are patched in Core
import { enableProdMode, PlatformRef} from '@angular/core';
import { environment } from './environments/environment';

// We're going to let Universal take over the Clients "bootstrap" (instead of the normal platformBrowserDynamic)
import { platformUniversalDynamic } from 'angular2-universal';
import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';

// Grab the browser-specific NgModule, and HMR state management
import { AppBrowserModule } from './app/app.browser.module';
import { handleHmr } from './app';

let platform: PlatformRef;
if (environment.production) {
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
// TODO: replace module with environment
if ((module as any).hot) {
  hmrBootstrap();
} else {
  bootApplication();
}