// Ref: https://github.com/th0r/webpack-bundle-analyzer

const fs = require('fs-extra');
import * as path from 'path';
import * as webpack from 'webpack';

const analyzer = require(path.join(require.resolve('webpack-bundle-analyzer'), '..', 'analyzer'));
// ReSharper disable once InconsistentNaming
const Logger = require(path.join(require.resolve('webpack-bundle-analyzer'), '..', 'Logger'));

// ReSharper disable CommonJsExternalModule
const ejs = require('ejs');
const spawn = require('cross-spawn');
// ReSharper restore CommonJsExternalModule

const webpackBundleAnalyzerRoot = path.resolve(require.resolve('webpack-bundle-analyzer'), '../..');

export interface BundleAnalyzerPluginOptions {
    generateAnalyzerReport?: boolean;
    reportFilename?: string;
    openAnalyzer?: boolean;
    generateStatsFile?: boolean;
    statsFilename?: string;
    statsOptions?: webpack.Stats.ToJsonOptionsObject;
}

export class BundleAnalyzerPlugin {
    private readonly logger: any;
    private compiler: any;

    private defaultOptions: any = {
        generateAnalyzerReport: false,
        reportFilename: 'stats-report.html',
        openAnalyzer: true,
        generateStatsFile: false,
        statsFilename: 'stats.json'
    };

    constructor(private readonly options?: BundleAnalyzerPluginOptions) {
        this.options = Object.assign({}, this.defaultOptions, options);
        this.logger = new Logger('info');
    }

    apply(compiler: any): void {
        this.compiler = compiler;

        // compiler.plugin('emit', (compilation: any, cb: Function) => {
        //    var stats = compilation.getStats().toJson(this.options.statsOptions || {});
        //    //if (this.options.generateStatsFile) {
        //    //    this.generateStatsFile(stats, compilation);
        //    //}
        //    if (this.options.generateAnalyzerReport) {
        //        this.generateStaticReport(stats, cb);
        //        return;
        //    }
        //    cb();
        // });

        compiler.plugin('done',
            (stats: any) => {
                const options: BundleAnalyzerPluginOptions = this.options || {};
                const outputOptions: webpack.Stats.ToJsonOptionsObject = options.statsOptions || {};
                if (typeof outputOptions.chunks === 'undefined') {
                    outputOptions.chunks = true;
                }
                if (typeof (outputOptions as any).entrypoints === 'undefined') {
                    (outputOptions as any).entrypoints = true;
                }
                if (typeof outputOptions.modules === 'undefined') {
                    outputOptions.modules = true;
                }
                if (typeof outputOptions.chunkModules === 'undefined') {
                    outputOptions.chunkModules = true;
                }
                if (typeof outputOptions.reasons === 'undefined') {
                    outputOptions.reasons = true;
                }
                if (typeof outputOptions.cached === 'undefined') {
                    outputOptions.cached = true;
                }
                if (typeof (outputOptions as any).cachedAssets === 'undefined') {
                    (outputOptions as any).cachedAssets = true;
                }

                stats = stats.toJson(outputOptions);
                if (options.generateStatsFile) {
                    this.generateStatsFile(stats);
                }
                if (options.generateAnalyzerReport) {
                    this.generateStaticReport(stats);
                }
            });
    }

    generateStatsFile(stats: any, cb?: Function): void {
        const options: BundleAnalyzerPluginOptions = this.options || {};
        const bundleDir = this.getBundleDirFromCompiler();
        if (bundleDir === null) {
            return;
        }

        let statsFilepath = options.statsFilename || 'stats.json';
        if (!path.isAbsolute(statsFilepath)) {
            statsFilepath = path.resolve(bundleDir, statsFilepath);
        }

        fs.ensureDirSync(path.dirname(statsFilepath));
        fs.writeFileSync(
            statsFilepath,
            JSON.stringify(stats, null, 2)
        );

        if (cb) {
            cb();
        }

        // var statsStr = JSON.stringify(stats);
        // compilation.assets[this.options.statsFilename] = {
        //    size() {
        //        return statsStr && statsStr.length || 0;
        //    },
        //    source() {
        //        return statsStr;
        //    }
        // };
    }

    generateStaticReport(stats: any, cb?: Function): void {
        const options: BundleAnalyzerPluginOptions = this.options || {};
        const bundleDir = this.getBundleDirFromCompiler();
        if (bundleDir === null) {
            return;
        }

        const chartData = this.getChartData(this.logger, stats, bundleDir);
        if (!chartData) {
            if (cb) {
                cb();
            }

            return;
        }

        ejs.renderFile(
            `${webpackBundleAnalyzerRoot}/views/viewer.ejs`,
            {
                mode: 'static',
                chartData: JSON.stringify(chartData),
                assetContent: this.getAssetContent,
                // Should be one of `stat`, `parsed` or `gzip`.
                defaultSizes: JSON.stringify('parsed')
            },
            (err: any, reportHtml: string) => {
                if (err) {
                    this.logger.error(err);
                    if (cb) {
                        cb();
                    }
                    return;
                }

                let reportFilepath = options.reportFilename || 'stats-report.html';
                if (!path.isAbsolute(reportFilepath)) {
                    reportFilepath = path.resolve(bundleDir || process.cwd(), reportFilepath);
                }

                fs.ensureDirSync(path.dirname(reportFilepath));
                fs.writeFileSync(reportFilepath, reportHtml);
                if (options.openAnalyzer) {
                    try {
                        // opener(`file://${reportFilepath}`);
                        // http://stackoverflow.com/q/1480971/3191, but see below for Windows.
                        const command = process.platform === 'win32' ? 'cmd' :
                            process.platform === 'darwin' ? 'open' :
                                'xdg-open';
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
                        this.logger.error(err);
                    }
                }

                if (cb) {
                    cb();
                }
            }
        );
    }

    getAssetContent(filename: string): string {
        return fs.readFileSync(`${webpackBundleAnalyzerRoot}/public/${filename}`, 'utf8');
    }

    getChartData(logger: any, ...args: any[]): any {
        let chartData: any;

        try {
            chartData = analyzer.getViewerData(...args, { logger });
        } catch (err) {
            logger.error(`Couldn't analyze webpack bundle:\n${err}`);
            chartData = null;
        }

        if (!chartData) {
            logger.error(`Couldn't find any javascript bundles in provided stats file`);
            chartData = null;
        }

        return chartData;
    }

    getBundleDirFromCompiler(): string | null {
        return (this.compiler.outputFileSystem.constructor.name === 'MemoryFileSystem')
            ? null
            : this.compiler.outputPath;
    }
}

