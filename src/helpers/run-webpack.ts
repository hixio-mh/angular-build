import { BuildEvent } from '@angular-devkit/architect';
import { Observable } from 'rxjs';
import * as webpack from 'webpack';

import { getWebpackToStringStatsOptions } from '../helpers';
import { BuildOptions } from '../models';
import { LoggerBase } from '../utils/logger';

export async function runWebpack(wpConfig: webpack.Configuration | webpack.Configuration[],
    watch: boolean,
    logger: LoggerBase): Promise<{}> {
    const firstConfig = Array.isArray(wpConfig) ? wpConfig[0] : wpConfig;
    const statsOptions = firstConfig.stats;
    const watchOptions = firstConfig.watchOptions;
    if (Array.isArray(wpConfig) &&
        wpConfig.length > 1 &&
        statsOptions &&
        typeof statsOptions === 'object' &&
        !statsOptions.children) {
        statsOptions.children = true; // wpConfig.map((o: webpack.Configuration) => o.stats) as any;
    }

    const webpackCompiler = webpack(wpConfig as webpack.Configuration);

    // tslint:disable-next-line:promise-must-complete
    return new Promise((resolve, reject) => {
        const callback: webpack.Compiler.Handler = (err: Error, stats: webpack.Stats) => {
            if (err) {
                reject(err);

                return;
            }

            if (watch) {
                return;
            }

            if (stats.hasErrors()) {
                logger.error(stats.toString('errors-only'));

                reject();

                return;
            } else {
                if (statsOptions) {
                    const result = stats.toString(statsOptions);
                    if (result && result.trim()) {
                        logger.info(result);
                    }
                }
                resolve();
            }
        };

        if (watch) {
            webpackCompiler.watch(watchOptions as webpack.Options.WatchOptions, callback);
            logger.info('\nWebpack is watching the files…\n');
        } else {
            webpackCompiler.run(callback);
        }
    });
}

export function runWebpackForArchitectBuilder(wpConfig: webpack.Configuration,
    buildOptions: BuildOptions,
    logger: LoggerBase): Observable<BuildEvent> {
    return new Observable(obs => {
        const statsOptions = wpConfig.stats
            ? wpConfig.stats
            : getWebpackToStringStatsOptions(buildOptions.logLevel === 'debug');

        const webpackCompiler = webpack(wpConfig);
        const callback: webpack.Compiler.Handler = (err: Error, stats: webpack.Stats) => {
            if (err) {
                obs.error(err);

                return;
            }

            if (stats.hasErrors()) {
                logger.error(stats.toString('errors-only'));
            } else {
                const result = stats.toString(statsOptions);
                if (result && result.trim()) {
                    logger.info(result);
                }
            }

            obs.next({ success: !stats.hasErrors() });

            if (!buildOptions.watch) {
                obs.complete();
            }
        };

        try {
            if (buildOptions.watch) {
                const watching = webpackCompiler.watch(buildOptions.watchOptions || {}, callback);

                // Teardown logic. Close the watcher when unsubscribed from.
                return () => {
                    watching.close(() => {
                        // Do nothing
                    });
                };
            } else {
                webpackCompiler.run(callback);

                return () => {
                    // Do nothing
                };
            }
        } catch (e) {
            if (e) {
                logger.error(`\nAn error occured during the build:\n${(e as Error).stack || e}`);
            }

            throw e;
        }
    });
}
