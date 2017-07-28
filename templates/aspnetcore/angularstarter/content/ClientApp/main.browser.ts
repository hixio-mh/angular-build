import { ApplicationRef, enableProdMode } from '@angular/core';
import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';
import { enableDebugTools } from '@angular/platform-browser';

import { handleHmr } from './handle-hmr';

import { AppModule } from './app/app.module.browser';

if (PRODUCTION) {
    enableProdMode();
}

platformBrowserDynamic().bootstrapModule(AppModule)
    .then(ngModuleRef => {
        if (!PRODUCTION) {
            // Grab a reference to the running Angular application.
            const appRef = ngModuleRef.injector.get(ApplicationRef) as ApplicationRef;
            const cmpRef = appRef.components[0];

            const ng = (window as any).ng;
            enableDebugTools(cmpRef);
            (window as any).ng.probe = ng.probe;
            (window as any).ng.coreTokens = ng.coreTokens;

            if (module.hot) {
                handleHmr(ngModuleRef, module);
            }
        }
    });
