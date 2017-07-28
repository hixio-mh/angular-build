import 'core-js/es6/reflect';
import 'core-js/es7/reflect';

// import 'reflect-metadata';

import 'zone.js';
import 'zone.js/dist/zone-node';

import { enableProdMode } from '@angular/core';

import { BootFuncParams, createServerRenderer } from 'aspnet-prerendering';
import { ngAspnetCoreEngine, IEngineOptions } from '@nguniversal/aspnetcore-engine';

import { AppModule } from './app/app.module.server';
import { SERVER_DATA, TRANSFER_DATA_RESULT } from './app/tokens';

if (PRODUCTION) {
    enableProdMode();
}

export default createServerRenderer((params: BootFuncParams) => {
    params.data.serverData = params.data.serverData || {};
    params.data.transferDataResult = params.data.transferDataResult || { script: '' };
    const setupOptions: IEngineOptions = {
        appSelector: '<app></app>',
        ngModule: AppModule,
        request: params,
        providers: [
            {
                provide: TRANSFER_DATA_RESULT,
                useValue: params.data.transferDataResult
            },
            {
                provide: SERVER_DATA,
                useValue: params.data.serverData
            }
        ]
    };

    return ngAspnetCoreEngine(setupOptions).then(response => {
        if (!!params.data.transferDataResult && params.data.transferDataResult.script) {
            response.globals.transferData = params.data.transferDataResult.script;
        }

        return ({
            html: response.html,
            globals: response.globals
        });
    });
});
