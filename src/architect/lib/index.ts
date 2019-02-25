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
    applyLibConfigCompat,
    applyProjectConfigExtends,
    applyProjectConfigWithEnvironment,
    getBuildOptionsFromBuilderOptions,
    runWebpackForArchitectBuilder
} from '../../helpers';
import { LibBuilderOptions } from '../../models';
import { LibProjectConfigInternal } from '../../models/internals';
import { normalizeRelativePath } from '../../utils';
import { getLibWebpackConfig } from '../../webpack-configs/lib';

export class LibBuilder implements Builder<LibBuilderOptions> {
    private readonly _startTime = Date.now();

    constructor(public context: BuilderContext) { }

    run(builderConfig: BuilderConfiguration<LibBuilderOptions>): Observable<BuildEvent> {
        const workspaceRoot = getSystemPath(this.context.workspace.root);
        const projectRoot = getSystemPath(resolve(this.context.workspace.root, builderConfig.root));
        const options = JSON.parse(JSON.stringify(builderConfig.options)) as LibBuilderOptions;
        if (!options.root && builderConfig.root) {
            options.root = normalizeRelativePath(path.relative(workspaceRoot, projectRoot));
        }

        const buildOptions = getBuildOptionsFromBuilderOptions(options);
        const libConfig = this.toLibProjectConfigInternal(workspaceRoot, options);

        // extends
        applyProjectConfigExtends(libConfig);

        const libConfigEnvApplied = JSON.parse(JSON.stringify(libConfig)) as LibProjectConfigInternal;

        // apply env
        applyProjectConfigWithEnvironment(libConfigEnvApplied, buildOptions.environment);

        return of(null)
            .pipe(
                concatMap(() => {
                    if (libConfigEnvApplied.skip) {
                        const configName = libConfigEnvApplied.name ? libConfigEnvApplied.name : '';
                        this.context.logger.info(`Skip building ${configName}`);

                        return of({ success: true });
                    }

                    const angularBuildContext = new AngularBuildContext({
                        workspaceRoot: workspaceRoot,
                        startTime: this._startTime,
                        host: this.context.host,
                        projectConfig: libConfigEnvApplied,
                        projectConfigWithoutEnvApplied: libConfig,
                        buildOptions: buildOptions
                    });

                    let wpConfig: webpack.Configuration;
                    try {
                        wpConfig = getLibWebpackConfig(angularBuildContext);
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

    private toLibProjectConfigInternal(workspaceRoot: string, options: LibBuilderOptions): LibProjectConfigInternal {
        applyLibConfigCompat(options);

        const libConfig: LibProjectConfigInternal = {
            _index: 0,
            _projectType: 'lib',
            _configPath: path.resolve(workspaceRoot, 'angular.json'),
            ...options
        };

        // Delete empty
        Object.keys(libConfig)
            .forEach(key => {
                /* tslint:disable:no-unsafe-any */
                // tslint:disable-next-line:no-any
                const configAny = libConfig as (LibProjectConfigInternal & { [key: string]: any });
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

        return libConfig;
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
export default LibBuilder;
