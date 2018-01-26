import * as webpack from 'webpack';

import { AngularBuildContext } from '../models';

// TODO: to support for async function
export function getCustomWebpackConfig(modulePath: string, angularBuildContext: AngularBuildContext): webpack.
                                                                                                      Configuration |
                                                                                                      null {
    const customWebpackModule = require(modulePath);
    if (customWebpackModule && customWebpackModule.default && typeof customWebpackModule.default === 'function') {
        return customWebpackModule.default(angularBuildContext) as webpack.Configuration;
    }
    if (customWebpackModule && typeof customWebpackModule === 'function') {
        return customWebpackModule(angularBuildContext) as webpack.Configuration;
    }
    return null;
}
