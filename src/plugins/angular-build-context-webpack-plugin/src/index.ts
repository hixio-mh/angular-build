// tslint:disable:no-any
// tslint:disable:no-unsafe-any

import * as webpack from 'webpack';

import { AngularBuildContext } from '../../../build-context';
import { AppProjectConfigInternal, LibProjectConfigInternal } from '../../../interfaces/internals';

export class AngularBuildContextWebpackPlugin<TConfig extends AppProjectConfigInternal | LibProjectConfigInternal> {

    get name(): string {
        return 'angular-build-context-webpack-plugin';
    }

    constructor(private readonly _angularBuildContext: AngularBuildContext<TConfig>) { }

    apply(compiler: webpack.Compiler): void {
        (compiler as any)._angularBuildContext = this._angularBuildContext;
        const count = AngularBuildContext.libCount + AngularBuildContext.appCount;
        const projectConfig = this._angularBuildContext.projectConfig;

        let configName: string;
        if (projectConfig.name) {
            configName = projectConfig.name;
        } else if (compiler.options.name) {
            configName = compiler.options.name;
        } else if (projectConfig._index != null) {

            configName = `${projectConfig._projectType === 'app' ? 'apps' : 'libs'}[${projectConfig._index}]`;
        } else {
            configName = 'with webpack';
        }

        AngularBuildContext.logger.info(`${count > 1 ? '\n' : ''}Processing ${configName}`);
    }
}
