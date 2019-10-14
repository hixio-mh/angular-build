import * as path from 'path';

import { pathExists, readFile, realpath } from 'fs-extra';

import { JsonObject } from '../models';
import {
    AngularBuildConfigInternal,
    AppProjectConfigInternal,
    BuildContextInstanceOptions,
    BuildContextStaticOptions,
    BuildOptionsInternal,
    LibProjectConfigInternal
} from '../models/internals';

import {
    applyProjectConfigWithEnvironment,
    initAppConfig,
    initLibConfig,
    isFromBuiltInCli,
    validateOutputPath
} from '../helpers';
import { InternalError, InvalidConfigError } from '../models/errors';
import { findUp, isSamePaths, Logger, LoggerBase, readJson } from '../utils';

const versionPlaceholderRegex = new RegExp('0.0.0-PLACEHOLDER', 'i');

export class AngularBuildContext<TConfig extends AppProjectConfigInternal | LibProjectConfigInternal> {
    // static read/write members
    static get startTime(): number {
        if (!AngularBuildContext._optionsSet) {
            throw new InternalError("Please call 'AngularBuildContext.init()' static method first.");
        }

        return AngularBuildContext._startTime;
    }

    static get logger(): LoggerBase {
        if (!AngularBuildContext._optionsSet) {
            throw new InternalError("Please call 'AngularBuildContext.init()' static method first.");
        }

        if (AngularBuildContext._logger == null) {
            throw new InternalError('AngularBuildContext._logger is null.');
        }

        return AngularBuildContext._logger;
    }

    static get workspaceRoot(): string {
        if (!AngularBuildContext._optionsSet) {
            throw new InternalError("Please call 'AngularBuildContext.init()' static method first.");
        }

        return AngularBuildContext._workspaceRoot;
    }

    static get angularBuildConfig(): AngularBuildConfigInternal | null | undefined {
        if (!AngularBuildContext._optionsSet) {
            throw new InternalError("Please call 'AngularBuildContext.init()' static method first.");
        }

        return AngularBuildContext._angularBuildConfig;
    }

    static get fromBuiltInCli(): boolean {
        if (!AngularBuildContext._optionsSet) {
            throw new InternalError("Please call 'AngularBuildContext.init()' static method first.");
        }

        return AngularBuildContext._fromBuiltInCli;
    }

    static get cliIsGlobal(): boolean {
        if (!AngularBuildContext._optionsSet) {
            throw new InternalError("Please call 'AngularBuildContext.init()' static method first.");
        }

        return AngularBuildContext._cliIsGlobal;
    }

    // TODO: to review
    static get cliRootPath(): string | null | undefined {
        if (AngularBuildContext._cliRootPath != null) {
            return AngularBuildContext._cliRootPath;
        }

        if (!AngularBuildContext._optionsSet) {
            throw new InternalError("Please call 'AngularBuildContext.init()' static method first.");
        }

        return AngularBuildContext._cliRootPath;
    }

    static async getAngularBuildVersion(): Promise<string> {
        if (AngularBuildContext._angularBuildVersion != null) {
            return AngularBuildContext._angularBuildVersion;
        }

        const packageJsonPath = path.resolve(__dirname, '../../package.json');
        const packageJson = await readJson(packageJsonPath) as { version: string };

        return packageJson.version;
    }

    // TODO: to review
    static async checkAngularBuildIsLink(): Promise<boolean> {
        if (AngularBuildContext._angularBuildIsLink != null) {
            return AngularBuildContext._angularBuildIsLink;
        }

        if (!AngularBuildContext._optionsSet) {
            throw new InternalError("Please call 'AngularBuildContext.init()' static method first.");
        }

        if (AngularBuildContext.cliIsGlobal) {
            AngularBuildContext._angularBuildIsLink = false;

            return AngularBuildContext._angularBuildIsLink;
        }

        const packageJsonPath = path.resolve(__dirname, '../../package.json');

        // const p1 = path.resolve(nodeModulesPath, '@dagonmetric/angular-build');
        const isExists = await pathExists(packageJsonPath);
        const rp = await realpath(packageJsonPath);

        if (isExists && !isSamePaths(packageJsonPath, rp)) {
            AngularBuildContext._angularBuildIsLink = true;
        } else {
            AngularBuildContext._angularBuildIsLink = false;
        }

        return AngularBuildContext._angularBuildIsLink;
    }

    static async getAngularBuildConfigSchema(): Promise<JsonObject> {
        if (AngularBuildContext._angularBuildConfigSchema) {
            return AngularBuildContext._angularBuildConfigSchema;
        }

        const schemaRootPath = path.resolve(__dirname, '../schemas');

        const schema = (await readJson(path.resolve(schemaRootPath, 'schema.json'))) as JsonObject;

        if (schema.$schema) {
            delete schema.$schema;
        }

        AngularBuildContext._angularBuildConfigSchema = schema;

        return AngularBuildContext._angularBuildConfigSchema;
    }

