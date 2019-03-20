import * as path from 'path';

import { pathExists, readFile, realpath } from 'fs-extra';

import { virtualFs } from '@angular-devkit/core';

import {
    AngularBuildConfigInternal,
    AppProjectConfigInternal,
    BuildContextInstanceOptions,
    BuildContextStaticOptions,
    BuildOptionsInternal,
    LibProjectConfigInternal
} from '../models/internals';

import { initAppConfig, initLibConfig, validateOutputPath } from '../helpers';
import { InternalError, InvalidConfigError } from '../models/errors';
import { findUp, isSamePaths, Logger, LoggerBase, readJson } from '../utils';

const versionPlaceholderRegex = new RegExp('0.0.0-PLACEHOLDER', 'i');

export class AngularBuildContext<TConfig extends AppProjectConfigInternal | LibProjectConfigInternal> {
    static get startTime(): number {
        return AngularBuildContext._startTime;
    }

    static get angularBuildConfig(): AngularBuildConfigInternal | null {
        if (!AngularBuildContext._instantiated) {
            throw new InternalError('AngularBuildContext has not been instantiated.');
        }

        return AngularBuildContext._angularBuildConfig;
    }

    static get logger(): LoggerBase {
        if (!AngularBuildContext._instantiated || AngularBuildContext._logger == null) {
            throw new InternalError('AngularBuildContext has not been instantiated.');
        }

        return AngularBuildContext._logger;
    }

    static get fromBuiltInCli(): boolean {
        if (!AngularBuildContext._instantiated) {
            throw new InternalError('AngularBuildContext has not been instantiated.');
        }

        if (AngularBuildContext._fromBuiltInCli) {
            return true;
        }

        return false;
    }

    static get cliRootPath(): string | null {
        if (!AngularBuildContext._instantiated) {
            throw new InternalError('AngularBuildContext has not been instantiated.');
        }

        return AngularBuildContext._cliRootPath;
    }

    static get workspaceRoot(): string {
        if (!AngularBuildContext._instantiated) {
            throw new InternalError('AngularBuildContext has not been instantiated.');
        }

        return AngularBuildContext._workspaceRoot;
    }

    static get cliIsGlobal(): boolean | null {
        if (!AngularBuildContext._instantiated) {
            throw new InternalError('AngularBuildContext has not been instantiated.');
        }

        return AngularBuildContext._cliIsGlobal;
    }

    static async cliIsLink(): Promise<boolean> {
        if (!AngularBuildContext._instantiated) {
            throw new InternalError('AngularBuildContext has not been instantiated.');
        }

        if (AngularBuildContext._cliIsLink != null) {
            return AngularBuildContext._cliIsLink;
        }

        const nodeModulesPath = await AngularBuildContext.getNodeModulesPath();

        if (!AngularBuildContext.cliIsGlobal && nodeModulesPath) {
            const p1 = path.resolve(nodeModulesPath, '@dagonmetric/angular-build');
            const isExists = await pathExists(p1);
            const rp = await realpath(p1);

            if (isExists && !isSamePaths(p1, rp)) {
                AngularBuildContext._cliIsLink = true;

                return AngularBuildContext._cliIsLink;
            }
        }

        AngularBuildContext._cliIsLink = false;

        return AngularBuildContext._cliIsLink;
    }

