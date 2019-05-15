import { AngularBuildConfig } from '../angular-build-config';

import { JsonObject } from '../json-object';

import { AppProjectConfigInternal } from './app-project-config-internal';
import { LibProjectConfigInternal } from './lib-project-config-internal';

export interface AngularBuildConfigInternal extends AngularBuildConfig {
    libs: LibProjectConfigInternal[];
    apps: AppProjectConfigInternal[];

    _schema?: JsonObject;
    _configPath: string;
}
