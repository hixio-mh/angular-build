import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';

import { ORIGIN_URL, REQUEST } from '@nguniversal/aspnetcore-engine';

// app components/modules etc
import { AppModuleShared, appId } from './app.module.shared';
import { AppComponent } from './app.component';

// factories
export function getOriginUrl(): string {
    return window.location.origin;
}

export function getRequest(): any {
    // the Request object only lives on the server
    return { cookie: document.cookie };
}

@NgModule({
    bootstrap: [AppComponent],
    imports: [
        BrowserModule.withServerTransition({
            appId: appId // make sure this matches with your Server NgModule
        }),
        BrowserAnimationsModule,

        AppModuleShared
    ],
    providers: [
        {
            // We need this for our Http calls since they'll be using APP_BASE_HREF (since the Server requires Absolute URLs)
            provide: ORIGIN_URL,
            useFactory: (getOriginUrl)
        },
        {
            provide: REQUEST,
            useFactory: (getRequest)
        }
    ]
})
export class AppModule { }
