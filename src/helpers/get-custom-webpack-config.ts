// tslint:disable:no-unsafe-any
// tslint:disable:non-literal-require

import * as webpack from 'webpack';

import { AngularBuildContext } from '../build-context';
import { AppProjectConfigInternal, LibProjectConfigInternal } from '../interfaces/internals';

export function getCustomWebpackConfig<TConfig extends AppProjectConfigInternal | LibProjectConfigInternal>(modulePath:
    string,
    angularBuildContext: AngularBuildContext<TConfig>):
    webpack.Configuration | null {
    const customWebpackModule = require(modulePath);
    if (customWebpackModule && customWebpackModule.default && typeof customWebpackModule.default === 'function') {
        return customWebpackModule.default(angularBuildContext) as webpack.Configuration;
    }
    if (customWebpackModule && typeof customWebpackModule === 'function') {
        return customWebpackModule(angularBuildContext) as webpack.Configuration;
    }

    return null;
}
