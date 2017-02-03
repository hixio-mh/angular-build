import { NgModule } from '@angular/core';
// for AoT we need to manually split universal packages (/browser & /node)
import { UniversalModule, isBrowser, isNode, AUTO_PREBOOT } from 'angular2-universal/browser';
//import { BrowserModule } from '@angular/platform-browser';

import { StoreDevtoolsModule } from '@ngrx/store-devtools';
//import { Store, StoreModule } from '@ngrx/store';

// Bootstrap module
import { AppCommonModule} from './app.common.module';

// Bootstrap component
import { AppComponent } from './app.component';

// Universal : XHR Cache
import { CacheService } from './core';

// ReSharper disable once InconsistentNaming
export const UNIVERSAL_KEY = 'UNIVERSAL_CACHE';
export function getRequest() {
  return {};
}
export function getResponse() {
  return {};
}

@NgModule({
  bootstrap: [AppComponent],
  imports: [
    // "UniversalModule" Must be first import.
    // ** NOTE ** : This automatically imports BrowserModule, HttpModule, and JsonpModule for Browser,
    // and NodeModule, NodeHttpModule etc for the server.
    UniversalModule,

    AppCommonModule,

    // NgRx
    StoreDevtoolsModule.instrumentOnlyWithExtension()
  ],
  providers: [
    // Angular -Universal- providers below ::
    { provide: 'isBrowser', useValue: isBrowser },
    { provide: 'isNode', useValue: isNode },
    { provide: 'req', useFactory: getRequest },
    { provide: 'res', useFactory: getResponse }
    // Universal concept. Uncomment this if you want to Turn OFF auto preboot complete
    // { provide: AUTO_PREBOOT, useValue: false }
  ]
})
export class AppBrowserModule {

  constructor(public cache: CacheService) {
    this.doRehydrate();
  }

  // Universal Cache "hook"
  doRehydrate() {
    let defaultValue = {};
    let serverCache = this._getCacheValue(CacheService.KEY, defaultValue);
    this.cache.rehydrate(serverCache);
  }

  // Universal Cache "hook
// ReSharper disable once InconsistentNaming
  _getCacheValue(key: string, defaultValue: any): any {
    // Get cache that came from the server
    const win: any = window;
    if (win[UNIVERSAL_KEY] && win[UNIVERSAL_KEY][key]) {
      let serverCache = defaultValue;
      try {
        serverCache = JSON.parse(win[UNIVERSAL_KEY][key]);
        if (typeof serverCache !== typeof defaultValue) {
          console.log('Angular Universal: The type of data from the server is different from the default value type');
          serverCache = defaultValue;
        }
      } catch (e) {
        console.log('Angular Universal: There was a problem parsing the server data during rehydrate');
        serverCache = defaultValue;
      }
      return serverCache;
    } else {
      console.log('Angular Universal: UNIVERSAL_CACHE is missing');
    }
    return defaultValue;
  }
}
