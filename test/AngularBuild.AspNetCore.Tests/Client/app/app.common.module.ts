// Modules
import { NgModule, APP_INITIALIZER} from '@angular/core';
import {StoreModule } from '@ngrx/store';
import { EffectsModule } from '@ngrx/effects';

import { CoreModule } from './core/core.module';
import { AppRoutingModule } from './app.routing.module';
import { DashboardModule } from './dashboard/dashboard.module';

// Providers
import { AppSettings } from './app.settings';

// Components
import { AppComponent } from './app.component';


// This imports the variable that, in a hot loading situation, holds
// a reference to the previous application's last state before
// it was destroyed.
import { appState, appReducer, Meta, RxContextDirective } from './core';

@NgModule({
  //bootstrap: [AppComponent],
  imports: [
    CoreModule,

    // NgRx
    StoreModule.provideStore(appReducer, appState),
    EffectsModule,

    // Routing
    AppRoutingModule,

    // Proloaded modules
    DashboardModule
  ],
  declarations: [
      AppComponent,
      RxContextDirective
  ]
  providers: [
      Meta, // MetaService is a cross platform way to change title, and update anything in the <head>
    AppSettings
  ]
})
export class AppCommonModule {}
