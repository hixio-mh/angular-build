import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { ServerModule } from '@angular/platform-server';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

import { appId, AppModuleShared } from './app.module.shared';
import { AppComponent } from './app.component';

@NgModule({
    bootstrap: [AppComponent],
    imports: [
        BrowserModule.withServerTransition({
            appId: appId // 'my-app-id', make sure this matches with your Browser NgModule
        }),
        ServerModule,
        NoopAnimationsModule,

        AppModuleShared
    ],
    providers: []
})
export class AppModule {
    // ** Make sure to define this an arrow function to keep the lexical scope
    ngOnBootstrap = () => {
        console.log('\nngOnBootstrap');
    }
}
