import { AppProjectConfigInternal } from './app-project-config-internal';
import { BuildOptionsInternal } from './build-options-internal';
import { LibProjectConfigInternal } from './lib-project-config-internal';
import { Host } from './virtual-fs-host';

export interface BuildContextInstanceOptions<TConfig extends AppProjectConfigInternal | LibProjectConfigInternal> {
    projectConfigRaw: TConfig;
    buildOptions: BuildOptionsInternal;
    host?: Host;
}
