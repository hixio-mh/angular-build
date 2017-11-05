import { Injectable } from '@angular/core';

import { ConfigLoader } from './config.loader';

@Injectable()
export class ConfigService {

    private cachedSettings: { [key: string]: any };

    constructor(public loader: ConfigLoader) { }

    init(): Promise<any> {
        return this.loader.load().then((data: { [key: string]: any }) => {
            this.cachedSettings = data;
        });
    }

    getSettings(key?: string | Array<string>, defaultValue?: any): any {
        if (!key || (Array.isArray(key) && !key[0])) {
            return this.cachedSettings;
        }

        const keyArray = Array.isArray(key) ? key : key.split(/\.|:/);

        let result = keyArray.reduce((acc: any, current: string) => acc && acc[current],
            this.cachedSettings);

        if (result === undefined) {
            result = defaultValue;
        }

        return result;
    }
}
