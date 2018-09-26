import { virtualFs } from '@angular-devkit/core';

import { AppProjectConfigInternal } from './app-project-config-internal';
import { BuildOptionsInternal } from './build-options-internal';
import { LibProjectConfigInternal } from './lib-project-config-internal';

export interface BuildContextInstanceOptions<TConfig extends AppProjectConfigInternal | LibProjectConfigInternal> {
    projectConfigWithoutEnvApplied: TConfig;
    projectConfig: TConfig;
    buildOptions: BuildOptionsInternal;
    host: virtualFs.Host;
}
