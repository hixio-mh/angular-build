import { BuilderOutput } from '@angular-devkit/architect';
import { logging } from '@angular-devkit/core';

import { Observable } from 'rxjs';
import * as webpack from 'webpack';

import { BuildOptions } from '../../models';
import { InvalidConfigError, TypescriptCompileError, UnsupportedStyleExtError } from '../../models/errors';

export function runWebpack(wpConfig: webpack.Configuration,
    buildOptions: BuildOptions,
    logger: logging.LoggerApi): Observable<BuilderOutput> {
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
                logger.error(stats.toString('errors-only'));
                obs.error();

                return;
            }

            if (statsOptions) {
                const result = stats.toString(statsOptions);
                if (result && result.trim()) {
                    logger.info(result);
                }
            }

            obs.next({
                success: !hasErrors
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
            // TODO: To review
            if (err) {
                if (err instanceof InvalidConfigError ||
                    err instanceof TypescriptCompileError ||
                    err instanceof UnsupportedStyleExtError) {
                    logger.error(`\n${err.message.trim()}\n`);
                } else {
                    // tslint:disable-next-line: no-unsafe-any
                    logger.error(`\nAn error occurred during the build:\n${err.stack || err}`);
                }
            }

            throw err;
        }
    });
}
