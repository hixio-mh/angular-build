import { AppProjectConfig, BuildOptions } from '../../models';

import { AppConfigCompat } from './app-config-compat';

export interface AppBuilderOptions extends AppProjectConfig, BuildOptions, AppConfigCompat { }
