import { AppProjectConfig, BuildOptions, ShortcutBuildOptions } from '../../models';

import { AppConfigCompat } from './app-config-compat';

export interface AppBuilderOptions extends AppProjectConfig, BuildOptions, ShortcutBuildOptions, AppConfigCompat { }
