import * as webpack from 'webpack';

import { AngularBuildContext, PreDefinedEnvironment } from '../models';

export function getCustomWebpackConfig(modulePath: string, angularBuildContext: AngularBuildContext, env?: PreDefinedEnvironment): webpack.
    Configuration |
    null {
    const customWebpackModule = require(modulePath);
    if (customWebpackModule && customWebpackModule.default && typeof customWebpackModule.default === 'function') {
        return customWebpackModule.default(angularBuildContext, env) as webpack.Configuration;
    }
    if (customWebpackModule && typeof customWebpackModule === 'function') {
        return customWebpackModule(angularBuildContext, env) as webpack.Configuration;
    }
    return null;
}
