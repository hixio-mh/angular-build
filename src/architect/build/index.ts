import { createBuilder } from '@angular-devkit/architect';
import { json } from '@angular-devkit/core';

import { from, of } from 'rxjs';
import { switchMap } from 'rxjs/operators';

import { getWebpackRunOptions, runWebpack } from '../helpers';
import { LibBuilderOptions } from '../models';

export type LibBuilderSchema = json.JsonObject & LibBuilderOptions;

// tslint:disable-next-line: no-default-export
export default createBuilder<LibBuilderSchema>((options, context) => {
    return from(getWebpackRunOptions(options, context))
        .pipe(
            switchMap(runOptions => {
                const startTime = runOptions.startTime;

                if (runOptions.webpackConfig == null) {
                    context.logger.info('Build skipping by configuration...');

                    return of({ success: true });
                }

                return runWebpack(runOptions.webpackConfig, runOptions.buildOptions, context.logger, startTime);
            })
        );
});

