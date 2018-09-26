import { AngularBuildConfig } from '../angular-build-config';

import { AppProjectConfigInternal } from './app-project-config-internal';
import { LibProjectConfigInternal } from './lib-project-config-internal';

export interface AngularBuildConfigInternal extends AngularBuildConfig {
    libs: LibProjectConfigInternal[];
    apps: AppProjectConfigInternal[];

    // tslint:disable-next-line:no-any
    _schema?: { [key: string]: any };
    _configPath: string;
}
