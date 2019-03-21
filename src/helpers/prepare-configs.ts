// tslint:disable:no-any
// tslint:disable:no-unsafe-any

import * as path from 'path';

import { pathExists } from 'fs-extra';

import { AngularBuildConfig, LibProjectConfigBase, ProjectConfigBase } from '../models';
import { InternalError, InvalidConfigError } from '../models/errors';
import { AngularBuildConfigInternal, AppProjectConfigInternal, LibProjectConfigInternal, ProjectConfigInternal } from '../models/internals';
import { findUp, formatValidationError, normalizeRelativePath, readJson, validateSchema } from '../utils';

export function applyProjectConfigWithEnvironment(
    projectConfig: AppProjectConfigInternal | LibProjectConfigInternal,
    env: { [key: string]: boolean | string }): void {

    if (!projectConfig ||
        !projectConfig.envOverrides ||
        Object.keys(projectConfig.envOverrides).length === 0) {
        return;
    }

    const buildTargets: string[] = [];

    if (env.production || env.prod) {
        if (!buildTargets.includes('prod')) {
            buildTargets.push('prod');
        }
        if (!buildTargets.includes('production')) {
            buildTargets.push('production');
        }
    } else if (env.dev || env.development) {
        buildTargets.push('dev');
        buildTargets.push('development');
    }

    const preDefinedKeys = ['prod', 'production', 'dev', 'development'];

    Object.keys(env)
        .filter(key => !preDefinedKeys.includes(key.toLowerCase()) &&
            !buildTargets.includes(key) &&
            env[key] &&
            (typeof env[key] === 'boolean' || env[key] === 'true'))
        .forEach(key => {
            buildTargets.push(key);
        });

    Object.keys(projectConfig.envOverrides)
        .forEach((buildTargetKey: string) => {
            const targetName = buildTargetKey;
            const targets = targetName.split(',');
            targets.forEach(t => {
                t = t.trim();
                if (buildTargets.indexOf(t) > -1) {
                    const newConfig = (projectConfig.envOverrides as any)[t];
                    if (newConfig && typeof newConfig === 'object') {
                        overrideProjectConfig(projectConfig, newConfig);
                    }
                }
            });
        });
}

