import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';
import { enableProdMode } from '@angular/core';

import { AppModule } from './app/app.module.browser';

enableProdMode();
platformBrowserDynamic().bootstrapModule(AppModule);
