import { BuildOptions, LibProjectConfig } from '../../models';

import { BuildOptionsCompat } from './build-options-compat';
import { ProjectConfigCompat } from './project-config-compat';

export interface LibBuilderOptions extends LibProjectConfig, ProjectConfigCompat, BuildOptions, BuildOptionsCompat { }
