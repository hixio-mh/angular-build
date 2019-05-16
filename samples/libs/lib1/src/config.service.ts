// tslint:disable-next-line: no-implicit-dependencies
import { Inject, Injectable } from '@angular/core';

import { Observable } from 'rxjs';

import { ConfigLoader } from './config-loader';
import { CONFIG_LOADER } from './config-loader-token';

@Injectable({
    providedIn: 'root'
})
export class ConfigService {
    constructor(@Inject(CONFIG_LOADER) private readonly _configLoader: ConfigLoader) { }

    load(): Observable<{ [key: string]: string }> {
        return this._configLoader.load();
    }
}
