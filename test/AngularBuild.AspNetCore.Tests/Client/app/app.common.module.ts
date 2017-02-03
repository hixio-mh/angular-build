/*
 * _Common_ NgModule to share between our "BASE" App.Browser & App.Server module platforms
 *
 *  If something belongs to BOTH, just put it Here.
 * - If you need something to be very "platform"-specific, put it
 *   in the specific one (app.browser or app.server)
 */

// Modules
import { NgModule, APP_INITIALIZER} from '@angular/core';
import {StoreModule } from '@ngrx/store';
import { EffectsModule } from '@ngrx/effects';

//import { LocaleModule, LocalizationModule } from 'angular2localization';
//import { TranslateModule } from 'ng2-translate';

import { CoreModule } from './core/core.module';
import { AppRoutingModule } from './app.routing.module';
import { DashboardModule } from './dashboard/dashboard.module';

// Providers
//import { AppSettings } from './app.settings';

// Components
import { AppComponent } from './app.component';


// This imports the variable that, in a hot loading situation, holds
// a reference to the previous application's last state before
// it was destroyed.
import {  appState, appReducer } from './core';
//import { initLocalization, LocalizationConfig } from './core';

// Material design
//import { IonicModule} from 'ui';
//import { IonicModule } from '../ui';
//import { MaterialModule } from '@angular/material';

@NgModule({
  //bootstrap: [AppComponent],
  imports: [
    CoreModule,

    // NgRx
    StoreModule.provideStore(appReducer, appState),
    EffectsModule,

    // Routing
    AppRoutingModule,

    // Locations
    //LocaleModule.forRoot(), // New instance of LocaleService.
    //LocalizationModule.forRoot(), // New instance of LocalizationService.
    //TranslateModule.forRoot(),

    // Material
    //IonicModule.forRoot(),

    // Proloaded modules
    DashboardModule
  ],
  declarations: [
    AppComponent
  ]
  //providers: [
  //  LocalizationConfig,
  //  {
  //    provide: APP_INITIALIZER, // APP_INITIALIZER will execute the function when the app is initialized and delay what it provides.
  //    useFactory: initLocalization,
  //    deps: [LocalizationConfig],
  //    multi: true
  //  }
  //  //ApiGatewayService,
  //  //AppSettings
  //]
})
export class AppCommonModule {}
