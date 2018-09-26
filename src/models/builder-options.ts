import { AppProjectConfig } from './app-project-config';
import { BuildOptions, BuildOptionsCompat } from './build-options';
import { LibProjectConfig } from './lib-project-config';
import { AppConfigCompat, ProjectConfigCompat } from './project-config-compat';

export interface AppBuilderOptions extends AppProjectConfig, AppConfigCompat, BuildOptions, BuildOptionsCompat { }

export interface LibBuilderOptions extends LibProjectConfig, ProjectConfigCompat, BuildOptions, BuildOptionsCompat { }
