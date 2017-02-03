import { NgModule, Optional, SkipSelf } from '@angular/core';
import { CommonModule } from '@angular/common';
//import { FormsModule, ReactiveFormsModule } from '@angular/forms';


import { AuthService } from './auth';
import { CacheService, HttpCacheService } from './caching';
import { LoggerService } from './logging';


import { throwIfAlreadyLoaded } from './module-import-guard';

//import { TitleComponent } from './title/title.component';

@NgModule({
  imports: [
    CommonModule // we use ngFor
  ],
  exports: [CommonModule],
  //exports: [CommonModule, FormsModule, ReactiveFormsModule, TitleComponent],
  //declarations: [TitleComponent],
  providers: [AuthService, CacheService, HttpCacheService, LoggerService]
})
export class CoreModule {
  constructor( @Optional() @SkipSelf() parentModule: CoreModule) {
    throwIfAlreadyLoaded(parentModule, 'CoreModule');
  }
}
