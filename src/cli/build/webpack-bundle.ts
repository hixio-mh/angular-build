import * as webpack from 'webpack';

import {BuildOptions} from '../../models';
import {Logger} from '../../utils';

export function webpackBundle(wpConfig: webpack.Configuration | webpack.Configuration[],
    buildOptions: BuildOptions,
    statsOptions?: any,
    watch?: boolean,
    watchOptions?: webpack.WatchOptions,
    logger: Logger = new Logger()): Promise<any> {
    const firstConfig = Array.isArray(wpConfig) ? wpConfig[0] : wpConfig;
    const webpackCompiler = webpack(wpConfig);
    watchOptions = watchOptions || firstConfig.watchOptions || {};

    return new Promise((resolve, reject) => {
        const callback: webpack.compiler.CompilerCallback = (err: any, stats: webpack.compiler.Stats) => {
            if (!watch || err) {
                // Do not keep cache anymore
                (webpackCompiler as any).purgeInputFileSystem();
            }

            if (err) {
                return reject(err);
            }

            if (watch) {
                return;
            }

            if (stats.hasErrors()) {
                // logger.errorLine(stats.toJson().errors);
                logger.errorLine(stats.toString('errors-only'));
                return reject();
            } else {
                if (!!statsOptions) {
                    logger.logLine(stats.toString(statsOptions));
                }
                resolve();
            }
        };

        if (watch) {
            webpackCompiler.watch(watchOptions as webpack.WatchOptions, callback);
            logger.logLine('\nWebpack is watching the files…\n');
        } else {
            webpackCompiler.run(callback);
        }
    });
}