    static async getAppProjectConfigSchema(): Promise<JsonObject> {
        if (AngularBuildContext._appProjectConfigSchema) {
            return AngularBuildContext._appProjectConfigSchema;
        }

        const schemaRootPath = path.resolve(__dirname, '../schemas');

        const schema = (await readJson(path.resolve(schemaRootPath, 'app-project-config-schema.json'))) as JsonObject;

        if (schema.$schema) {
            delete schema.$schema;
        }

        AngularBuildContext._appProjectConfigSchema = schema;

        return AngularBuildContext._appProjectConfigSchema;
    }

    static async getLibProjectConfigSchema(): Promise<JsonObject> {
        if (AngularBuildContext._libProjectConfigSchema) {
            return AngularBuildContext._libProjectConfigSchema;
        }

        const schemaRootPath = path.resolve(__dirname, '../schemas');

        const schema = (await readJson(path.resolve(schemaRootPath, 'lib-project-config-schema.json'))) as JsonObject;

        if (schema.$schema) {
            delete schema.$schema;
        }

        AngularBuildContext._libProjectConfigSchema = schema;

        return AngularBuildContext._libProjectConfigSchema;
    }

    static init(options: BuildContextStaticOptions): void {
        if (AngularBuildContext._optionsSet) {
            return;
        }

        if (options.logger) {
            AngularBuildContext._logger = options.logger;
        } else {
            AngularBuildContext._logger = new Logger({
                logLevel: 'info',
                debugPrefix: 'DEBUG:',
                warnPrefix: 'WARNING:'
            });
        }


        AngularBuildContext._startTime = options.startTime;
        AngularBuildContext._workspaceRoot = options.workspaceRoot;
        AngularBuildContext._angularBuildConfig = options.angularBuildConfig;

        AngularBuildContext._fromBuiltInCli = options.fromBuiltInCli != null ? options.fromBuiltInCli : isFromBuiltInCli();
        if (options.cliIsGlobal != null) {
            AngularBuildContext._cliIsGlobal = AngularBuildContext._fromBuiltInCli && options.cliIsGlobal ? true : false;
        }
        if (options.angularBuildVersion) {
            AngularBuildContext._angularBuildVersion = options.angularBuildVersion;
        }
        if (options.cliRootPath) {
            AngularBuildContext._cliRootPath = options.cliRootPath;
        }
        if (options.cliIsLink != null) {
            AngularBuildContext._angularBuildIsLink = options.cliIsLink;
        }

        AngularBuildContext._optionsSet = true;
    }

    // static readonly members
    static async getNodeModulesPath(): Promise<string | null> {
        if (AngularBuildContext._nodeModulesPath != null) {
            return AngularBuildContext._nodeModulesPath;
        }

        if (AngularBuildContext.workspaceRoot == null) {
            throw new InternalError("Please call 'AngularBuildContext.init()' static method first.");
        }

        const foundNodeModulesPath = await findUp('node_modules',
            AngularBuildContext.workspaceRoot,
            path.parse(AngularBuildContext.workspaceRoot).root);

        if (foundNodeModulesPath) {
            AngularBuildContext._nodeModulesPath = foundNodeModulesPath;
        } else {
            AngularBuildContext._nodeModulesPath = '';
        }

        return AngularBuildContext._nodeModulesPath;
    }

    static get libCount(): number {
        return AngularBuildContext._libCount;
    }

    static get appCount(): number {
        return AngularBuildContext._appCount;
    }

    // Instance public fields
    get buildOptions(): BuildOptionsInternal {
        return this._buildOptions;
    }

    // tslint:disable-next-line: no-any no-unsafe-any
    get host(): any {
        return this._host;
    }

    get projectConfigRaw(): TConfig {
        return this._projectConfigRaw;
    }

    get projectConfig(): TConfig {
        if (!this._initialized || !this._projectConfig) {
            throw new InternalError('Please call init() method first.');
        }

        return this._projectConfig;
    }

    // Static private fields
    private static _logger: LoggerBase | null = null;
    private static _startTime = Date.now();
    private static _appCount = 0;
    private static _libCount = 0;
    private static _workspaceRoot: string;
    private static _fromBuiltInCli: boolean;
    private static _cliIsGlobal: boolean;
    private static _angularBuildConfig: AngularBuildConfigInternal | null | undefined = null;
    private static _optionsSet = false;

