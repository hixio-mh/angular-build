// Ref: https://github.com/webpack-contrib/webpack-bundle-analyzer
// Wrapper for webpack-contrib/webpack-bundle-analyzer

// tslint:disable:no-any
// tslint:disable:no-unsafe-any
// tslint:disable:no-var-requires
// tslint:disable:no-require-imports

import * as path from 'path';

import * as spawn from 'cross-spawn';
import { ensureDir, readFileSync, writeFile } from 'fs-extra';
import * as webpack from 'webpack';

import { BundleAnalyzerOptions } from '../../../models';
import { Logger, LogLevelString } from '../../../utils';

const ejs = require('ejs');

// tslint:disable-next-line:non-literal-require
const analyzer = require(path.join(require.resolve('webpack-bundle-analyzer'), '..', 'analyzer'));
const webpackBundleAnalyzerRoot = path.resolve(require.resolve('webpack-bundle-analyzer'), '../..');

export interface BundleAnalyzerWebpackPluginOptions extends BundleAnalyzerOptions {
    outputPath?: string;
    forceWriteToDisk?: boolean;
    stats?: webpack.Stats.ToJsonOptionsObject;
    logLevel?: LogLevelString;
}

export class BundleAnalyzerWebpackPlugin {
    private readonly _options: BundleAnalyzerWebpackPluginOptions;
    private readonly _logger: Logger;
    private readonly _persistedOutputFileSystemNames = ['NodeOutputFileSystem'];
    private readonly _defaultOutputOptions: webpack.Stats.ToJsonOptionsObject = {
        modules: true,
        chunks: true,
        chunkModules: true,
        entrypoints: true,
        maxModules: Infinity
    };
    private readonly _defaultOptions: { [key: string]: string | boolean } = {
        reportFilename: 'stats-report.html',
        openAnalyzer: false,
        generateStatsFile: false,
        statsFilename: 'stats.json'
    };

    get name(): string {
        return 'bundle-analyzer-webpack-plugin';
    }

    constructor(options: BundleAnalyzerWebpackPluginOptions) {
        this._options = {
            ...this._defaultOptions,
            stats: {
                ...this._defaultOutputOptions
            },
            ...options,
        };

        this._logger = new Logger({
            name: `[${this.name}]`,
            logLevel: this._options.logLevel || 'info'
        });
    }

    apply(compiler: webpack.Compiler): void {
        let outputPath = this._options.outputPath;
        if (!outputPath && compiler.options.output && compiler.options.output.path) {
            outputPath = compiler.options.output.path;
        }

        compiler.hooks.done.tap(this.name, (stats: webpack.Stats) => {
            if (stats.hasErrors()) {
                return;
            }

            const statsJson = stats.toJson(this._options.stats);

            // Making analyzer logs to be after all webpack logs in the console
            setImmediate(() => {
                this.generateStatsFile(statsJson, compiler, outputPath)
                    .then(async () => this.generateStaticReport(statsJson, compiler, outputPath))
                    .catch((err) => {
                        this._logger.error(`${err.message || err}`);
                    });
            });
        });
    }

    private async generateStatsFile(stats: any, compiler: webpack.Compiler, outputPath?: string): Promise<void> {
        if (!this._options.generateStatsFile || !outputPath || outputPath === '/' || !path.isAbsolute(outputPath)) {
            return;
        }

        let statsFilepath = this._options.statsFilename || 'stats.json';
        if (!path.isAbsolute(statsFilepath)) {
            statsFilepath = path.resolve(outputPath, statsFilepath);
        }

        const statsFileRelative = path.relative(outputPath, statsFilepath);
        const isPersistedOutFileSystem =
            this._persistedOutputFileSystemNames.includes(compiler.outputFileSystem.constructor.name);
        const content = Buffer.from(JSON.stringify(stats, null, 2), 'utf8');
        if (this._options.forceWriteToDisk && !isPersistedOutFileSystem) {
            this._logger.debug(`Emitting ${statsFileRelative} to disk`);
            await ensureDir(path.dirname(statsFilepath));
            await writeFile(statsFilepath, content);
        } else {
            this._logger.debug(`Emitting ${statsFileRelative}`);
            await new Promise((resolve, reject) => {
                compiler.outputFileSystem.mkdirp(path.dirname(statsFilepath),
                    (err?: Error | null): void => {
                        if (err) {
                            reject(err);

                            return;

                        }

                        resolve();
                    });
            });
            await new Promise((resolve, reject) => {
                compiler.outputFileSystem.writeFile(statsFilepath, content,
                    (err?: Error | null) => {
                        if (err) {
                            reject(err);

                            return;

                        }

                        resolve();
                    });
            });
        }
    }

