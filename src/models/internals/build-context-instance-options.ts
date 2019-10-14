import { AppProjectConfigInternal } from './app-project-config-internal';
import { BuildOptionsInternal } from './build-options-internal';
import { LibProjectConfigInternal } from './lib-project-config-internal';

export interface BuildContextInstanceOptions<TConfig extends AppProjectConfigInternal | LibProjectConfigInternal> {
    projectConfigRaw: TConfig;
    buildOptions: BuildOptionsInternal;
    // tslint:disable-next-line: no-any
    host?: any;
}
