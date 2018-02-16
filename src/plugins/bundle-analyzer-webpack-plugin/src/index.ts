// Ref: https://github.com/th0r/webpack-bundle-analyzer

import * as path from 'path';

import { ensureDir, readFileSync, writeFile } from 'fs-extra';
import * as webpack from 'webpack';

import { BundleAnalyzerOptions } from '../../../models';
import { Logger, LoggerOptions } from '../../../utils/logger';

const ejs = require('ejs');
const spawn = require('cross-spawn');

const analyzer = require(path.join(require.resolve('webpack-bundle-analyzer'), '..', 'analyzer'));
const webpackBundleAnalyzerRoot = path.resolve(require.resolve('webpack-bundle-analyzer'), '../..');

export interface BundleAnalyzerWebpackPluginOptions extends BundleAnalyzerOptions {
    forceWriteToDisk?: boolean;
    persistedOutputFileSystemNames?: string[];
    stats?: webpack.Stats.ToJsonOptionsObject;
    loggerOptions?: LoggerOptions;
}

export class BundleAnalyzerWebpackPlugin {
    private readonly logger: Logger;
    private readonly persistedOutputFileSystemNames = ['NodeOutputFileSystem'];

    private readonly defaultOutputOptions: webpack.Stats.ToJsonOptionsObject = {
        modules: true,
        chunks: true,
        chunkModules: true,
        entrypoints: true,
        maxModules: Infinity
    };

    private readonly defaultOptions: any = {
        reportFilename: 'stats-report.html',
        openAnalyzer: false,
        generateStatsFile: false,
        statsFilename: 'stats.json'
    };

    get name(): string {
        return 'BundleAnalyzerWebpackPlugin';
    }

    constructor(private readonly options: BundleAnalyzerWebpackPluginOptions) {
        this.options = Object.assign({}, this.defaultOptions, options) as BundleAnalyzerWebpackPluginOptions;
        this.options.stats = this.options.stats || this.defaultOutputOptions;

        const loggerOptions =
            Object.assign({ name: `[${this.name}]` }, this.options.loggerOptions || {}) as LoggerOptions;
        this.logger = new Logger(loggerOptions);

        if (this.options.persistedOutputFileSystemNames && this.options.persistedOutputFileSystemNames.length) {
            this.options.persistedOutputFileSystemNames
                .filter(pfs => !this.persistedOutputFileSystemNames.includes(pfs))
                .forEach(pfs => this.persistedOutputFileSystemNames.push(pfs));
        }
    }

    apply(compiler: webpack.Compiler): void {
        const outputPath = compiler.options.output ? compiler.options.output.path : undefined;
        const forceExit = process.argv.indexOf('--force-exit') > -1;

        compiler.plugin('after-emit',
            (compilation: any, cb: Function) => {
                if (!forceExit || compilation.errors.length) {
                    cb();
                    return;
                }

                const stats = compilation.getStats().toJson(this.options.stats);

                this.generateStatsFile(stats, compiler, outputPath)
                    .then(() => this.generateStaticReport(stats, compiler, outputPath))
                    .then(() => cb())
                    .catch((err) => cb(err));
            });

        compiler.plugin('done',
            (stats: webpack.Stats) => {
                if (forceExit || stats.hasErrors()) {
                    return;
                }

                const statsJson = stats.toJson(this.options.stats);

                // Making analyzer logs to be after all webpack logs in the console
                setImmediate(() => {
                    this.generateStatsFile(statsJson, compiler, outputPath)
                        .then(() => this.generateStaticReport(statsJson, compiler, outputPath))
                        .catch((err) => {
                            this.logger.error(`${err.message || err}`);
                        });
                });
            });
    }

    private async generateStatsFile(stats: any, compiler: webpack.Compiler, outputPath?: string): Promise<void> {
        if (!this.options.generateStatsFile || !outputPath || outputPath === '/' || !path.isAbsolute(outputPath)) {
            return;
        }

        let statsFilepath = this.options.statsFilename || 'stats.json';
        if (!path.isAbsolute(statsFilepath)) {
            statsFilepath = path.resolve(outputPath, statsFilepath);
        }

        const statsFileRelative = path.relative(outputPath, statsFilepath);
        const isPersistedOutFileSystem =
            this.persistedOutputFileSystemNames.includes(compiler.outputFileSystem.constructor.name);
        const content = new Buffer(JSON.stringify(stats, null, 2), 'utf8');
        if (this.options.forceWriteToDisk && !isPersistedOutFileSystem) {
            this.logger.debug(`Emitting ${statsFileRelative} to disk`);
            await ensureDir(path.dirname(statsFilepath));
            await writeFile(statsFilepath, content);
        } else {
            this.logger.debug(`Emitting ${statsFileRelative}`);
            await new Promise((resolve, reject) => compiler.outputFileSystem.mkdirp(path.dirname(statsFilepath),
                (err: Error) => err ? reject(err) : resolve()));
            await new Promise((resolve, reject) => compiler.outputFileSystem.writeFile(statsFilepath, content,
                (err: Error) => err ? reject(err) : resolve()));
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
                err2 ? reject(err2) : resolve(data);
            }
        ));

        let reportFilepath = this.options.reportFilename || 'stats-report.html';
        if (!path.isAbsolute(reportFilepath)) {
            reportFilepath = path.resolve(outputPath, reportFilepath);
        }

        const reportFileRelative = path.relative(outputPath, reportFilepath);
        const isPersistedOutFileSystem =
            this.persistedOutputFileSystemNames.includes(compiler.outputFileSystem.constructor.name);
        if (this.options.forceWriteToDisk && !isPersistedOutFileSystem) {
            this.logger.debug(`Emitting ${reportFileRelative} to disk`);
            await ensureDir(path.dirname(reportFilepath));
            await writeFile(reportFilepath, reportHtml);
        } else {
            this.logger.debug(`Emitting ${reportFileRelative}`);
            await new Promise((resolve, reject) => compiler.outputFileSystem.mkdirp(path.dirname(reportFilepath),
                (err2: Error) => err2 ? reject(err2) : resolve()));
            await new Promise((resolve, reject) => compiler.outputFileSystem.writeFile(reportFilepath, reportHtml,
                (err2: Error) => err2 ? reject(err2) : resolve()));
        }

        if (this.options.openAnalyzer && (isPersistedOutFileSystem || this.options.forceWriteToDisk)) {
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
                this.logger.error(`${err.message || err}`);
            }
        }
    }

    private getAssetContentSync(filename: string): string {
        const content = readFileSync(`${webpackBundleAnalyzerRoot}/public/${filename}`, 'utf8');
        return content;
    }

    private getChartData(...args: any[]): any | null {
        let chartData: any;
        const logger = this.logger;
        try {
            chartData = analyzer.getViewerData(...args, { logger });
        } catch (err) {
            this.logger.error(`Couldn't analyze webpack bundle, Error: ${err.message || err}`);
            chartData = null;
        }

        if (!chartData) {
            this.logger.error(`Couldn't find any javascript bundles in provided stats file`);
            chartData = null;
        }

        return chartData;
    }
}

