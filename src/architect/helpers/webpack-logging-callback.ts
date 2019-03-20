import { WebpackLoggingCallback } from '@angular-devkit/build-webpack/src/webpack/index2';
import { logging } from '@angular-devkit/core';

import { statsErrorsToString, statsToString, statsWarningsToString } from './webpack-stats';

export function createWebpackLoggingCallback(
    verbose: boolean,
    logger: logging.LoggerApi,
): WebpackLoggingCallback {
    return (stats, config) => {
        // config.stats contains our own stats settings, added during buildWebpackConfig().
        const statsJson = stats.toJson(config.stats);
        if (verbose) {
            logger.info(stats.toString(config.stats));
        } else {
            logger.info(statsToString(statsJson, config.stats));
        }

        if (stats.hasWarnings()) {
            logger.warn(statsWarningsToString(statsJson, config.stats));
        }
        if (stats.hasErrors()) {
            logger.error(statsErrorsToString(statsJson, config.stats));
        }
    };
}
