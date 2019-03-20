import { Stats } from 'fs';
import * as path from 'path';

import { BuilderContext } from '@angular-devkit/architect/src/index2';
import { experimental, getSystemPath, json, normalize, resolve, schema, virtualFs } from '@angular-devkit/core';

import { Configuration } from 'webpack';

import { AngularBuildContext } from '../../build-context';
import { applyProjectConfigExtends, applyProjectConfigWithEnvironment } from '../../helpers';
import { BuildOptions } from '../../models';
import { AppProjectConfigInternal, LibProjectConfigInternal } from '../../models/internals';
import { normalizeRelativePath } from '../../utils';
import { getAppWebpackConfig } from '../../webpack-configs/app';

import { AppBuilderOptions, LibBuilderOptions } from '../models';

import { applyAppBuilderOptionsCompat, applyLibBuilderOptionsCompat, getBuildOptionsFromBuilderOptions } from './prepare-compat';

function toAppConfigInternal(workspaceRoot: string, options: AppBuilderOptions): AppProjectConfigInternal {
    applyAppBuilderOptionsCompat(options);

    const appConfig: AppProjectConfigInternal = {
        _index: 0,
        _projectType: 'app',
        _configPath: path.resolve(workspaceRoot, 'angular.json'),
        ...options
    };

    // Delete empty
    deleteEmpty(appConfig);

    return appConfig;
}

function toLibConfigInternal(workspaceRoot: string, options: LibBuilderOptions): LibProjectConfigInternal {
    applyLibBuilderOptionsCompat(options);

    const libConfig: LibProjectConfigInternal = {
        _index: 0,
        _projectType: 'lib',
        _configPath: path.resolve(workspaceRoot, 'angular.json'),
        ...options
    };

    // Delete empty
    deleteEmpty(libConfig);

    return libConfig;
}

// tslint:disable-next-line: no-any
function isDefaultObject(obj: { [key: string]: any }): boolean {
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

function deleteEmpty(projectConfig: AppProjectConfigInternal | LibProjectConfigInternal): void {
    Object.keys(projectConfig)
        .forEach(key => {
            /* tslint:disable:no-unsafe-any */
            // tslint:disable-next-line:no-any
            const configAny = projectConfig as { [key: string]: any };
            if (configAny[key] && Array.isArray(configAny[key]) && configAny[key].length === 0) {
                // tslint:disable-next-line: no-dynamic-delete
                delete configAny[key];
            } else if (configAny[key] && typeof configAny[key] === 'object' &&
                (Object.keys(configAny[key]).length === 0 || isDefaultObject(configAny[key]))) {
                // tslint:disable-next-line: no-dynamic-delete
                delete configAny[key];
            }
            /* tslint:enable:no-unsafe-any */
        });
}

export interface WebpackConfigFromContext {
    workspace: experimental.workspace.Workspace;
    webpackConfig: Configuration | null;
    buildOptions: BuildOptions;
}

export async function getWebpackConfigFromContext(
    projectType: 'app' | 'lib',
    builderSchema: json.JsonObject,
    context: BuilderContext,
    host: virtualFs.Host<Stats>,
    startTime: number
): Promise<WebpackConfigFromContext> {
    const registry = new schema.CoreSchemaRegistry();
    registry.addPostTransform(schema.transforms.addUndefinedDefaults);

    const workspace = await experimental.workspace.Workspace.fromPath(
        host,
        normalize(context.workspaceRoot),
        registry
    );

    const projectName = context.target ? context.target.project : workspace.getDefaultProjectName();

    if (!projectName) {
        throw new Error('Must either have a target from the context or a default project.');
    }

    // const workspaceSystemPath = getSystemPath(normalize(context.workspaceRoot));
    const workspaceRoot = getSystemPath(workspace.root);
    const projectRoot = getSystemPath(resolve(workspace.root, normalize(workspace.getProject(projectName).root)));

    const clonedBuilderOptions = JSON.parse(JSON.stringify(builderSchema)) as AppBuilderOptions | LibBuilderOptions;

    if (!clonedBuilderOptions.root) {
        clonedBuilderOptions.root = normalizeRelativePath(path.relative(workspaceRoot, projectRoot));
    }

    const buildOptions = getBuildOptionsFromBuilderOptions(clonedBuilderOptions);

    const projectConfig = projectType === 'lib' ? toLibConfigInternal(workspaceRoot, clonedBuilderOptions) : toAppConfigInternal(workspaceRoot, clonedBuilderOptions);

    // extends
    await applyProjectConfigExtends(projectConfig);

    const projectConfigEnvApplied = JSON.parse(JSON.stringify(projectConfig)) as (AppProjectConfigInternal | LibProjectConfigInternal);

    // apply env
    applyProjectConfigWithEnvironment(projectConfigEnvApplied, buildOptions.environment);

    if (projectConfigEnvApplied.skip) {
        return {
            workspace: workspace,
            buildOptions: buildOptions,
            webpackConfig: null
        };
    }

    const angularBuildContext = new AngularBuildContext({
        workspaceRoot: workspaceRoot,
        startTime: startTime,
        host: host,
        projectConfig: projectConfigEnvApplied,
        projectConfigWithoutEnvApplied: projectConfig,
        buildOptions: buildOptions
    });
    await angularBuildContext.init();

    const webpackConfig = await getAppWebpackConfig(angularBuildContext);

    return {
        workspace: workspace,
        buildOptions: buildOptions,
        webpackConfig: webpackConfig
    };
}
