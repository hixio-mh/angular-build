import { AppProjectConfig, BuildOptions } from '../../models';

import { AppConfigCompat } from './app-config-compat';
import { BuildOptionsCompat } from './build-options-compat';

export interface AppBuilderOptions extends AppProjectConfig, AppConfigCompat, BuildOptions, BuildOptionsCompat { }
