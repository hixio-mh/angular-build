import * as path from 'path';

import { pathExists } from 'fs-extra';

import { AngularBuildContext } from '../build-context';
import { AngularBuildConfig, JsonObject, LibProjectConfigBase, ProjectConfigBase } from '../models';
import { InvalidConfigError } from '../models/errors';
import {
    AngularBuildConfigInternal,
    AppProjectConfigInternal,
    LibProjectConfigInternal,
    ProjectConfigInternal
} from '../models/internals';
import { findUp, formatValidationError, normalizeRelativePath, readJson, validateSchema } from '../utils';

export async function applyProjectConfigExtends<TConfig extends ProjectConfigBase>(
    projectConfig: ProjectConfigInternal<TConfig>,
    projects: ProjectConfigInternal<TConfig>[] = [],
    workspaceRoot: string): Promise<void> {
    if (!projectConfig.extends) {
        return;
    }

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
            baseProjectConfig = await getBaseProjectConfigForProjectExtends(extendsName, projectConfig, projects, workspaceRoot);
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
            await applyProjectConfigExtends(clonedBaseProject, projects, workspaceRoot);

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

export async function getBaseProjectConfigForBuiltInExtends<TConfig extends ProjectConfigBase>(
    extendsName: string,
    projectConfig: ProjectConfigInternal<TConfig>,
    workspaceRoot: string): Promise<AppProjectConfigInternal | LibProjectConfigInternal> {
    const errPrefix = 'Error in extending options';
    const errSuffix = projectConfig._configPath ? `, config file: ${path.relative(workspaceRoot, projectConfig._configPath)}.` : '';
    const invalidExtendsErrMsg = `${errPrefix}, invalid extends name: ${extendsName}${errSuffix}`;
    const projectTypeMisMatchErrMsg = `${errPrefix}, can't extend from different project type, extends name: ${extendsName}${errSuffix}`;
    const extendsConfigNotFoundErrMsg = `${errPrefix}, could not found built-in project config to be extended, extends name: ${extendsName}${errSuffix}`;

    const builtInConfigFileName = extendsName.startsWith('ngb:')
        ? extendsName.substr('ngb:'.length).trim()
        : extendsName.substr('angular-build:'.length).trim();

    if (!builtInConfigFileName) {
        throw new InvalidConfigError(invalidExtendsErrMsg);
    }

    const targetProjectType = /^lib-/.test(builtInConfigFileName) ? 'lib' : 'app';
    if (targetProjectType !== projectConfig._projectType) {
        throw new InvalidConfigError(projectTypeMisMatchErrMsg);
    }

    const buildInConfigsRootPath = path.resolve(__dirname, '../../configs');
    const builtInConfigPath = path.resolve(buildInConfigsRootPath, `ngb-${builtInConfigFileName}.json`);

    if (!await pathExists(builtInConfigPath)) {
        throw new InvalidConfigError(extendsConfigNotFoundErrMsg);
    }

    let config = (await readJson(builtInConfigPath)) as (AppProjectConfigInternal | LibProjectConfigInternal);

    config._projectType = projectConfig._projectType;
    config._configPath = builtInConfigPath;

    if (projectConfig._projectType === 'lib' && projectConfig._configPath && projectConfig.root) {
        const configRootPath = path.dirname(projectConfig._configPath);
        const projectRootPath = path.resolve(path.dirname(projectConfig._configPath), projectConfig.root);

        const newProdOptions: LibProjectConfigBase = {};

        const bannerFilePath = await findUp(['banner.txt'], projectRootPath, configRootPath);
        if (bannerFilePath) {
            newProdOptions.banner = normalizeRelativePath(path.relative(projectRootPath, bannerFilePath));
        }

        const readmeFilePath = await findUp(['README.md'], projectRootPath, configRootPath);
        const licenseFilePath = await findUp(['LICENSE', 'LICENSE.txt'], projectRootPath, configRootPath);

        if (readmeFilePath || licenseFilePath) {
            newProdOptions.copy = [];
            if (readmeFilePath) {
                newProdOptions.copy.push(normalizeRelativePath(path.relative(projectRootPath, readmeFilePath)));
            }
            if (licenseFilePath) {
                newProdOptions.copy.push(normalizeRelativePath(path.relative(projectRootPath, licenseFilePath)));
            }
        }

        const newConfig = {
            envOverrides: {
                prod: {
                    bundles: true,
                    packageJsonCopy: true,
                    ...newProdOptions
                }
            }
        };

        config = { ...config, ...newConfig };
    }

    // const extendLevel: number = (projectConfig as any)._extendLevel || 0;
    // config._extendLevel = extendLevel + 1;

    return config;
}

// tslint:disable-next-line: max-func-body-length
export async function getBaseProjectConfigForFileExtends<TConfig extends ProjectConfigBase>(
    extendsName: string,
    projectConfig: ProjectConfigInternal<TConfig>,
    workspaceRoot: string): Promise<AppProjectConfigInternal | LibProjectConfigInternal | null> {
    let baseProjectConfig: AppProjectConfigInternal | LibProjectConfigInternal | null = null;
    const errPrefix = 'Error in extending options';
    const errSuffix = projectConfig._configPath ? `, config file: ${path.relative(workspaceRoot, projectConfig._configPath)}.` : '';
    const invalidExtendsErrMsg = `${errPrefix}, invalid extends name: ${extendsName}${errSuffix}`;
    const projectTypeMisMatchErrMsg = `${errPrefix}, can't extend from different project type, extends name: ${extendsName}${errSuffix}`;
    const extendsFileNotFoundErrMsg = `${errPrefix}, could not found project config file to be extended, extends name: ${extendsName}${errSuffix}`;

    if (!projectConfig._configPath) {
        throw new InvalidConfigError(invalidExtendsErrMsg);
    }

    const parts = extendsName.split(':');
    if (parts.length < 1 || parts.length > 4) {
        throw new InvalidConfigError(invalidExtendsErrMsg);
    }

    const extendsFilePath = path.isAbsolute(parts[1]) ? path.resolve(parts[1]) : path.resolve(path.dirname(projectConfig._configPath), parts[1]);
    const projectType = parts.length >= 3 ? parts[2] : null;
    const projectName = parts.length === 4 ? parts[3] : null;


    if (!await pathExists(extendsFilePath)) {
        throw new InvalidConfigError(extendsFileNotFoundErrMsg);
    }

    // tslint:disable-next-line: no-any
    let config: JsonObject | null = null;

    try {
        // tslint:disable-next-line: no-any
        config = (await readJson(extendsFilePath)) as { [key: string]: any };

    } catch (jsonErr2) {
        throw new InvalidConfigError(`Error in reading extend file: ${path.relative(workspaceRoot, extendsFilePath)}, extends name: ${extendsName}${errSuffix}`);
    }

    if (!config) {
        throw new InvalidConfigError(`Error in reading extend file: ${path.relative(workspaceRoot, extendsFilePath)}, extends name: ${extendsName}${errSuffix}`);
    }

    if (projectName && projectType) {
        if (projectType !== projectConfig._projectType) {
            throw new InvalidConfigError(projectTypeMisMatchErrMsg);
        }

        const angularBuildConfig = config as unknown as AngularBuildConfig;

        if (projectConfig._configPath !== extendsFilePath) {
            if (angularBuildConfig.$schema) {
                delete angularBuildConfig.$schema;
            }

            const angularBuildConfigSchema = await AngularBuildContext.getAngularBuildConfigSchema();
            const errors = validateSchema(angularBuildConfigSchema, angularBuildConfig);
            if (errors.length) {
                const errMsg = errors.map(err => formatValidationError(angularBuildConfigSchema, err)).join('\n');
                throw new InvalidConfigError(
                    `${errPrefix}, invalid configuration.\n\n${
                    errMsg}`);
            }
        }

        // Set angular build defaults
        const angularBuildConfigInternal = angularBuildConfig as AngularBuildConfigInternal;
        angularBuildConfigInternal.libs = angularBuildConfigInternal.libs || [];
        angularBuildConfigInternal.apps = angularBuildConfigInternal.apps || [];

        // extends
        if (projectConfig._projectType === 'lib') {
            for (const libConfig of angularBuildConfigInternal.libs) {
                if (libConfig.name === projectName) {
                    baseProjectConfig = libConfig;
                    break;
                }
            }
        } else {
            for (const appConfig of angularBuildConfigInternal.apps) {
                if (appConfig.name === projectName) {
                    baseProjectConfig = appConfig;
                    break;
                }
            }
        }
    } else {
        const projectConfigSchema = projectConfig._projectType === 'lib' ?
            await AngularBuildContext.getLibProjectConfigSchema() :
            await AngularBuildContext.getAppProjectConfigSchema();
        const errors = validateSchema(projectConfigSchema, config);
        if (errors.length) {
            const errMsg = errors.map(err => formatValidationError(projectConfigSchema, err)).join('\n');
            throw new InvalidConfigError(
                `${errPrefix}, invalid configuration.\n\n${
                errMsg}`);
        }

        baseProjectConfig = config as unknown as (AppProjectConfigInternal | LibProjectConfigInternal);
    }

    if (baseProjectConfig) {
        baseProjectConfig._configPath = extendsFilePath;
        baseProjectConfig._projectType = projectConfig._projectType;
    }

    return baseProjectConfig;
}

export async function getBaseProjectConfigForProjectExtends<TConfig extends ProjectConfigBase>(
    extendsName: string,
    projectConfig: ProjectConfigInternal<TConfig>,
    projects: ProjectConfigInternal<TConfig>[] = [],
    workspaceRoot: string): Promise<AppProjectConfigInternal | LibProjectConfigInternal | null> {
    if (projects.length < 1) {
        return null;
    }

    const errPrefix = 'Error in extending options';
    const errSuffix = projectConfig._configPath ? `, config file: ${path.relative(workspaceRoot, projectConfig._configPath)}.` : '';
    const invalidExtendsErrMsg = `${errPrefix}, invalid extends name: ${extendsName}${errSuffix}`;
    const sameExtendNameErrMsg = `${errPrefix}, extend project name must not be the same as current project name, extends name: ${extendsName}${errSuffix}`;
    const projectTypeMisMatchErrMsg = `${errPrefix}, can't extend from different project type, extends name: ${extendsName}${errSuffix}`;
    const extendsConfigNotFoundErrMsg = `${errPrefix}, could not found project config to be extended, extends name: ${extendsName}${errSuffix}`;

    const projectName = extendsName.substr('project:'.length).trim();
    if (!projectName) {
        throw new InvalidConfigError(invalidExtendsErrMsg);
    }

    const foundProject =
        projects.find(project => project.name === projectName);

    if (!foundProject) {
        throw new InvalidConfigError(extendsConfigNotFoundErrMsg);
    }

    if (projectConfig.name && foundProject.name === projectConfig.name) {
        throw new InvalidConfigError(sameExtendNameErrMsg);
    }

    if (foundProject._projectType !== projectConfig._projectType) {
        throw new InvalidConfigError(projectTypeMisMatchErrMsg);
    }

    return foundProject;
}
