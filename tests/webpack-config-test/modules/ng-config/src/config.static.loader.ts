import { ConfigLoader } from './config.loader';

export class ConfigStaticLoader implements ConfigLoader {

    constructor(public readonly settings: { [key: string]: any }) {
    }

    source(): string {
        return 'ConfigStaticLoader';
    }

    load(): Promise<{ [key: string]: any }> {
        return Promise.resolve(this.settings);
    }
}
