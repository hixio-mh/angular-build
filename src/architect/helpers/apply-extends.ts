import * as path from 'path';

import { BuilderContext, targetFromTargetString } from '@angular-devkit/architect';
import { experimental, getSystemPath, normalize, resolve } from '@angular-devkit/core';

import { getBaseProjectConfigForBuiltInExtends, getBaseProjectConfigForFileExtends } from '../../helpers';
import { ProjectConfigBase } from '../../models';
import { InvalidConfigError } from '../../models/errors';
import {
    AppProjectConfigInternal,
    LibProjectConfigInternal,
    ProjectConfigInternal
} from '../../models/internals';
import { normalizeRelativePath } from '../../utils';

import { AppBuilderOptions, LibBuilderOptions } from '../models';

import { toAppConfigInternal, toLibConfigInternal } from './prepare-project-configs';

export async function applyProjectConfigExtends<TConfig extends ProjectConfigBase>(
    projectConfig: ProjectConfigInternal<TConfig>,
    context: BuilderContext,
    workspace: experimental.workspace.Workspace): Promise<void> {
    if (!projectConfig.extends) {
        return;
    }

    const workspaceRoot = getSystemPath(workspace.root);
    const errPrefix = 'Error in extending options';
    const errSuffix = projectConfig._configPath ? `, config file: ${path.relative(workspaceRoot, projectConfig._configPath)}.` : '';

    const extendArray = Array.isArray(projectConfig.extends) ? projectConfig.extends : [projectConfig.extends];

    for (const extendsName of extendArray) {
        if (!extendsName) {
            continue;
        }

        let baseProjectConfig: AppProjectConfigInternal | LibProjectConfigInternal | null | undefined = null;

        if (extendsName.startsWith('ngb:') || extendsName.startsWith('angular-build:')) {
            baseProjectConfig = await getBaseProjectConfigForBuiltInExtends(extendsName, projectConfig, workspaceRoot);
        } else if (extendsName.startsWith('project:')) {
            baseProjectConfig = await getBaseProjectConfigForProjectExtends(extendsName, projectConfig, context, workspace);
        } else if (extendsName.startsWith('file:')) {
            baseProjectConfig = await getBaseProjectConfigForFileExtends(extendsName, projectConfig, workspaceRoot);
        } else {
            throw new InvalidConfigError(`${errPrefix}, invalid extends name: ${extendsName}${errSuffix}`);
        }

        if (!baseProjectConfig) {
            continue;
        }

        const clonedBaseProject = JSON.parse(JSON.stringify(baseProjectConfig)) as ProjectConfigInternal<TConfig>;
        if (clonedBaseProject.extends) {
            await applyProjectConfigExtends(clonedBaseProject, context, workspace);

            delete clonedBaseProject.extends;
        }

        if (clonedBaseProject.name) {
            delete clonedBaseProject.name;
        }

        if (clonedBaseProject.$schema) {
            delete clonedBaseProject.$schema;
        }

        const extendedConfig = { ...clonedBaseProject, ...projectConfig };
        Object.assign(projectConfig, extendedConfig);
    }
}

export async function getBaseProjectConfigForProjectExtends<TConfig extends ProjectConfigBase>(
    extendsName: string,
    projectConfig: ProjectConfigInternal<TConfig>,
    context: BuilderContext,
    workspace: experimental.workspace.Workspace): Promise<AppProjectConfigInternal | LibProjectConfigInternal> {
    const workspaceRoot = getSystemPath(workspace.root);

    const errPrefix = 'Error in extending options';
    const errSuffix = projectConfig._configPath ? `, config file: ${path.relative(workspaceRoot, projectConfig._configPath)}.` : '';
    const invalidExtendsErrMsg = `${errPrefix}, invalid extends name: ${extendsName}${errSuffix}`;
    const sameExtendNameErrMsg = `${errPrefix}, extend project name must not be the same as current project name, extends name: ${extendsName}${errSuffix}`;
    const projectTypeMisMatchErrMsg = `${errPrefix}, can't extend from different project type, extends name: ${extendsName}${errSuffix}`;
    const extendsConfigNotFoundErrMsg = `${errPrefix}, could not found project config to be extended, extends name: ${extendsName}${errSuffix}`;


    let projectName = extendsName.substr('project:'.length).trim();
    let configurationTarget = '';

    if (projectName.indexOf(':') > -1) {
        const parts = projectName.split(':');
        if (parts.length < 1 || parts.length > 2) {
            throw new InvalidConfigError(invalidExtendsErrMsg);
        }

        projectName = parts[0].trim();

        if (parts.length === 2) {
            configurationTarget = parts[1].trim();
        }
    }

    if (!projectName) {
        throw new InvalidConfigError(invalidExtendsErrMsg);
    }

    if (projectConfig.name === projectName) {
        throw new InvalidConfigError(sameExtendNameErrMsg);
    }

    const foundProject = workspace.getProject(projectName);
    if (!foundProject) {
        throw new InvalidConfigError(extendsConfigNotFoundErrMsg);
    }

    const foundProjectType = foundProject.projectType === 'library' ? 'lib' : 'app';

    if (foundProjectType !== projectConfig._projectType) {
        throw new InvalidConfigError(projectTypeMisMatchErrMsg);
    }

    const targetString = configurationTarget ? `${projectName}:build:${configurationTarget}` : `${projectName}:build`;
    const foundTarget = targetFromTargetString(targetString);
    if (!foundTarget) {
        throw new InvalidConfigError(extendsConfigNotFoundErrMsg);
    }

    const rawBuilderOptions = await context.getTargetOptions(foundTarget);
    const builderName = await context.getBuilderNameForTarget(foundTarget);
    const builderOptions = await context.validateOptions(
        rawBuilderOptions,
        builderName,
    );

    const clonedBuilderOptions = JSON.parse(JSON.stringify(builderOptions)) as AppBuilderOptions | LibBuilderOptions;

    if (!clonedBuilderOptions.root) {
        const foundProjectRoot = getSystemPath(resolve(workspace.root, normalize(foundProject.root)));
        clonedBuilderOptions.root = normalizeRelativePath(path.relative(workspaceRoot, foundProjectRoot));
    }

    if (!clonedBuilderOptions.name) {
        clonedBuilderOptions.name = projectName;
    }

    return projectConfig._projectType === 'lib' ?
        toLibConfigInternal(workspaceRoot, clonedBuilderOptions) :
        toAppConfigInternal(workspaceRoot, clonedBuilderOptions);
}
