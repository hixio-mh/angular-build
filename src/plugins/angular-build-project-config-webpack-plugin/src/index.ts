import * as path from 'path';
import * as webpack from 'webpack';

import {
    AngularBuildConfigInternal,
    InvalidConfigError,
    InternalError,
    ProjectConfigInternal
} from '../../../models';
import {
    applyAngularBuildConfigDefaults,
    applyProjectConfigDefaults,
    applyProjectConfigWithEnvOverrides
} from '../../../helpers';
import {
    formatValidationError,
    generateHashDigest,
    Logger, LoggerOptions,
    stripComments,
    validateSchema
} from '../../../utils';

export type AngularBuildProjectConfigWebpackPluginOptions = {
    configPath: string;
    environment: { [key: string]: boolean | string; };

    initialProjectConfig?: ProjectConfigInternal;
    configName?: string;
    projectType?: string;

    validateSchema?: boolean;
    schema?: any;

    loggerOptions?: LoggerOptions;
};

export const ANGULAR_BUILD_PROJECT_CONFIG_KEY = 'angular_build_project_config';

export class AngularBuildProjectConfigWebpackPlugin {
    private readonly logger: Logger;
    private projectConfig: ProjectConfigInternal | null = null;
    private lastContentHash?: string;
    private lastTimeStamp?: number;

    get name(): string {
        return 'AngularBuildProjectConfigWebpackPlugin';
    }

    constructor(private readonly options: AngularBuildProjectConfigWebpackPluginOptions) {
        if (!options) {
            throw new InternalError(`[${this.name}] The 'options' can't be null or empty.`);
        }

        if (!options.configPath) {
            throw new InternalError(`[${this.name}] The 'configPath' option is required.`);
        }

        const loggerOptions =
            Object.assign({ name: `[${this.name}]` }, this.options.loggerOptions || {}) as LoggerOptions;
        this.logger = new Logger(loggerOptions);

        if (this.options.initialProjectConfig) {
            this.projectConfig = this.options.initialProjectConfig;
        }
    }