    private static _angularBuildVersion: string;
    private static _angularBuildIsLink: boolean;
    private static _cliRootPath: string | null = null;

    private static _nodeModulesPath: string | null = null;

    private static _angularBuildConfigSchema: JsonObject | null = null;
    private static _appProjectConfigSchema: JsonObject | null = null;
    private static _libProjectConfigSchema: JsonObject | null = null;

    // Instance private fields
    private readonly _projectConfigRaw: TConfig;
    // tslint:disable-next-line: no-any
    private readonly _host?: any;
    private readonly _buildOptions: BuildOptionsInternal;
    private _initialized = false;
    private _projectConfig: TConfig | undefined;

    constructor(options: BuildContextInstanceOptions<TConfig>) {
        this._host = options.host;
        this._buildOptions = options.buildOptions;
        this._projectConfigRaw = options.projectConfigRaw;
    }

    async init(): Promise<void> {
        // clone
        const projectConfig = JSON.parse(JSON.stringify(this.projectConfigRaw)) as TConfig;

        // apply env
        applyProjectConfigWithEnvironment(projectConfig, this.buildOptions.environment);


        if (projectConfig.root && path.isAbsolute(projectConfig.root)) {
            throw new InvalidConfigError(
                `The 'projects[${projectConfig.name || projectConfig._index}].root' must be relative path.`);
        }

        projectConfig._workspaceRoot = AngularBuildContext.workspaceRoot;
        projectConfig._nodeModulesPath = await AngularBuildContext.getNodeModulesPath();
        projectConfig._projectRoot = path.resolve(AngularBuildContext.workspaceRoot, projectConfig.root || '');
        if (projectConfig.outputPath) {
            projectConfig._outputPath = path.resolve(AngularBuildContext.workspaceRoot, projectConfig.outputPath);
        }

        // Read package.json files
        await this.initPackageJsons(projectConfig);

        // Validation
        validateOutputPath(AngularBuildContext.workspaceRoot, projectConfig);

        // Init banner
        await this.initBannerText(projectConfig);

        if (projectConfig._projectType === 'lib') {
            AngularBuildContext._libCount = AngularBuildContext._libCount + 1;
            await initLibConfig(projectConfig as LibProjectConfigInternal);
        } else {
            AngularBuildContext._appCount = AngularBuildContext._appCount + 1;
            await initAppConfig(projectConfig as AppProjectConfigInternal, this._buildOptions);
        }

        this._projectConfig = projectConfig;

        this._initialized = true;
    }

    private async initPackageJsons(projectConfig: TConfig): Promise<void> {
        const projectRoot = path.resolve(AngularBuildContext.workspaceRoot, projectConfig.root || '');

        if (!projectConfig._packageConfigPath) {
            const foundPath = await findUp('package.json', projectRoot, AngularBuildContext.workspaceRoot);
            if (foundPath) {
                projectConfig._packageConfigPath = foundPath;
                if (foundPath === path.resolve(AngularBuildContext.workspaceRoot, 'package.json')) {
                    projectConfig._rootPackageConfigPath = foundPath;
                }
            }
        }

        if (!projectConfig._rootPackageConfigPath) {
            const rootPkgConfigPath = path.resolve(AngularBuildContext.workspaceRoot, 'package.json');
            if (await pathExists(rootPkgConfigPath)) {
                projectConfig._rootPackageConfigPath = rootPkgConfigPath;
            }
        }

        if (projectConfig._packageConfigPath) {
            // tslint:disable-next-line: no-unsafe-any
            projectConfig._packageJson = await readJson(projectConfig._packageConfigPath);
        } else if (projectConfig._projectType === 'lib') {
            throw new InvalidConfigError('Could not detect package.json file.');
        }

        if (projectConfig._rootPackageConfigPath) {
            if (projectConfig._rootPackageConfigPath === projectConfig._packageConfigPath &&
                projectConfig._packageJson) {
                projectConfig._rootPackageJson = projectConfig._packageJson;
            } else {
                // tslint:disable-next-line: no-unsafe-any
                projectConfig._rootPackageJson = await readJson(projectConfig._rootPackageConfigPath);
            }
        }

        if (projectConfig._packageJson && projectConfig._packageJson.name) {
            projectConfig._projectName = projectConfig._packageJson.name as string;
        }

        if (this.buildOptions.version) {
            projectConfig._projectVersion = this.buildOptions.version;
        } else {
            if (!projectConfig._packageJson ||
                !projectConfig._packageJson.version ||
                projectConfig._packageJson.version === '0.0.0' ||
                versionPlaceholderRegex.test(projectConfig._packageJson.version as string)) {
                if (projectConfig._rootPackageJson &&
                    projectConfig._rootPackageJson.version) {
                    projectConfig._projectVersion = projectConfig._rootPackageJson.version as string;
                }
            } else {
                projectConfig._projectVersion = projectConfig._packageJson.version as string;
            }
        }
        if (projectConfig._packageJson && projectConfig._packageJson.author) {
            projectConfig._projectAuthor = projectConfig._packageJson.author as string;
        } else if (projectConfig._rootPackageJson && projectConfig._rootPackageJson.author) {
            projectConfig._projectAuthor = projectConfig._rootPackageJson.author as string;
        }

        if (projectConfig._packageJson && projectConfig._packageJson.homePage) {
            projectConfig._projectHomePage = projectConfig._packageJson.homePage as string;
        } else if (projectConfig._rootPackageJson && projectConfig._rootPackageJson.homePage) {
            projectConfig._projectHomePage = projectConfig._rootPackageJson.homePage as string;
        }

        if (projectConfig._projectName &&
            projectConfig._projectName.indexOf('/') > -1 &&
            projectConfig._projectName.startsWith('@')) {
            const nameParts = projectConfig._projectName.split('/');
            projectConfig._packageScope = nameParts[0];
        }

        if (projectConfig._projectName && projectConfig._packageScope) {
            const startIndex = projectConfig._projectName.indexOf('/') + 1;
            projectConfig._packageNameWithoutScope =
                projectConfig._projectName.substr(startIndex);
        } else {
            projectConfig._packageNameWithoutScope = projectConfig._projectName;
        }

        if (projectConfig._packageJson && projectConfig._packageJson.private) {
            projectConfig._isPackagePrivate = true;
        }
    }

