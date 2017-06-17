import * as webpack from 'webpack';

import {BuildOptions} from '../../models';
import {Logger} from '../../utils';
import {getWebpackToStringStatsOptions} from '../../helpers';

export function webpackBundle(wpConfig: webpack.Configuration | webpack.Configuration[],
    buildOptions: BuildOptions,
    watch?: boolean,
    watchOptions?: webpack.WatchOptions,
    logger: Logger = new Logger()): Promise<any> {
    const firstConfig = Array.isArray(wpConfig) ? wpConfig[0] : wpConfig;
    const webpackCompiler = webpack(wpConfig);
    const statsOptions = getWebpackToStringStatsOptions(firstConfig.stats, buildOptions.verbose);

    if (Array.isArray(wpConfig) && !statsOptions.children) {
        statsOptions.children = wpConfig.map((o: webpack.Configuration) => o.stats) as any;
    }
    if (typeof statsOptions.context === 'undefined') {
        statsOptions.context = firstConfig.context;
    }
    if (typeof statsOptions.colors === 'undefined') {
        // ReSharper disable once CommonJsExternalModule
        statsOptions.colors = require('supports-color');
    }

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
                logger.logLine(stats.toString(statsOptions));
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