    apply(compiler: webpack.Compiler): void {
        const projectRoot = path.dirname(this.options.configPath);
        const context = compiler.options.context;
        if (this.projectConfig) {
            (compiler as any).options[ANGULAR_BUILD_PROJECT_CONFIG_KEY] = this.projectConfig;
        }

        compiler.plugin('before-compile',
            (params: any, cb: (err?: Error) => void) => {
                const startTime = Date.now();
                const configFilePath = this.options.configPath;

                // first compilation
                if (this.projectConfig &&
                    (compiler as any).options[ANGULAR_BUILD_PROJECT_CONFIG_KEY] &&
                    !this.lastContentHash) {
                    params.compilationDependencies.push(configFilePath);
                    if (!this.lastTimeStamp) {
                        this.logger.debug(
                            `The project config has been initialized`);
                    }

                    this.lastTimeStamp = Date.now();
                    return cb();
                }

                if (this.lastTimeStamp &&
                    this.lastTimeStamp > 0 &&
                    Date.now() - this.lastTimeStamp < 500 &&
                    this.projectConfig) {
                    params.compilationDependencies.push(configFilePath);
                    (compiler as any).options[ANGULAR_BUILD_PROJECT_CONFIG_KEY] = this.projectConfig;
                    this.lastTimeStamp = Date.now();
                    return cb();
                }

                this.logger.debug(`Adding ${path.relative(context || '', configFilePath)} to compilation dependencies`);
                params.compilationDependencies.push(configFilePath);

                this.logger.debug(`Reading ${path.relative(context || '', configFilePath)} file`);
                (compiler as any).inputFileSystem.readFile(configFilePath,
                    (err: Error, result: any) => {
                        if (err) {
                            this.lastTimeStamp = 0;
                            this.projectConfig = null;

                            return cb(err);
                        }

                        const content = result.toString('utf8');
                        const contentHash = generateHashDigest(content);

                        if (this.lastContentHash && contentHash === this.lastContentHash && this.projectConfig) {
                            this.logger.debug(`No configuration changed`);
                            (compiler as any).options[ANGULAR_BUILD_PROJECT_CONFIG_KEY] = this.projectConfig;
                            this.lastTimeStamp = Date.now();
                            return cb();
                        }

                        this.lastContentHash = contentHash;

                        const data = stripComments(content.replace(/^\uFEFF/, ''));
                        const angularBuildConfig = JSON.parse(data) as AngularBuildConfigInternal;

                        // validation
                        if (this.options.validateSchema && this.options.schema) {
                            if ((angularBuildConfig as any).$schema) {
                                delete (angularBuildConfig as any).$schema;
                            }
                            if (angularBuildConfig._schema) {
                                delete angularBuildConfig._schema;
                            }
                            if (angularBuildConfig._schemaValidated) {
                                delete angularBuildConfig._schemaValidated;
                            }

                            const errors = validateSchema(this.options.schema, angularBuildConfig);
                            if (errors.length) {
                                this.lastTimeStamp = 0;
                                this.projectConfig = null;

                                const errMsg = errors.map(e => formatValidationError(this.options.schema, e)).join('\n');
                                return cb(new InvalidConfigError(
                                    `[${this.name}] Invalid configuration.\n\n${
                                    errMsg}\n`));
                            }
                        }

                        applyAngularBuildConfigDefaults(angularBuildConfig);

                        const nameToFind = this.options.configName || compiler.options.name;
                        let foundProjectType = '';
                        let foundIndex = -1;
                        let foundConfig: ProjectConfigInternal | null = null;
                        const projectKeys = Object.keys(angularBuildConfig)
                            .filter(key => key === 'apps' || key === 'libs');

                        for (let key of projectKeys) {
                            if (this.options.projectType === 'app' && key !== 'apps') {
                                continue;
                            }
                            if (this.options.projectType === 'lib' && key !== 'libs') {
                                continue;
                            }

                            for (let i = 0; i < (angularBuildConfig as any)[key].length; i++) {
                                const config = (angularBuildConfig as any)[key][i];
                                if (nameToFind) {
                                    if (config.name === nameToFind) {
                                        foundConfig = config;
                                        foundProjectType = key;
                                        foundIndex = i;
                                        break;
                                    }
                                } else {
                                    foundConfig = config;
                                    foundProjectType = key;
                                    foundIndex = i;
                                    break;
                                }
                            }

                            if (foundConfig) {
                                break;
                            }
                        }

                        if (!foundConfig) {
                            this.lastTimeStamp = 0;
                            this.projectConfig = null;

                            return cb(new InternalError(
                                `[${this.name}] Mapping project config could not be found with name: ${nameToFind}, project type: ${
                                this
                                    .options.projectType}`));
                        }

                        applyProjectConfigWithEnvOverrides(foundConfig, this.options.environment);
                        applyProjectConfigDefaults(projectRoot, foundConfig, this.options.environment);

                        if (this.projectConfig) {
                            if (this.projectConfig.name !== foundConfig.name) {
                                return cb(new InternalError(
                                    `[${this.name}] The ${foundProjectType}s[${foundConfig._index
                                    }].name has been changed. Please restart your build.`));
                            }
                            if (this.projectConfig.srcDir !== foundConfig.srcDir) {
                                return cb(new InternalError(
                                    `[${this.name}] The ${foundProjectType}s[${foundConfig._index
                                    }].srcDir has been changed. Please restart your build.`));
                            }
                        }

                        this.logger.debug(`Found mapped project config at ${foundProjectType}[${foundIndex}]`);
                        this.projectConfig = foundConfig;
                        (compiler as any).options[ANGULAR_BUILD_PROJECT_CONFIG_KEY] = this.projectConfig;

                        this.logger.debug(
                            `The project config has been initialized in [${Date.now() -
                            startTime}ms]`);

                        this.lastTimeStamp = Date.now();
                        return cb();
                    });
            });
    }
}
