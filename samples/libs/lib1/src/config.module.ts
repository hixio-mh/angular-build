// tslint:disable: no-unnecessary-class

// tslint:disable-next-line: no-implicit-dependencies
import { APP_INITIALIZER, ModuleWithProviders, NgModule } from '@angular/core';

import { ConfigService } from './config.service';

@NgModule({
    providers: [
        ConfigService
    ]
})
export class ConfigModule {
    static forRoot(): ModuleWithProviders {
        return {
            ngModule: ConfigModule,
            providers: [
                {
                    provide: APP_INITIALIZER,
                    useFactory: (configAppInitializerFactory),
                    deps: [ConfigService],
                    multi: true
                }
            ]
        };
    }
}

// tslint:disable-next-line:no-any
export function configAppInitializerFactory(configService: ConfigService): () => Promise<any> {
    // tslint:disable-next-line:no-unnecessary-local-variable
    const res = async () => configService.load();

    return res;
}
