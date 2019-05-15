import { Configuration } from 'webpack';

import { AngularBuildContext } from '../build-context';
import { AppProjectConfigInternal } from '../models/internals';

export async function getCustomWebpackConfig(modulePath: string, angularBuildContext: AngularBuildContext<AppProjectConfigInternal>):
    Promise<Configuration | null> {
    const customWebpackConfigModule = await import(modulePath);
    let wpConfigRaw: Promise<Configuration> | Configuration | null = null;
    let wpConfig: Configuration | null = null;

    // tslint:disable-next-line: no-unsafe-any
    if (customWebpackConfigModule && customWebpackConfigModule.default && typeof customWebpackConfigModule.default === 'function') {
        // tslint:disable-next-line: no-unsafe-any
        wpConfigRaw = customWebpackConfigModule.default(angularBuildContext);
    }

    if (customWebpackConfigModule && typeof customWebpackConfigModule === 'function') {
        // tslint:disable-next-line: no-unsafe-any
        wpConfigRaw = customWebpackConfigModule(angularBuildContext);
    }

    if (wpConfigRaw && wpConfigRaw instanceof Promise) {
        wpConfig = await wpConfigRaw;
    } else {
        wpConfig = wpConfigRaw;
    }

    return wpConfig;
}
