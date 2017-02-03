import { NgModule } from '@angular/core';
import { AboutRoutingModule } from './about.routing.module';

import { AboutComponent } from './components/about.component';

@NgModule({
  imports: [
    AboutRoutingModule
  ],
  exports: [],
  declarations: [AboutComponent]
})
export class AboutModule { }