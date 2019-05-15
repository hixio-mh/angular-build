import { BuilderOutput } from '@angular-devkit/architect';
import { logging } from '@angular-devkit/core';

import { Observable } from 'rxjs';
import * as webpack from 'webpack';

import { BuildOptions } from '../../models';

export function runWebpack(wpConfig: webpack.Configuration,
    buildOptions: BuildOptions,
    logger: logging.LoggerApi,
    startTime: number): Observable<BuilderOutput> {
    const statsOptions = wpConfig.stats;
    const watch = buildOptions.watch;
    const watchOptions = wpConfig.watchOptions || buildOptions.watchOptions || {};
    const webpackCompiler = webpack(wpConfig);
    const beep = buildOptions.beep;

    return new Observable<BuilderOutput>(obs => {
        const callback: webpack.Compiler.Handler = (err, stats) => {
            if (err) {
                obs.error(err);

                return;
            }

            const hasErrors = stats.hasErrors();

            if (hasErrors) {
                obs.error(new Error(stats.toString('errors-only')));

                return;
            }

            if (statsOptions) {
                const result = stats.toString(statsOptions);
                if (result && result.trim()) {
                    logger.info(result);
                }
            }

            const duration = Date.now() - startTime;
            logger.info(`Build completed in [${duration}ms]\n`);

            obs.next({
                success: true
            } as unknown as BuilderOutput);

            if (!watch) {
                obs.complete();

                if (beep && process.stdout.isTTY) {
                    process.stdout.write('\x07');
                }
            }
        };

        try {
            if (watch) {
                webpackCompiler.watch(watchOptions, callback);
                logger.info('\nWebpack is watching the files…\n');

                return;
            } else {
                webpackCompiler.run(callback);
            }
        } catch (err) {
            if (err) {
                // tslint:disable-next-line: no-unsafe-any
                logger.error(`\nAn error occurred during the build:\n${err.stack || err}`);
            }

            throw err;
        }
    });
}
