import * as path from 'path';

import {
    Builder,
    BuilderConfiguration,
    BuilderContext,
    BuildEvent
} from '@angular-devkit/architect';
import { getSystemPath, resolve } from '@angular-devkit/core';
import { Observable, of, throwError } from 'rxjs';
import { concatMap } from 'rxjs/operators';
import * as webpack from 'webpack';

import { AngularBuildContext } from '../../build-context';
import {
    applyAppConfigCompat,
    applyProjectConfigExtends,
    applyProjectConfigWithEnvironment,
    getBuildOptionsFromBuilderOptions,
    runWebpackForArchitectBuilder
} from '../../helpers';
import { AppBuilderOptions } from '../../models';
import { AppProjectConfigInternal } from '../../models/internals';
import { normalizeRelativePath } from '../../utils';
import { getAppWebpackConfig } from '../../webpack-configs/app';

export class AppBuilder implements Builder<AppBuilderOptions> {
    private readonly _startTime = Date.now();

    constructor(public context: BuilderContext) { }

    run(builderConfig: BuilderConfiguration<AppBuilderOptions>): Observable<BuildEvent> {
        const workspaceRoot = getSystemPath(this.context.workspace.root);
        const projectRoot = getSystemPath(resolve(this.context.workspace.root, builderConfig.root));
        const options = JSON.parse(JSON.stringify(builderConfig.options)) as AppBuilderOptions;
        if (!options.root && builderConfig.root) {
            options.root = normalizeRelativePath(path.relative(workspaceRoot, projectRoot));
        }

        const buildOptions = getBuildOptionsFromBuilderOptions(options);
        const appConfig = this.toAppProjectConfigInternal(workspaceRoot, options);

        // extends
        applyProjectConfigExtends(appConfig);

        const appConfigEnvApplied = JSON.parse(JSON.stringify(appConfig)) as AppProjectConfigInternal;

        // apply env
        applyProjectConfigWithEnvironment(appConfigEnvApplied, buildOptions.environment);

        return of(null)
            .pipe(
                concatMap(() => {
                    if (appConfigEnvApplied.skip) {
                        const configName = appConfigEnvApplied.name ? appConfigEnvApplied.name : '';
                        this.context.logger.info(`Skip building ${configName}`);

                        return of({ success: true });
                    }

                    const angularBuildContext = new AngularBuildContext({
                        workspaceRoot: workspaceRoot,
                        startTime: this._startTime,
                        host: this.context.host,
                        projectConfig: appConfigEnvApplied,
                        projectConfigWithoutEnvApplied: appConfig,
                        buildOptions: buildOptions
                    });

                    let wpConfig: webpack.Configuration;
                    try {
                        wpConfig = getAppWebpackConfig(angularBuildContext);
                    } catch (err) {
                        return throwError(err);
                    }

                    return runWebpackForArchitectBuilder(wpConfig, buildOptions, AngularBuildContext.logger);
                }),
                concatMap(buildEvent => {
                    if (buildEvent.success) {
                        const duration = Date.now() - this._startTime;
                        this.context.logger.info(`Build completed in [${duration}ms]`);
                        if (buildOptions.beep && !buildOptions.watch && process.stdout.isTTY) {
                            process.stdout.write('\x07');
                        }
                    }

                    return of(buildEvent);
                })
            );
    }

    private toAppProjectConfigInternal(workspaceRoot: string, options: AppBuilderOptions): AppProjectConfigInternal {
        applyAppConfigCompat(options);

        const appConfig: AppProjectConfigInternal = {
            _index: 0,
            _projectType: 'app',
            _configPath: path.resolve(workspaceRoot, 'angular.json'),
            ...options
        };

        // Delete empty
        Object.keys(appConfig)
            .forEach(key => {
                /* tslint:disable:no-unsafe-any */
                // tslint:disable-next-line:no-any
                const configAny = appConfig as (AppProjectConfigInternal & { [key: string]: any });
                if (configAny[key] && Array.isArray(configAny[key]) && configAny[key].length === 0) {
                    // tslint:disable-next-line: no-dynamic-delete
                    delete configAny[key];
                } else if (configAny[key] && typeof configAny[key] === 'object' &&
                    (Object.keys(configAny[key]).length === 0 || this.isDefaultObject(configAny[key]))) {
                    // tslint:disable-next-line: no-dynamic-delete
                    delete configAny[key];
                }
                /* tslint:enable:no-unsafe-any */
            });

        return appConfig;
    }

    // tslint:disable-next-line:no-any
    private isDefaultObject(obj: { [key: string]: any }): boolean {
        let hasData = false;
        /* tslint:disable:no-unsafe-any */
        Object.keys(obj)
            .forEach(key => {
                if (obj[key] && Array.isArray(obj[key]) && obj[key].length === 0) {
                    // do nothing
                } else if (obj[key] && typeof obj[key] === 'object' && Object.keys(obj[key]).length === 0) {
                    // do nothing
                } else {
                    hasData = true;
                }
            });
        /* tslint:enable:no-unsafe-any */

        return !hasData;
    }
}

// tslint:disable-next-line:no-default-export
export default AppBuilder;
