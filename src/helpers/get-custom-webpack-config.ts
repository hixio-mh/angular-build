// tslint:disable:no-unsafe-any
// tslint:disable:non-literal-require

import { Configuration } from 'webpack';

import { AngularBuildContext } from '../build-context';
import { AppProjectConfigInternal } from '../models/internals';

export async function getCustomWebpackConfig(modulePath: string, angularBuildContext: AngularBuildContext<AppProjectConfigInternal>):
    Promise<Configuration | null> {
    const customWebpackConfigModule = require(modulePath);
    if (customWebpackConfigModule && customWebpackConfigModule.default && typeof customWebpackConfigModule.default === 'function') {
        const wpConfig = customWebpackConfigModule.default(angularBuildContext);
        if (wpConfig && wpConfig instanceof Promise) {
            return wpConfig as Promise<Configuration>;
        } else {
            return Promise.resolve(wpConfig);
        }
    }

    if (customWebpackConfigModule && typeof customWebpackConfigModule === 'function') {
        const wpConfig = customWebpackConfigModule(angularBuildContext);
        if (wpConfig && wpConfig instanceof Promise) {
            return wpConfig as Promise<Configuration>;
        } else {
            return Promise.resolve(wpConfig);
        }
    }

    return Promise.resolve(null);
}
