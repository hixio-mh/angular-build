// tslint:disable: no-any

import { normalizeEnvironment } from '../../helpers';
import { BuildOptions } from '../../models';
import { BuildOptionsInternal } from '../../models/internals';

import { BuildOptionsCompat } from '../models';

export function getBuildOptionsFromBuilderOptions(options: BuildOptions & BuildOptionsCompat): BuildOptionsInternal {
    const buildOptions: BuildOptionsInternal = { environment: {} };

    if (options.environment) {
        const env = normalizeEnvironment(options.environment);
        buildOptions.environment = env;
        delete options.environment;
    }

    if (options.filter) {
        buildOptions.filter = options.filter;
        delete options.filter;
    }

    if (options.verbose != null) {
        if (options.verbose) {
            buildOptions.logLevel = 'debug';
        }
        delete options.verbose;
    }

    if (options.logLevel) {
        buildOptions.logLevel = options.logLevel;
        delete options.logLevel;
    }

    if (options.progress != null) {
        if (options.progress) {
            buildOptions.progress = true;
        }
        delete options.progress;
    }

    if (options.poll != null) {
        buildOptions.watchOptions = {
            poll: options.poll
        };
        delete options.poll;
    }

    if (options.cleanOutDir != null) {
        if (options.cleanOutDir) {
            buildOptions.cleanOutDir = true;
        }
        delete options.cleanOutDir;
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

    return buildOptions;
}