    private replaceTokensForBanner(projectConfig: TConfig, input: string): string {
        let str = input.replace(/[\$|\[]CURRENT[_\-]?YEAR[\$|\]]/gim, (new Date())
            .getFullYear()
            .toString());

        if (projectConfig._projectName) {
            const name = projectConfig._projectName;
            str = str
                .replace(/[\$|\[](APP|APPLICATION|PROJECT|PACKAGE)[_\-]?NAME[\$|\]]/gim,
                    name);
        }

        if (projectConfig._packageNameWithoutScope) {
            const name = projectConfig._packageNameWithoutScope;
            str = str.replace(/[\$|\[]PACKAGE[_\-]?NAME[_\-]?NAME[_\-]?NO[_\-]?SCOPE[\$|\]]/gim,
                name);
        }

        if (projectConfig._projectVersion) {
            str = str.replace(/[\$|\[](PACKAGE|APP|APPLICATION|PROJECT)?[_\-]?VERSION[\$|\]]/gim,
                projectConfig._projectVersion);
            str = str.replace(versionPlaceholderRegex, projectConfig._projectVersion);
        }

        if (projectConfig._packageScope) {
            str = str.replace(/[\$|\[]PACKAGE[_\-]?SCOPE[\$|\]]/gim, projectConfig._packageScope);
        }

        return str;
    }

    private addCommentToBanner(banner: string): string {
        // tslint:disable-next-line: newline-per-chained-call
        if (!banner || banner.trim().startsWith('/')) {
            return banner;
        }

        const commentLines: string[] = [];
        const bannerLines = banner.split('\n');
        for (let i = 0; i < bannerLines.length; i++) {
            if (bannerLines[i] === '' || bannerLines[i] === '\r') {
                continue;
            }

            const bannerText = bannerLines[i].trim();
            if (i === 0) {
                commentLines.push('/**');
            }
            commentLines.push(` * ${bannerText}`);
        }
        commentLines.push(' */');
        banner = commentLines.join('\n');

        return banner;
    }

    private async initBannerText(projectConfig: TConfig): Promise<void> {
        if (!projectConfig.banner) {
            return;
        }

        const projectRoot = path.resolve(AngularBuildContext.workspaceRoot, projectConfig.root || '');
        let tempBannerText = projectConfig.banner;

        // read banner
        if (/\.txt$/i.test(tempBannerText)) {
            const bannerFilePath = await findUp(tempBannerText, projectRoot, AngularBuildContext.workspaceRoot);
            if (bannerFilePath) {
                tempBannerText = await readFile(bannerFilePath, 'utf-8');
            } else {
                throw new InvalidConfigError(
                    `The banner text file: ${path.resolve(projectRoot, tempBannerText)
                    } doesn't exist, please correct value in 'projects[${
                    projectConfig.name || projectConfig._index}].banner'.`);
            }
        }

        if (tempBannerText) {
            tempBannerText = this.addCommentToBanner(tempBannerText);
            tempBannerText = this.replaceTokensForBanner(projectConfig, tempBannerText);
            projectConfig._bannerText = tempBannerText;
        }
    }
}