    private async generateStaticReport(stats: any, compiler: webpack.Compiler, outputPath?: string): Promise<void> {
        if (!outputPath || outputPath === '/' || !path.isAbsolute(outputPath)) {
            return;
        }

        const chartData = this.getChartData(stats, outputPath);
        if (!chartData) {
            return;
        }

        const reportHtml = await new Promise((resolve, reject) => ejs.renderFile(
            `${webpackBundleAnalyzerRoot}/views/viewer.ejs`,
            {
                mode: 'static',
                chartData: JSON.stringify(chartData),
                assetContent: this.getAssetContentSync,
                // Should be one of `stat`, `parsed` or `gzip`.
                defaultSizes: JSON.stringify('parsed')
            },
            (err2: Error, data: string) => {
                if (err2) {
                    reject(err2);

                    return;

                }

                resolve(data);
            }
        ));

        let reportFilepath = this._options.reportFilename || 'stats-report.html';
        if (!path.isAbsolute(reportFilepath)) {
            reportFilepath = path.resolve(outputPath, reportFilepath);
        }

        const reportFileRelative = path.relative(outputPath, reportFilepath);
        const isPersistedOutFileSystem =
            this._persistedOutputFileSystemNames.includes(compiler.outputFileSystem.constructor.name);
        if (this._options.forceWriteToDisk && !isPersistedOutFileSystem) {
            this._logger.debug(`Emitting ${reportFileRelative} to disk`);
            await ensureDir(path.dirname(reportFilepath));
            await writeFile(reportFilepath, reportHtml);
        } else {
            this._logger.debug(`Emitting ${reportFileRelative}`);
            await new Promise((resolve, reject) => {
                compiler.outputFileSystem.mkdirp(path.dirname(reportFilepath),
                    (err2?: Error | null) => {
                        if (err2) {
                            reject(err2);

                            return;
                        }

                        resolve();
                    });
            });
            await new Promise((resolve, reject) => {
                compiler.outputFileSystem.writeFile(reportFilepath, reportHtml,
                    (err2?: Error | null) => {
                        if (err2) {
                            reject(err2);

                            return;
                        }

                        resolve();
                    });
            });
        }

        if (this._options.openAnalyzer && (isPersistedOutFileSystem || this._options.forceWriteToDisk)) {
            try {
                // opener(`file://${reportFilepath}`);
                // http://stackoverflow.com/q/1480971/3191, but see below for Windows.
                const command = process.platform === 'win32'
                    ? 'cmd'
                    : process.platform === 'darwin'
                        ? 'open'
                        : 'xdg-open';
                let args = [`file://${reportFilepath}`];
                if (process.platform === 'win32') {
                    // On Windows, we really want to use the "start" command. But, the rules regarding arguments with spaces, and
                    // escaping them with quotes, can get really arcane. So the easiest way to deal with this is to pass off the
                    // responsibility to "cmd /c", which has that logic built in.
                    //
                    // Furthermore, if "cmd /c" double-quoted the first parameter, then "start" will interpret it as a window title,
                    // so we need to add a dummy empty-string window title: http://stackoverflow.com/a/154090/3191
                    //
                    // Additionally, on Windows ampersand needs to be escaped when passed to "start"
                    args = args.map(value => value.replace(/&/g, '^&'));
                    args = ['/c', 'start', '""'].concat(args);
                }
                spawn.sync(command, args, { stdio: 'inherit' });
            } catch (err) {
                this._logger.error(`${err.message || err}`);
            }
        }
    }

    private getAssetContentSync(filename: string): string {
        return readFileSync(`${webpackBundleAnalyzerRoot}/public/${filename}`, 'utf8');
    }

    private getChartData(...args: any[]): any | null {
        let chartData: any;
        const logger = this._logger;
        try {
            chartData = analyzer.getViewerData(...args, { logger });
        } catch (err) {
            this._logger.error(`Couldn't analyze webpack bundle, Error: ${err.message || err}`);
            chartData = null;
        }

        if (!chartData) {
            this._logger.error("Couldn't find any javascript bundles in provided stats file");
            chartData = null;
        }

        return chartData;
    }
}
