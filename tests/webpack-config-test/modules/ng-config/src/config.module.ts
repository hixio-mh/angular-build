import { APP_INITIALIZER, ModuleWithProviders, NgModule, Optional, Provider, SkipSelf } from '@angular/core';

import { ConfigPipe } from './config.pipe';
import { ConfigLoader } from './config.loader';
import { ConfigStaticLoader } from './config.static.loader';
import { ConfigService } from './config.service';

@NgModule({
    declarations: [ConfigPipe],
    exports: [ConfigPipe]
})
export class ConfigModule {
    static forRoot(configuredProvider: Provider = {
        provide: ConfigLoader,
        useFactory: (configStaticLoaderFactory)
    }): ModuleWithProviders {
        return {
            ngModule: ConfigModule,
            providers: [
                configuredProvider,
                ConfigService,
                {
                    provide: APP_INITIALIZER,
                    useFactory: (configAppInitializerFactory),
                    deps: [ConfigService],
                    multi: true
                }
            ]
        };
    }

    constructor( @Optional() @SkipSelf() parentModule: ConfigModule) {
        if (parentModule) {
            throw new Error('ConfigModule already loaded, import in root module only.');
        }
    }
}

export function configStaticLoaderFactory(): ConfigLoader {
    return new ConfigStaticLoader({});
}

export function configAppInitializerFactory(configService: ConfigService): any {
    const res = () => configService.init();
    return res;
}
