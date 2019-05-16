import { normalizeEnvironment } from '../../helpers';
import { BuildOptionsInternal } from '../../models/internals';

import { AppBuilderOptions, LibBuilderOptions } from '../models';

export function getBuildOptionsFromBuilderOptions(options: AppBuilderOptions | LibBuilderOptions): BuildOptionsInternal {
    const buildOptions: BuildOptionsInternal = { environment: {} };

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

    if (options.filter) {
        buildOptions.filter = options.filter;
        delete options.filter;
    }

    if (options.progress != null) {
        if (options.progress) {
            buildOptions.progress = true;
        }
        delete options.progress;
    }

    if (options.verbose != null) {
        buildOptions.verbose = options.verbose;
        if (options.verbose) {
            buildOptions.logLevel = 'debug';
        }
        delete options.verbose;
    }

    if (options.logLevel) {
        buildOptions.logLevel = options.logLevel;
        delete options.logLevel;
    }

    if (options.watch != null) {
        if (options.watch) {
            buildOptions.watch = true;
        }
        delete options.watch;
    }

    if (options.watchOptions) {
        buildOptions.watchOptions = { ...options.watchOptions };
        delete options.watchOptions;
    }

    if (options.beep != null) {
        if (options.beep) {
            buildOptions.beep = true;
        }
        delete options.beep;
    }

    if ((options as AppBuilderOptions).poll != null) {
        buildOptions.watchOptions = {
            poll: (options as AppBuilderOptions).poll
        };
        delete (options as AppBuilderOptions).poll;
    }

    return buildOptions;
}

