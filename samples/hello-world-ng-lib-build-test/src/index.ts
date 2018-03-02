import { NgModule } from '@angular/core';

import { HelloWorldService } from './hello-world.service';

@NgModule({
  providers: [
    HelloWorldService
  ]
})
export class HelloWorldModule { }
