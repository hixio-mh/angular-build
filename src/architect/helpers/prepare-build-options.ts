import { normalizeEnvironment } from '../../helpers';
import { BuildOptionsInternal } from '../../models/internals';

import { AppBuilderOptions, LibBuilderOptions } from '../models';

export function getBuildOptionsFromBuilderOptions(options: AppBuilderOptions | LibBuilderOptions): BuildOptionsInternal {
    const buildOptions: BuildOptionsInternal = { ...options, environment: {} };

    if (options.environment) {
        const env = normalizeEnvironment(options.environment);
        buildOptions.environment = env;
        delete options.environment;
    }

    if (options.prod) {
        buildOptions.environment = buildOptions.environment || {};
        buildOptions.environment.prod = true;
        delete options.prod;
    }

    if (options.verbose != null) {
        if (options.verbose) {
            buildOptions.logLevel = 'debug';
        }
        delete options.verbose;
    }

    return buildOptions;
}

