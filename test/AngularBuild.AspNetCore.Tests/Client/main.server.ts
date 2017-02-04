// TODO:
import './__2.1.1.workaround.ts';
import 'angular2-universal-polyfills/node';
import 'zone.js';

//import 'tslib';

import { createServerRenderer, RenderResult } from 'aspnet-prerendering';
import { enableProdMode } from '@angular/core';
import { platformNodeDynamic } from 'angular2-universal';

// Grab the (Node) server-specific NgModule
import { AppServerModule } from './app/app.server.module';
import { metaStore } from './app/core';

enableProdMode();

const platform = platformNodeDynamic();

// declare var Zone: any;

export default createServerRenderer(params => {
    // Our Root application document
    const doc = '<app-root></app-root>';

  return new Promise<RenderResult>((resolve, reject) => {
    const requestZone = Zone.current.fork({
      name: 'angular-universal request',
      properties: {
          ngModule: AppServerModule,
        baseUrl: '/',
        requestUrl: params.url,
        originUrl: params.origin,
        preboot: false,
        document: doc
      },
      onHandleError: (parentZone, currentZone, targetZone, error) => {
        // If any error occurs while rendering the module, reject the whole operation
        reject(error);
        return true;
      }
    });

    return requestZone.run<Promise<string>>(() => platform.serializeModule(AppServerModule)).then(html => {
        resolve({ html: html, globals: metaStore });
    }, reject);
  });
});