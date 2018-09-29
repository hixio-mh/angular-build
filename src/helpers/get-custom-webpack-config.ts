// tslint:disable:no-unsafe-any
// tslint:disable:non-literal-require

import { Configuration } from 'webpack';

import { AngularBuildContext } from '../build-context';
import { AppProjectConfigInternal } from '../models/internals';

export function getCustomWebpackConfig(modulePath: string, angularBuildContext: AngularBuildContext<AppProjectConfigInternal>):
    Configuration | null {
    const customWebpackConfigModule = require(modulePath);
    if (customWebpackConfigModule && customWebpackConfigModule.default && typeof customWebpackConfigModule.default === 'function') {
        return customWebpackConfigModule.default(angularBuildContext) as Configuration;
    }
    if (customWebpackConfigModule && typeof customWebpackConfigModule === 'function') {
        return customWebpackConfigModule(angularBuildContext) as Configuration;
    }

    return null;
}
