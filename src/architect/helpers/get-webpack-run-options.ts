import * as path from 'path';

import { BuilderContext } from '@angular-devkit/architect';
import { experimental, getSystemPath, json, normalize, resolve, schema } from '@angular-devkit/core';
import { NodeJsSyncHost } from '@angular-devkit/core/node';

import { Configuration } from 'webpack';

import { AngularBuildContext } from '../../build-context';
import { BuildOptions } from '../../models';
import { normalizeRelativePath } from '../../utils';
import { getAppWebpackConfig } from '../../webpack-configs/app';
import { getLibWebpackConfig } from '../../webpack-configs/lib';

import { AppBuilderOptions, LibBuilderOptions } from '../models';

import { applyProjectConfigExtends } from './apply-extends';
import { getBuildOptionsFromBuilderOptions } from './prepare-build-options';
import { toAppConfigInternal, toLibConfigInternal } from './prepare-project-configs';


export interface WebpackRunOptions {
    workspace: experimental.workspace.Workspace;
    webpackConfig: Configuration | null;
    buildOptions: BuildOptions;
    startTime: number;
}

// tslint:disable-next-line: max-func-body-length
export async function getWebpackRunOptions(builderSchema: json.JsonObject, context: BuilderContext): Promise<WebpackRunOptions> {
    const startTime = Date.now();
    const host = new NodeJsSyncHost();

    const registry = new schema.CoreSchemaRegistry();
    // TODO: To review
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

    const project = workspace.getProject(projectName);
    const workspaceRoot = getSystemPath(workspace.root);
    const projectRoot = getSystemPath(resolve(workspace.root, normalize(project.root)));
    const projectType = project.projectType === 'library' ? 'lib' : 'app';

    AngularBuildContext.init({
        startTime: startTime,
        workspaceRoot: workspaceRoot,
        logger: context.logger
    });

    const clonedBuilderOptions = JSON.parse(JSON.stringify(builderSchema)) as AppBuilderOptions | LibBuilderOptions;

    if (!clonedBuilderOptions.root) {
        clonedBuilderOptions.root = normalizeRelativePath(path.relative(workspaceRoot, projectRoot));
    }

    if (!clonedBuilderOptions.name) {
        clonedBuilderOptions.name = projectName;
    }

    const buildOptions = getBuildOptionsFromBuilderOptions(clonedBuilderOptions);
    const projectConfigRaw = projectType === 'lib' ? toLibConfigInternal(workspaceRoot, clonedBuilderOptions) : toAppConfigInternal(workspaceRoot, clonedBuilderOptions);

    await applyProjectConfigExtends(
        projectConfigRaw,
        context,
        workspace);

    const angularBuildContext = new AngularBuildContext({
        projectConfigRaw: projectConfigRaw,
        buildOptions: buildOptions,
        host: host
    });
    await angularBuildContext.init();

    if (angularBuildContext.projectConfig.skip) {
        return {
            workspace: workspace,
            buildOptions: buildOptions,
            webpackConfig: null,
            startTime: startTime
        };
    }

    const webpackConfig = projectType === 'lib' ? await getLibWebpackConfig(angularBuildContext) : await getAppWebpackConfig(angularBuildContext);

    return {
        workspace: workspace,
        buildOptions: buildOptions,
        webpackConfig: webpackConfig,
        startTime: startTime
    };
}
