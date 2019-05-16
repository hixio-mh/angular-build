// tslint:disable-next-line: no-implicit-dependencies
import { InjectionToken } from '@angular/core';

import { ConfigLoader } from './config-loader';

export const CONFIG_LOADER = new InjectionToken<ConfigLoader>('ConfigLoader');
