import * as fs from 'fs';
import * as path from 'path';

import {
    BuildEvent,
    Builder,
    BuilderConfiguration,
    BuilderContext
} from '@angular-devkit/architect';
import { getSystemPath, resolve, virtualFs } from '@angular-devkit/core';
import { Observable, of } from 'rxjs';
import { concatMap } from 'rxjs/operators';
import * as webpack from 'webpack';

import { AngularBuildContext, AppProjectConfigInternal } from '../../build-context';
import {
    applyProjectConfigDefaults,
    applyProjectConfigExtends,
    applyProjectConfigWithEnvironment,
    applyAppConfigCompat,
    getBuildOptionsFromBuilderOptions,
    getWebpackToStringStatsOptions
} from '../../helpers';
import { AppBuilderOptions } from '../../interfaces';
import { normalizeRelativePath } from '../../utils';
import { getAppWebpackConfig } from '../../webpack-configs/app';


export class AppBuilder<TConfig extends AppBuilderOptions> implements Builder<TConfig> {
    private readonly _startTime = Date.now();

    constructor(public context: BuilderContext) { }

    run(builderConfig: BuilderConfiguration<TConfig>): Observable<BuildEvent> {
        const workspaceRoot = getSystemPath(this.context.workspace.root);
        const projectRoot = getSystemPath(resolve(this.context.workspace.root, builderConfig.root));
        const host = new virtualFs.AliasHost(this.context.host as virtualFs.Host<fs.Stats>);
        const options = JSON.parse(JSON.stringify(builderConfig.options)) as AppBuilderOptions;

        const buildOptions = getBuildOptionsFromBuilderOptions(options);
        if (!options.root && builderConfig.root) {
            options.root = normalizeRelativePath(path.relative(workspaceRoot, projectRoot));
        }

        applyAppConfigCompat(options);
        const appConfig = options as AppProjectConfigInternal;
        appConfig._projectType = 'app';
        appConfig._index = 0;
        appConfig._configPath = path.resolve(workspaceRoot, 'angular.json');

        // extends
        applyProjectConfigExtends(appConfig);

        const appConfigEnvApplied = JSON.parse(JSON.stringify(appConfig)) as AppProjectConfigInternal;

        // apply env
        applyProjectConfigWithEnvironment(appConfigEnvApplied, buildOptions.environment);

        // apply defaults
        applyProjectConfigDefaults(appConfigEnvApplied, buildOptions.environment);

        return of(null).pipe(
            concatMap(() => new Observable(obs => {
                if (appConfigEnvApplied.skip) {
                    this.context.logger.info('Skip building');

                    obs.next({ success: true });
                    obs.complete();

                    return () => { };
                }

                const angularBuildContext = new AngularBuildContext({
                    workspaceRoot: workspaceRoot,
                    startTime: this._startTime,
                    host: host,
                    // logger: this.context.logger,

                    projectConfig: appConfigEnvApplied,
                    projectConfigWithoutEnvApplied: appConfig,
                    buildOptions: buildOptions,

                });

                const wpConfig = getAppWebpackConfig(angularBuildContext);
                const firstConfig = Array.isArray(wpConfig) ? wpConfig[0] : wpConfig;
                const statsOptions = firstConfig.stats
                    ? firstConfig.stats
                    : getWebpackToStringStatsOptions(buildOptions.logLevel === 'debug');

                const webpackCompiler = webpack(wpConfig);
                const callback: webpack.Compiler.Handler = (err: Error, stats: webpack.Stats) => {
                    if (err) {
                        return obs.error(err);
                    }

                    if (stats.hasErrors()) {
                        AngularBuildContext.logger.error(stats.toString('errors-only'));
                    } else {
                        const result = stats.toString(statsOptions);
                        if (result && result.trim()) {
                            AngularBuildContext.logger.info(result);
                        }
                    }

                    if (buildOptions.watch) {
                        obs.next({ success: !stats.hasErrors() });

                        // Never complete on watch mode.
                        return;
                    } else {
                        obs.next({ success: !stats.hasErrors() });
                        obs.complete();
                    }
                };

                try {
                    if (buildOptions.watch) {
                        const watching = webpackCompiler.watch(buildOptions.watchOptions || {}, callback);

                        // Teardown logic. Close the watcher when unsubscribed from.
                        return () => watching.close(() => { });
                    } else {
                        webpackCompiler.run(callback);

                        return () => { };
                    }
                } catch (e) {
                    if (e) {
                        AngularBuildContext.logger.error(
                            `\nAn error occured during the build:\n${e.stack || e}`);
                    }

                    throw e;
                }
            })),
        );
    }
}

export default AppBuilder;
