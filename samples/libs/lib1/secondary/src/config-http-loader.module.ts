import { NgModule } from '@angular/core';

import { CONFIG_LOADER } from '@ngb-demo/lib1';

import { ConfigHttpLoader } from './config-http-loader';

@NgModule({
    providers: [
        {
            provide: CONFIG_LOADER,
            useClass: ConfigHttpLoader,
            multi: true
        }
    ]
})
export class ConfigHttpLoaderModule { }
