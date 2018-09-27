// tslint:disable:no-any
// tslint:disable:no-unsafe-any

import * as webpack from 'webpack';

import { LoggerBase } from '../utils/logger';

export async function runWebpack(wpConfig: webpack.Configuration | webpack.Configuration[],
    watch: boolean,
    logger: LoggerBase): Promise<any> {
    const firstConfig = Array.isArray(wpConfig) ? wpConfig[0] : wpConfig;
    const statsOptions = firstConfig.stats;
    const watchOptions = firstConfig.watchOptions;
    if (Array.isArray(wpConfig) &&
        wpConfig.length > 1 &&
        statsOptions &&
        typeof statsOptions === 'object' &&
        !(statsOptions as any).children) {
        (statsOptions as any).children = true; // wpConfig.map((o: webpack.Configuration) => o.stats) as any;
    }

    const webpackCompiler = webpack(wpConfig as any);

    // tslint:disable-next-line:promise-must-complete
    return new Promise((resolve, reject) => {
        const callback: webpack.Compiler.Handler = (err: Error, stats: webpack.Stats) => {
            if (!watch || err) {
                // Do not keep cache anymore
                (webpackCompiler as any).purgeInputFileSystem();
            }

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
