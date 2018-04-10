import { AppConfigCompat, ProjectConfigCompat } from './project-config-compat';
import { AppProjectConfig } from './app-project-config';
import { LibProjectConfig } from './lib-project-config';
import { BuildOptions, BuildOptionsCompat } from './build-options';

export interface AppBuilderOptions extends AppProjectConfig, AppConfigCompat, BuildOptions, BuildOptionsCompat { }

export interface LibBuilderOptions extends LibProjectConfig, ProjectConfigCompat, BuildOptions, BuildOptionsCompat { }