    static async getNodeModulesPath(): Promise<string | null> {
        if (!AngularBuildContext._instantiated) {
            throw new InternalError('AngularBuildContext has not been instantiated.');
        }

        if (AngularBuildContext._nodeModulesPath != null) {
            return AngularBuildContext._nodeModulesPath;
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

    static async getAngularBuildVersion(): Promise<string> {
        if (!AngularBuildContext._instantiated) {
            throw new InternalError('AngularBuildContext has not been instantiated.');
        }

        if (AngularBuildContext._angularBuildVersion) {
            return AngularBuildContext._angularBuildVersion;
        }

        let packageJsonPath = '';
        const nodeModulesPath = await AngularBuildContext.getNodeModulesPath();
        if (nodeModulesPath) {
            const tempPath =
                path.resolve(nodeModulesPath, '@dagonmetric/angular-build/package.json');
            const isExists = await pathExists(tempPath);
            if (isExists) {
                packageJsonPath = tempPath;
            }
        }

        if (!packageJsonPath &&
            AngularBuildContext.cliRootPath &&
            await pathExists(path.resolve(AngularBuildContext.cliRootPath, 'package.json'))) {
            packageJsonPath = path.resolve(AngularBuildContext.cliRootPath, 'package.json');
        }

        if (packageJsonPath) {
            const pkgJson = await readJson(packageJsonPath) as { version: string };
            AngularBuildContext._angularBuildVersion = pkgJson.version;

            return AngularBuildContext._angularBuildVersion;
        } else {
            throw new InternalError('Could not detect @dagonmetric/angular-build version.');
        }
    }

    static get libCount(): number {
        return AngularBuildContext._libCount;
    }

    static get appCount(): number {
        return AngularBuildContext._appCount;
    }

    // Instance public fields
    get buildOptions(): BuildOptionsInternal {
        if (!this._initialized) {
            throw new InternalError('Please call init() method first.');
        }

        return this._buildOptions;
    }

    get projectConfigWithoutEnvApplied(): TConfig {
        if (!this._initialized) {
            throw new InternalError('Please call init() method first.');
        }

        return this._projectConfigWithoutEnvApplied;
    }

    get projectConfig(): TConfig {
        if (!this._initialized) {
            throw new InternalError('Please call init() method first.');
        }

        return this._projectConfig;
    }

    get host(): virtualFs.Host | undefined {
        if (!this._initialized) {
            throw new InternalError('Please call init() method first.');
        }

        return this._host;
    }

    // Static private fields
    private static _instantiated = false;
    private static _appCount = 0;
    private static _libCount = 0;
    private static _startTime = Date.now();
    private static _workspaceRoot: string;
    private static _nodeModulesPath: string | null = null;
    private static _angularBuildVersion: string | null = null;
    private static _cliIsGlobal: boolean | null = null;
    private static _cliIsLink: boolean | null = null;
    private static _cliRootPath: string | null = null;
    private static _fromBuiltInCli: boolean | null;
    private static _logger: LoggerBase | null = null;
    private static _angularBuildConfig: AngularBuildConfigInternal | null = null;

    // Instance private fields
    private _initialized = false;
    private readonly _projectConfigWithoutEnvApplied: TConfig;
    private readonly _projectConfig: TConfig;
    private readonly _host?: virtualFs.Host;
    private readonly _buildOptions: BuildOptionsInternal;


    constructor(options: BuildContextStaticOptions & BuildContextInstanceOptions<TConfig>) {
        if (!options.workspaceRoot && !AngularBuildContext._workspaceRoot) {
            throw new InternalError("The 'options.workspaceRoot' is required.");
        }

        if (options.workspaceRoot && !AngularBuildContext._workspaceRoot) {
            AngularBuildContext._workspaceRoot = options.workspaceRoot;
        }

        if (options.startTime && !AngularBuildContext._startTime) {
            AngularBuildContext._startTime = options.startTime;
        }

        if (options.fromBuiltInCli != null && AngularBuildContext._fromBuiltInCli == null) {
            AngularBuildContext._fromBuiltInCli = options.fromBuiltInCli;
        }

        if (options.angularBuildConfig && !AngularBuildContext._angularBuildConfig) {
            AngularBuildContext._angularBuildConfig = options.angularBuildConfig;
        }

        if (options.cliRootPath && !AngularBuildContext._cliRootPath) {
            AngularBuildContext._cliRootPath = options.cliRootPath;
        }

        if (options.cliVersion && !AngularBuildContext._angularBuildVersion) {
            AngularBuildContext._angularBuildVersion = options.cliVersion;
        }

        if (options.cliIsGlobal != null && AngularBuildContext._cliIsGlobal == null) {
            AngularBuildContext._cliIsGlobal = options.fromBuiltInCli && options.cliIsGlobal ? true : false;
        }

        if (options.cliIsLink != null && AngularBuildContext._cliIsLink == null) {
            AngularBuildContext._cliIsLink = options.fromBuiltInCli && options.cliIsLink ? true : false;
        }

        AngularBuildContext._logger = new Logger({
            name: '',
            logLevel: options.buildOptions.logLevel || 'info',
            debugPrefix: 'DEBUG:',
            warnPrefix: 'WARNING:'
        });

        this._host = options.host;
        this._buildOptions = options.buildOptions;
        this._projectConfigWithoutEnvApplied = options.projectConfigWithoutEnvApplied;
        this._projectConfig = options.projectConfig;

        AngularBuildContext._instantiated = true;
    }

    async init(): Promise<void> {
        if (this.projectConfig.root && path.isAbsolute(this.projectConfig.root)) {
            throw new InvalidConfigError(
                `The 'projects[${this.projectConfig.name || this.projectConfig._index}].root' must be relative path.`);
        }

        this.projectConfig._workspaceRoot = AngularBuildContext.workspaceRoot;
        this.projectConfig._nodeModulesPath = await AngularBuildContext.getNodeModulesPath();
        this.projectConfig._projectRoot = path.resolve(AngularBuildContext.workspaceRoot, this.projectConfig.root || '');
        if (this.projectConfig.outputPath) {
            this.projectConfig._outputPath = path.resolve(AngularBuildContext.workspaceRoot, this.projectConfig.outputPath);
        }
        this.projectConfig._rptCacheDirectory = path.resolve(this.projectConfig._projectRoot, './.rpt-cache/');

        // Read package.json files
        await this.initPackageJsons();

        // Validation
        validateOutputPath(AngularBuildContext.workspaceRoot, this.projectConfig);

        // Init banner
        await this.initBannerText();

        if (this.projectConfig._projectType === 'lib') {
            AngularBuildContext._libCount = AngularBuildContext._libCount + 1;
            await initLibConfig(this.projectConfig as LibProjectConfigInternal);
        } else {
            AngularBuildContext._appCount = AngularBuildContext._appCount + 1;
            await initAppConfig(this.projectConfig as AppProjectConfigInternal, this.buildOptions);
        }

        this._initialized = true;
    }

    private async initPackageJsons(): Promise<void> {
        const projectRoot = path.resolve(AngularBuildContext.workspaceRoot, this.projectConfig.root || '');

        if (!this.projectConfig._packageConfigPath) {
            const foundPath = await findUp('package.json', projectRoot, AngularBuildContext.workspaceRoot);
            if (foundPath) {
                this.projectConfig._packageConfigPath = foundPath;
                if (foundPath === path.resolve(AngularBuildContext.workspaceRoot, 'package.json')) {
                    this.projectConfig._rootPackageConfigPath = foundPath;
                }
            }
        }

        if (!this.projectConfig._rootPackageConfigPath) {
            const rootPkgConfigPath = path.resolve(AngularBuildContext.workspaceRoot, 'package.json');
            if (await pathExists(rootPkgConfigPath)) {
                this.projectConfig._rootPackageConfigPath = rootPkgConfigPath;
            }
        }

        if (this.projectConfig._packageConfigPath) {
            // tslint:disable-next-line: no-unsafe-any
            this.projectConfig._packageJson = await readJson(this.projectConfig._packageConfigPath);
        } else if (this.projectConfig._projectType === 'lib') {
            throw new InvalidConfigError('Could not detect package.json file.');
        }

        if (this.projectConfig._rootPackageConfigPath) {
            if (this.projectConfig._rootPackageConfigPath === this.projectConfig._packageConfigPath &&
                this.projectConfig._packageJson) {
                this.projectConfig._rootPackageJson = this.projectConfig._packageJson;
            } else {
                // tslint:disable-next-line: no-unsafe-any
                this.projectConfig._rootPackageJson = await readJson(this.projectConfig._rootPackageConfigPath);
            }
        }

        if (this.projectConfig._packageJson && this.projectConfig._packageJson.name) {
            this.projectConfig._projectName = this.projectConfig._packageJson.name as string;
        }

        if (!this.projectConfig._packageJson ||
            !this.projectConfig._packageJson.version ||
            this.projectConfig._packageJson.version === '0.0.0' ||
            versionPlaceholderRegex.test(this.projectConfig._packageJson.version as string)) {
            if (this.projectConfig._rootPackageJson &&
                this.projectConfig._rootPackageJson.version) {
                this.projectConfig._projectVersion = this.projectConfig._rootPackageJson.version as string;
            }
        } else {
            this.projectConfig._projectVersion = this.projectConfig._packageJson.version as string;
        }

        if (this.projectConfig._packageJson && this.projectConfig._packageJson.author) {
            this.projectConfig._projectAuthor = this.projectConfig._packageJson.author as string;
        } else if (this.projectConfig._rootPackageJson && this.projectConfig._rootPackageJson.author) {
            this.projectConfig._projectAuthor = this.projectConfig._rootPackageJson.author as string;
        }

        if (this.projectConfig._packageJson && this.projectConfig._packageJson.homePage) {
            this.projectConfig._projectHomePage = this.projectConfig._packageJson.homePage as string;
        } else if (this.projectConfig._rootPackageJson && this.projectConfig._rootPackageJson.homePage) {
            this.projectConfig._projectHomePage = this.projectConfig._rootPackageJson.homePage as string;
        }

        if (this.projectConfig._projectName &&
            this.projectConfig._projectName.indexOf('/') > -1 &&
            this.projectConfig._projectName.startsWith('@')) {
            const nameParts = this.projectConfig._projectName.split('/');
            this.projectConfig._packageScope = nameParts[0];
        }

        if (this.projectConfig._projectName && this.projectConfig._packageScope) {
            const startIndex = this.projectConfig._projectName.indexOf('/') + 1;
            this.projectConfig._packageNameWithoutScope =
                this.projectConfig._projectName.substr(startIndex);
        } else {
            this.projectConfig._packageNameWithoutScope = this.projectConfig._projectName;
        }

        if (this.projectConfig._packageJson && this.projectConfig._packageJson.private) {
            this.projectConfig._isPackagePrivate = true;
        }
    }

    private replaceTokensForBanner(input: string): string {
        let str = input.replace(/[\$|\[]CURRENT[_\-]?YEAR[\$|\]]/gim, (new Date())
            .getFullYear()
            .toString());

        if (this.projectConfig._projectName) {
            const name = this.projectConfig._projectName;
            str = str
                .replace(/[\$|\[](APP|APPLICATION|PROJECT|PACKAGE)[_\-]?NAME[\$|\]]/gim,
                    name);
        }

        if (this.projectConfig._packageNameWithoutScope) {
            const name = this.projectConfig._packageNameWithoutScope;
            str = str.replace(/[\$|\[]PACKAGE[_\-]?NAME[_\-]?NAME[_\-]?NO[_\-]?SCOPE[\$|\]]/gim,
                name);
        }

        if (this.projectConfig._projectVersion) {
            str = str.replace(/[\$|\[](PACKAGE|APP|APPLICATION|PROJECT)?[_\-]?VERSION[\$|\]]/gim,
                this.projectConfig._projectVersion);
            str = str.replace(versionPlaceholderRegex, this.projectConfig._projectVersion);
        }

        if (this.projectConfig._packageScope) {
            str = str.replace(/[\$|\[]PACKAGE[_\-]?SCOPE[\$|\]]/gim, this.projectConfig._packageScope);
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

    private async initBannerText(): Promise<void> {
        if (!this.projectConfig.banner) {
            return;
        }

        const projectRoot = path.resolve(AngularBuildContext.workspaceRoot, this.projectConfig.root || '');
        let tempBannerText = this.projectConfig.banner;

        // read banner
        if (/\.txt$/i.test(tempBannerText)) {
            const bannerFilePath = await findUp(tempBannerText, projectRoot, AngularBuildContext.workspaceRoot);
            if (bannerFilePath) {
                tempBannerText = await readFile(bannerFilePath, 'utf-8');
            } else {
                throw new InvalidConfigError(
                    `The banner text file: ${path.resolve(projectRoot, tempBannerText)
                    } doesn't exist, please correct value in 'projects[${
                    this.projectConfig.name || this.projectConfig._index}].banner'.`);
            }
        }

        if (tempBannerText) {
            tempBannerText = this.addCommentToBanner(tempBannerText);
            tempBannerText = this.replaceTokensForBanner(tempBannerText);
            this.projectConfig._bannerText = tempBannerText;
        }
    }
}
