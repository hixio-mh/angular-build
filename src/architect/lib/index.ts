// tslint:disable:no-any
// tslint:disable:no-unsafe-any
// tslint:disable:no-default-export

import * as path from 'path';

import {
    Builder,
    BuilderConfiguration,
    BuilderContext,
    BuildEvent
} from '@angular-devkit/architect';
import { getSystemPath, resolve } from '@angular-devkit/core';
import { Observable, of } from 'rxjs';
import { concatMap } from 'rxjs/operators';
import * as webpack from 'webpack';

import { AngularBuildContext } from '../../build-context';
import {
    applyProjectConfigExtends,
    applyProjectConfigWithEnvironment,
    getBuildOptionsFromBuilderOptions,
    getWebpackToStringStatsOptions
} from '../../helpers';
import { LibBuilderOptions } from '../../interfaces';
import { LibProjectConfigInternal } from '../../interfaces/internals';
import { normalizeRelativePath } from '../../utils';
import { getLibWebpackConfig } from '../../webpack-configs/lib';

export class LibBuilder implements Builder<LibBuilderOptions> {
    private readonly _startTime = Date.now();

    constructor(public context: BuilderContext) { }

    // tslint:disable-next-line:max-func-body-length
    run(builderConfig: BuilderConfiguration<LibBuilderOptions>): Observable<BuildEvent> {
        const workspaceRoot = getSystemPath(this.context.workspace.root);
        const projectRoot = getSystemPath(resolve(this.context.workspace.root, builderConfig.root));
        const options = JSON.parse(JSON.stringify(builderConfig.options)) as LibBuilderOptions;

        const buildOptions = getBuildOptionsFromBuilderOptions(options);
        if (!options.root && builderConfig.root) {
            options.root = normalizeRelativePath(path.relative(workspaceRoot, projectRoot));
        }

        const libConfig = options as LibProjectConfigInternal;
        libConfig._projectType = 'lib';
        libConfig._index = 0;
        libConfig._configPath = path.resolve(workspaceRoot, 'angular.json');

        // Delete empty array
        Object.keys(libConfig).forEach(key => {
            const libConfigAny = libConfig as any;
            if (libConfigAny[key] && Array.isArray(libConfigAny[key]) && libConfigAny[key].length === 0) {
                delete libConfigAny[key];
            }
        });

        // extends
        applyProjectConfigExtends(libConfig);

        const libConfigEnvApplied = JSON.parse(JSON.stringify(libConfig)) as LibProjectConfigInternal;

        // apply env
        applyProjectConfigWithEnvironment(libConfigEnvApplied, buildOptions.environment);

        return of(null).pipe(
            concatMap(() => new Observable(obs => {
                if (libConfigEnvApplied.skip) {
                    this.context.logger.info('Skip building');

                    obs.next({ success: true });
                    obs.complete();

                    return () => {
                        // Do nothing
                    };
                }

                const angularBuildContext = new AngularBuildContext({
                    workspaceRoot: workspaceRoot,
                    startTime: this._startTime,
                    host: this.context.host,
                    // logger: this.context.logger,

                    projectConfig: libConfigEnvApplied,
                    projectConfigWithoutEnvApplied: libConfig,
                    buildOptions: buildOptions,

                });

                let wpConfig: webpack.Configuration;
                try {
                    wpConfig = getLibWebpackConfig(angularBuildContext);
                } catch (configErr) {
                    obs.error(configErr);

                    return () => {
                        // Do nothing
                    };
                }

                const firstConfig = Array.isArray(wpConfig) ? wpConfig[0] : wpConfig;
                const statsOptions = firstConfig.stats
                    ? firstConfig.stats
                    : getWebpackToStringStatsOptions(buildOptions.logLevel === 'debug');

                const webpackCompiler = webpack(wpConfig);
                const callback: webpack.Compiler.Handler = (err: Error, stats: webpack.Stats) => {
                    if (err) {
                        obs.error(err);

                        return;
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
                        AngularBuildContext.logger.error(
                            `\nAn error occured during the build:\n${e.stack || e}`);
                    }

                    throw e;
                }
            })),
        );
    }
}

export default LibBuilder;
