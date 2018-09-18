// tslint:disable:no-any
// tslint:disable:no-unsafe-any

import { existsSync } from 'fs';
import * as path from 'path';

import { InternalError, InvalidConfigError } from '../error-models';
import {
    AngularBuildConfig,
    AppBuilderOptions,
    AssetPatternObjectCompat,
    BuildOptions,
    BuildOptionsCompat,
    LibBuilderOptions,
    ProjectConfigBase
} from '../interfaces';
import {
    AngularBuildConfigInternal,
    AppProjectConfigInternal,
    BuildOptionInternal,
    LibProjectConfigInternal,
    ProjectConfigInternal
} from '../interfaces/internals';
import { formatValidationError, readJsonSync, validateSchema } from '../utils';

import { normalizeEnvironment } from './normalize-environment';

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
export function applyProjectConfigExtends<TConfig extends ProjectConfigBase>(projectConfig:
    ProjectConfigInternal<TConfig>,
    projects?: ProjectConfigInternal<TConfig>[]): void {
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

            if (existsSync(path.resolve(__dirname, `../configs/${builtInConfigFileName}`))) {
                builtInConfigPath = path.resolve(__dirname, `../configs/${builtInConfigFileName}`);
            } else if (existsSync(path.resolve(__dirname, `../../configs/${builtInConfigFileName}`))) {
                builtInConfigPath = path.resolve(__dirname, `../../configs/${builtInConfigFileName}`);
            }

            if (!builtInConfigPath) {
                throw new InvalidConfigError(
                    `Can't extend from non existed config file - ${builtInConfigPath}, check your configuration file - ${
                    projectConfig._configPath}.`);
            }

            const config = readJsonSync(builtInConfigPath);

            (config as ProjectConfigInternal<TConfig>)._projectType = projectConfig._projectType;
            (config as ProjectConfigInternal<TConfig>)._configPath = builtInConfigPath;

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

            if (!existsSync(destPath)) {
                throw new InvalidConfigError(
                    `Can't extend from non existed config file - ${destPath}, check your configuration file - ${
                    projectConfig._configPath}.`);
            }

            let config: any = null;

            try {
                config = readJsonSync(destPath);

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
                    if (existsSync(path.resolve(__dirname, `../schemas/${schemaFileName}`))) {
                        schemaPath = `../schemas/${schemaFileName}`;
                    } else if (existsSync(path.resolve(__dirname, `../../schemas/${schemaFileName}`))) {
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

                if (existsSync(path.resolve(__dirname, `../schemas/${schemaFileName}`))) {
                    schemaPath = `../schemas/${schemaFileName}`;
                } else if (existsSync(path.resolve(__dirname, `../../schemas/${schemaFileName}`))) {
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
        }

        if (!foundBaseProject) {
            continue;
        }

        const clonedBaseProject = JSON.parse(JSON.stringify(foundBaseProject)) as ProjectConfigInternal<TConfig>;
        if (clonedBaseProject.extends) {
            applyProjectConfigExtends(clonedBaseProject, projects);

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

export function getBuildOptionsFromBuilderOptions(options: BuildOptions & BuildOptionsCompat): BuildOptionInternal {
    const buildOptions: BuildOptionInternal = { environment: {} };

    if (options.environment) {
        const env = normalizeEnvironment(options.environment);
        buildOptions.environment = env;
        delete options.environment;
    }

    if (options.filter) {
        buildOptions.filter = options.filter;
        delete options.filter;
    }

    if (options.verbose != null) {
        if (options.verbose) {
            buildOptions.logLevel = 'debug';
        }
        delete options.verbose;
    }

    if (options.logLevel) {
        buildOptions.logLevel = options.logLevel;
        delete options.logLevel;
    }

    if (options.progress != null) {
        if (options.progress) {
            buildOptions.progress = true;
        }
        delete options.progress;
    }

    if (options.poll != null) {
        buildOptions.watchOptions = {
            poll: options.poll
        };
        delete options.poll;
    }

    if (options.cleanOutDir != null) {
        if (options.cleanOutDir) {
            buildOptions.cleanOutDir = true;
        }
        delete options.cleanOutDir;
    }

    if (options.watch != null) {
        if (options.watch) {
            buildOptions.watch = true;
        }
        delete options.watch;
    }

    if (options.watchOptions) {
        buildOptions.watchOptions = { ...options.watchOptions };
        delete options.watchOptions;
    }

    if (options.beep != null) {
        if (options.beep) {
            buildOptions.beep = true;
        }
        delete options.beep;
    }

    return buildOptions;
}

export function applyAppConfigCompat(appConfig: AppBuilderOptions): void {
    if (appConfig.target && !appConfig.platformTarget) {
        appConfig.platformTarget = appConfig.target as any;
        delete appConfig.target;
    }
    if (appConfig.platform && !appConfig.platformTarget) {
        appConfig.platformTarget = appConfig.platform === 'server' ? 'node' : 'web';
        delete appConfig.platform;
    }
    if (appConfig.outDir && !appConfig.outputPath) {
        appConfig.outputPath = appConfig.outDir;
        delete appConfig.outDir;
    }
    if (appConfig.main && !appConfig.entry) {
        appConfig.entry = appConfig.main;
        delete appConfig.main;
    }
    if (appConfig.index && !appConfig.htmlInject) {
        appConfig.htmlInject = {
            index: appConfig.index
        };
        delete appConfig.index;
    }
    if (appConfig.evalSourceMap && !appConfig.sourceMapDevTool) {
        appConfig.sourceMapDevTool = 'eval';
        delete appConfig.evalSourceMap;
    }
    if (appConfig.deployUrl && !appConfig.publicPath) {
        appConfig.publicPath = appConfig.deployUrl;
        delete appConfig.deployUrl;
    }
    if (appConfig.assets &&
        Array.isArray(appConfig.assets) &&
        (!appConfig.copy || (Array.isArray(appConfig.copy) && !appConfig.copy.length))) {
        appConfig.copy = appConfig.assets.map((assetEntry: string | AssetPatternObjectCompat) => {
            if (typeof assetEntry === 'string') {
                return assetEntry;
            }

            const assetPatternObject = assetEntry as AssetPatternObjectCompat;

            return {
                from: path.join(assetPatternObject.input, assetPatternObject.glob || ''),
                to: assetPatternObject.output,
                exclude: assetPatternObject.ignore
            };
        });
        delete appConfig.assets;
    }
    if (appConfig.deleteOutputPath && !appConfig.clean) {
        appConfig.clean = {
            beforeBuild: {
                cleanOutDir: true
            }
        };
        delete appConfig.deleteOutputPath;
    }
    if (appConfig.statsJson && !appConfig.bundleAnalyzer) {
        appConfig.bundleAnalyzer = {
            generateStatsFile: true
        };
        delete appConfig.statsJson;
    }
    if (appConfig.bundleDependencies && appConfig.bundleDependencies === 'none') {
        appConfig.nodeModulesAsExternals = true;
        const externals = [
            /^@angular/,
            (_: any, request: any, callback: (error?: any, result?: any) => void) => {
                // Absolute & Relative paths are not externals
                if (request.match(/^\.{0,2}\//)) {
                    callback();

                    return;
                }

                try {
                    // Attempt to resolve the module via Node
                    const e = require.resolve(request);
                    if (/node_modules/.test(e)) {
                        // It's a node_module
                        callback(null, request);
                    } else {
                        // It's a system thing (.ie util, fs...)
                        callback();
                    }
                } catch (e) {
                    // Node couldn't find it, so it must be user-aliased
                    callback();
                }
            }
        ];
        if (!appConfig.externals) {
            appConfig.externals = externals as any;
        } else {
            if (Array.isArray(appConfig.externals)) {
                appConfig.externals = [...(appConfig.externals as any[]), ...externals];
            } else {
                appConfig.externals = [appConfig.externals as any, ...externals];
            }
        }
        delete appConfig.bundleDependencies;
    }
}

export function applyLibConfigCompat(libConfig: LibBuilderOptions): void {
    if (libConfig.target && !libConfig.platformTarget) {
        libConfig.platformTarget = libConfig.target as any;
        delete libConfig.target;
    }

    if (libConfig.platform && !libConfig.platformTarget) {
        libConfig.platformTarget = libConfig.platform === 'server' ? 'node' : 'web';
        delete libConfig.platform;
    }

    if (libConfig.outDir && !libConfig.outputPath) {
        libConfig.outputPath = libConfig.outDir;
        delete libConfig.outDir;
    }

    if (libConfig.assets &&
        Array.isArray(libConfig.assets) &&
        (!libConfig.copy || (Array.isArray(libConfig.copy) && !libConfig.copy.length))) {
        libConfig.copy = libConfig.assets.map(assetEntry => {
            if (typeof assetEntry === 'string') {
                return assetEntry;
            }

            const assetPatternObject = assetEntry as AssetPatternObjectCompat;

            return {
                from: path.join(assetPatternObject.input, assetPatternObject.glob || ''),
                to: assetPatternObject.output,
                exclude: assetPatternObject.ignore
            };
        });
        delete libConfig.assets;
    }

    if (libConfig.deleteOutputPath && !libConfig.clean) {
        libConfig.clean = {
            beforeBuild: {
                cleanOutDir: true
            }
        };
        delete libConfig.deleteOutputPath;
    }

    if (libConfig.bundleDependencies && libConfig.bundleDependencies === 'all') {
        libConfig.nodeModulesAsExternals = false;
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