// tslint:disable:max-func-body-length
export async function applyProjectConfigExtends<TConfig extends ProjectConfigBase>(projectConfig:
    ProjectConfigInternal<TConfig>,
    projects?: ProjectConfigInternal<TConfig>[]): Promise<void> {
    if (!projectConfig.extends) {
        return;
    }

    const extendArray = Array.isArray(projectConfig.extends) ? projectConfig.extends : [projectConfig.extends];
    for (const extendName of extendArray) {
        if (!extendName) {
            continue;
        }

        let foundBaseProject: AppProjectConfigInternal | LibProjectConfigInternal | null | undefined = null;

        if (extendName.startsWith('ngb:') || extendName.startsWith('angular-build:')) {
            let builtInConfigFileName = extendName.startsWith('ngb:')
                ? extendName.substr('ngb:'.length).trim()
                : extendName.substr('angular-build:'.length).trim();
            if (!builtInConfigFileName) {
                throw new InvalidConfigError(
                    `Can't extend from non existed config file - ${extendName}, check your configuration file - ${
                    projectConfig._configPath}.`);
            }

            const targetProjectType = /^lib-/.test(builtInConfigFileName) ? 'lib' : 'app';
            if (targetProjectType !== projectConfig._projectType) {
                throw new InvalidConfigError(
                    `Can't extend from different project type, check your configuration file - ${
                    projectConfig._configPath}.`);
            }

            builtInConfigFileName = `ngb-${builtInConfigFileName}.json`;
            let builtInConfigPath = '';

            if (await pathExists(path.resolve(__dirname, `../configs/${builtInConfigFileName}`))) {
                builtInConfigPath = path.resolve(__dirname, `../configs/${builtInConfigFileName}`);
            } else if (await pathExists(path.resolve(__dirname, `../../configs/${builtInConfigFileName}`))) {
                builtInConfigPath = path.resolve(__dirname, `../../configs/${builtInConfigFileName}`);
            }

            if (!builtInConfigPath) {
                throw new InvalidConfigError(
                    `Can't extend from non existed config file - ${builtInConfigPath}, check your configuration file - ${
                    projectConfig._configPath}.`);
            }

            let config = await readJson(builtInConfigPath);

            (config as ProjectConfigInternal<TConfig>)._projectType = projectConfig._projectType;
            (config as ProjectConfigInternal<TConfig>)._configPath = builtInConfigPath;

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

            const extendLevel: number = (projectConfig as any)._extendLevel || 0;
            config._extendLevel = extendLevel + 1;

            foundBaseProject = config;
        } else if (extendName.startsWith('projects:')) {
            if ((projectConfig as any)._extendLevel || !projects || projects.length < 2) {
                continue;
            }

            const projectName = extendName.substr('projects:'.length).trim();
            if (!projectName) {
                throw new InvalidConfigError(
                    `Can't extend from non existed config file - ${extendName}, check your configuration file - ${
                    projectConfig._configPath}.`);
            }

            const tempFoundProject =
                projects.find(project => project.name === projectName);

            if (!tempFoundProject) {
                throw new InvalidConfigError(
                    `Can't extend from non existed config file - ${extendName}, check your configuration file - ${
                    projectConfig._configPath}.`);
            }

            if (tempFoundProject._projectType !== projectConfig._projectType) {
                throw new InvalidConfigError(
                    `Can't extend from different project type, check your configuration file - ${
                    projectConfig._configPath}.`);
            }

            if (tempFoundProject.name !== projectConfig.name &&
                tempFoundProject._index !== projectConfig._index &&
                (!tempFoundProject._configPath || (tempFoundProject._configPath === projectConfig._configPath))) {
                foundBaseProject = tempFoundProject;
            }
        } else if (projectConfig._configPath) {
            let destPath = extendName;
            let projectType = '';
            let projectName = '';

            if (extendName.indexOf(':') > 0) {
                const parts = extendName.split(':');
                if (parts.length === 3) {
                    [destPath, projectType, projectName] = parts;
                }
            }

            destPath = path.isAbsolute(destPath)
                ? path.resolve(destPath)
                : path.resolve(path.dirname(projectConfig._configPath), destPath);

            if (!await pathExists(destPath)) {
                throw new InvalidConfigError(
                    `Can't extend from non existed config file - ${destPath}, check your configuration file - ${
                    projectConfig._configPath}.`);
            }

            let config: any = null;

            try {
                config = await pathExists(destPath);

            } catch (jsonErr2) {
                throw new InvalidConfigError(`Invalid configuration, error: ${jsonErr2.message || jsonErr2}.`);
            }

            if (!config) {
                throw new InvalidConfigError(
                    `Can't extend from non existed config file - ${destPath}, check your configuration file - ${
                    projectConfig._configPath}.`);
            }

            if (projectName) {
                if (projectType !== projectConfig._projectType) {
                    throw new InvalidConfigError(
                        `Can't extend from different project type, check your configuration file - ${
                        projectConfig._configPath}.`);
                }

                const angularBuildConfig = config as AngularBuildConfig;

                if (projectConfig._configPath !== destPath) {
                    // Validate schema
                    const schemaFileName = 'schema.json';
                    let schemaPath = '';
                    if (await pathExists(path.resolve(__dirname, `../schemas/${schemaFileName}`))) {
                        schemaPath = `../schemas/${schemaFileName}`;
                    } else if (await pathExists(path.resolve(__dirname, `../../schemas/${schemaFileName}`))) {
                        schemaPath = `../../schemas/${schemaFileName}`;
                    }

                    if (!schemaPath) {
                        throw new InternalError("The angular-build schema file doesn't exist.");
                    }

                    // tslint:disable-next-line:non-literal-require
                    const schema = require(schemaPath);
                    if (schema.$schema) {
                        delete schema.$schema;
                    }
                    if (angularBuildConfig.$schema) {
                        delete angularBuildConfig.$schema;
                    }

                    const errors = validateSchema(schema, angularBuildConfig);
                    if (errors.length) {
                        const errMsg = errors.map(err => formatValidationError(schema, err)).join('\n');
                        throw new InvalidConfigError(
                            `Invalid configuration.\n\n${
                            errMsg}`);
                    }
                }

                // Set angular build defaults
                const angularBuildConfigInternal = angularBuildConfig as AngularBuildConfigInternal;
                angularBuildConfigInternal.libs = angularBuildConfigInternal.libs || [];
                angularBuildConfigInternal.apps = angularBuildConfigInternal.apps || [];

                // extends
                if (projectConfig._projectType === 'lib') {
                    for (let i = 0; i < angularBuildConfigInternal.libs.length; i++) {
                        const libConfig = angularBuildConfigInternal.libs[i];

                        libConfig._index = i;
                        libConfig._projectType = 'lib';
                        libConfig._configPath = destPath;

                        if (libConfig.name === projectName) {
                            foundBaseProject = libConfig;

                            const extendLevel: number = (projectConfig as any)._extendLevel || 0;
                            (foundBaseProject as any)._extendLevel = extendLevel + 1;

                            break;
                        }
                    }
                } else {
                    for (let i = 0; i < angularBuildConfigInternal.apps.length; i++) {
                        const appConfig = angularBuildConfigInternal.apps[i];
                        appConfig._index = i;
                        appConfig._projectType = 'app';
                        appConfig._configPath = destPath;

                        if (appConfig.name === projectName) {
                            foundBaseProject = appConfig;

                            const extendLevel: number = (projectConfig as any)._extendLevel || 0;
                            (foundBaseProject as any)._extendLevel = extendLevel + 1;

                            break;
                        }
                    }
                }
            } else {
                // validate
                const schemaFileName = projectConfig._projectType === 'lib'
                    ? 'lib-project-config-schema.json'
                    : 'app-project-config-schema.json';
                let schemaPath = '';

                if (await pathExists(path.resolve(__dirname, `../schemas/${schemaFileName}`))) {
                    schemaPath = `../schemas/${schemaFileName}`;
                } else if (await pathExists(path.resolve(__dirname, `../../schemas/${schemaFileName}`))) {
                    schemaPath = `../../schemas/${schemaFileName}`;
                }

                if (!schemaPath) {
                    throw new InternalError("The angular-build schema file doesn't exist.");
                }

                // tslint:disable-next-line:non-literal-require
                const schema = require(schemaPath);
                if (schema.$schema) {
                    delete schema.$schema;
                }
                if (config.$schema) {
                    delete config.$schema;
                }

                const errors = validateSchema(schema, config);
                if (errors.length) {
                    const errMsg = errors.map(err => formatValidationError(schema, err)).join('\n');
                    throw new InvalidConfigError(
                        `Invalid configuration.\n\n${
                        errMsg}`);
                }

                (config as ProjectConfigInternal<TConfig>)._projectType = projectConfig._projectType;
                (config as ProjectConfigInternal<TConfig>)._configPath = projectConfig._configPath;

                const extendLevel: number = (projectConfig as any)._extendLevel || 0;
                config._extendLevel = extendLevel + 1;

                foundBaseProject = config;
            }

            if (foundBaseProject &&
                foundBaseProject.name &&
                !foundBaseProject.name.startsWith('ngb:') &&
                !foundBaseProject.name.startsWith('angular-build:') &&
                !projectConfig.name &&
                extendArray.length === 1 &&
                (foundBaseProject as any)._extendLevel === 1 &&
                !/(\\|\/)angular-build\.json$/.test(projectConfig._configPath)) {
                projectConfig.name = foundBaseProject.name;
            }
        }

        if (!foundBaseProject) {
            continue;
        }

        const clonedBaseProject = JSON.parse(JSON.stringify(foundBaseProject)) as ProjectConfigInternal<TConfig>;
        if (clonedBaseProject.extends) {
            await applyProjectConfigExtends(clonedBaseProject, projects);

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

export function mergeAppProjectConfigWithWebpackCli(appConfig: AppProjectConfigInternal,
    commandOptions: { [key: string]: any }): void {
    if (commandOptions.target && !appConfig.platformTarget) {
        appConfig.platformTarget = commandOptions.target;
    }

    if (commandOptions.outputPublicPath) {
        appConfig.publicPath = commandOptions.outputPublicPath;
    }

    if (commandOptions.devtool) {
        appConfig.sourceMap = true;
        appConfig.sourceMapDevTool = commandOptions.devtool;
    }
}

function overrideProjectConfig(oldConfig: any, newConfig: any): void {
    if (!newConfig || !oldConfig || typeof newConfig !== 'object' || Object.keys(newConfig).length === 0) {
        return;
    }

    Object.keys(newConfig).filter((key: string) => key !== 'envOverrides').forEach((key: string) => {
        oldConfig[key] = JSON.parse(JSON.stringify(newConfig[key]));
    });
}
