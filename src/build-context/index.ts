// tslint:disable:no-any
// tslint:disable:no-unsafe-any

import { existsSync, readFileSync, realpathSync } from 'fs';
import * as path from 'path';

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
import { findUpSync, isSamePaths, Logger, LoggerBase, readJsonSync } from '../utils';

const versionPlaceholderRegex = new RegExp('0.0.0-PLACEHOLDER', 'i');

export class AngularBuildContext<TConfig extends AppProjectConfigInternal | LibProjectConfigInternal> {
    static get startTime(): number {
        return AngularBuildContext._startTime;
    }

    static get angularBuildConfig(): AngularBuildConfigInternal | null {
        if (!AngularBuildContext._initialized) {
            throw new InternalError('AngularBuildContext has not been initialized.');
        }

        return AngularBuildContext._angularBuildConfig;
    }

    static get logger(): LoggerBase {
        if (!AngularBuildContext._initialized || AngularBuildContext._logger == null) {
            throw new InternalError('AngularBuildContext has not been initialized.');
        }

        return AngularBuildContext._logger;
    }

    static get fromBuiltInCli(): boolean {
        if (!AngularBuildContext._initialized) {
            throw new InternalError('AngularBuildContext has not been initialized.');
        }

        if (AngularBuildContext._fromBuiltInCli) {
            return true;
        }

        return false;
    }

    static get cliRootPath(): string | null {
        if (!AngularBuildContext._initialized) {
            throw new InternalError('AngularBuildContext has not been initialized.');
        }

        return AngularBuildContext._cliRootPath;
    }

    static get cliIsGlobal(): boolean | null {
        if (!AngularBuildContext._initialized) {
            throw new InternalError('AngularBuildContext has not been initialized.');
        }

        return AngularBuildContext._cliIsGlobal;
    }

    static get angularBuildIsLink(): boolean {
        if (!AngularBuildContext._initialized) {
            throw new InternalError('AngularBuildContext has not been initialized.');
        }

        if (AngularBuildContext._cliIsLink != null) {
            return AngularBuildContext._cliIsLink;
        }

        if (!AngularBuildContext.cliIsGlobal && AngularBuildContext.nodeModulesPath) {
            const p1 = path.resolve(AngularBuildContext.nodeModulesPath, '@bizappframework/angular-build');
            if (existsSync(p1) && !isSamePaths(p1, realpathSync(p1))) {
                AngularBuildContext._cliIsLink = true;

                return AngularBuildContext._cliIsLink;
            }
        }

        AngularBuildContext._cliIsLink = false;

        return AngularBuildContext._cliIsLink;
    }

    static get workspaceRoot(): string {
        if (!AngularBuildContext._initialized) {
            throw new InternalError('AngularBuildContext has not been initialized.');
        }

        return AngularBuildContext._workspaceRoot;
    }

    static get nodeModulesPath(): string | null {
        if (!AngularBuildContext._initialized) {
            throw new InternalError('AngularBuildContext has not been initialized.');
        }

        if (AngularBuildContext._nodeModulesPath != null) {
            return AngularBuildContext._nodeModulesPath;
        }

        const foundNodeModulesPath = findUpSync('node_modules',
            AngularBuildContext.workspaceRoot,
            path.parse(AngularBuildContext.workspaceRoot).root);

        if (foundNodeModulesPath) {
            AngularBuildContext._nodeModulesPath = foundNodeModulesPath;
        } else {
            AngularBuildContext._nodeModulesPath = '';
        }

        return AngularBuildContext._nodeModulesPath;
    }

    static get angularBuildVersion(): string {
        if (!AngularBuildContext._initialized) {
            throw new InternalError('AngularBuildContext has not been initialized.');
        }

        if (AngularBuildContext._angularBuildVersion) {
            return AngularBuildContext._angularBuildVersion;
        }

        let packageJsonPath = '';
        if (AngularBuildContext.nodeModulesPath) {
            const tempPath =
                path.resolve(AngularBuildContext.nodeModulesPath, '@bizappframework/angular-build/package.json');
            if (existsSync(tempPath)) {
                packageJsonPath = tempPath;
            }
        }

        if (!packageJsonPath &&
            AngularBuildContext.cliRootPath &&
            existsSync(path.resolve(AngularBuildContext.cliRootPath, 'package.json'))) {
            packageJsonPath = path.resolve(AngularBuildContext.cliRootPath, 'package.json');
        }

        if (packageJsonPath) {
            const pkgJson = readJsonSync(packageJsonPath);
            AngularBuildContext._angularBuildVersion = pkgJson.version as string;

            return AngularBuildContext._angularBuildVersion;
        } else {
            throw new InternalError('Could not detect angular-build version.');
        }
    }

    static get libCount(): number {
        return AngularBuildContext._libCount;
    }

    static get appCount(): number {
        return AngularBuildContext._appCount;
    }

    // Instance public fields
    readonly projectConfigWithoutEnvApplied: TConfig;
    readonly projectConfig: TConfig;
    readonly host: virtualFs.Host;

    get buildOptions(): BuildOptionsInternal {
        return this._buildOptions;
    }

    // Static private fields
    private static _initialized = false;
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

        AngularBuildContext._initialized = true;

        this.host = options.host;
        this._buildOptions = options.buildOptions;
        this.projectConfigWithoutEnvApplied = options.projectConfigWithoutEnvApplied;
        this.projectConfig = options.projectConfig;

        this.initProjectConfig();
    }

    private initProjectConfig(): void {
        if (this.projectConfig.root && path.isAbsolute(this.projectConfig.root)) {
            throw new InvalidConfigError(
                `The 'projects[${this.projectConfig.name || this.projectConfig._index}].root' must be relative path.`);
        }

        this.projectConfig._workspaceRoot = AngularBuildContext.workspaceRoot;
        this.projectConfig._nodeModulesPath = AngularBuildContext.nodeModulesPath;
        this.projectConfig._projectRoot = path.resolve(AngularBuildContext.workspaceRoot, this.projectConfig.root || '');
        if (this.projectConfig.outputPath) {
            this.projectConfig._outputPath = path.resolve(AngularBuildContext.workspaceRoot, this.projectConfig.outputPath);
        }
        this.projectConfig._rptCacheDirectory = path.resolve(this.projectConfig._projectRoot, './.rpt-cache/');

        // Read package.json files
        this.initPackageJsons();

        // Validation
        validateOutputPath(AngularBuildContext.workspaceRoot, this.projectConfig);

        // Init banner
        this.initBannerText();

        if (this.projectConfig._projectType === 'lib') {
            AngularBuildContext._libCount = AngularBuildContext._libCount + 1;
            initLibConfig(this.projectConfig as LibProjectConfigInternal);
        } else {
            AngularBuildContext._appCount = AngularBuildContext._appCount + 1;
            initAppConfig(this.projectConfig as AppProjectConfigInternal, this.buildOptions);
        }

    }

    private initPackageJsons(): void {
        const projectRoot = path.resolve(AngularBuildContext.workspaceRoot, this.projectConfig.root || '');

        if (!this.projectConfig._packageConfigPath) {
            const foundPath = findUpSync('package.json', projectRoot, AngularBuildContext.workspaceRoot);
            if (foundPath) {
                this.projectConfig._packageConfigPath = foundPath;
                if (foundPath === path.resolve(AngularBuildContext.workspaceRoot, 'package.json')) {
                    this.projectConfig._rootPackageConfigPath = foundPath;
                }
            }
        }

        if (!this.projectConfig._rootPackageConfigPath) {
            const rootPkgConfigPath = path.resolve(AngularBuildContext.workspaceRoot, 'package.json');
            if (existsSync(rootPkgConfigPath)) {
                this.projectConfig._rootPackageConfigPath = rootPkgConfigPath;
            }
        }

        if (this.projectConfig._packageConfigPath) {
            this.projectConfig._packageJson = readJsonSync(this.projectConfig._packageConfigPath);
        } else if (this.projectConfig._projectType === 'lib') {
            throw new InvalidConfigError('Could not detect package.json file.');
        }

        if (this.projectConfig._rootPackageConfigPath) {
            if (this.projectConfig._rootPackageConfigPath === this.projectConfig._packageConfigPath &&
                this.projectConfig._packageJson) {
                this.projectConfig._rootPackageJson = this.projectConfig._packageJson;
            } else {
                this.projectConfig._rootPackageJson = readJsonSync(this.projectConfig._rootPackageConfigPath);
            }
        }

        if (this.projectConfig._packageJson) {
            this.projectConfig._projectName = this.projectConfig._packageJson.name;
        }

        if (!this.projectConfig._packageJson ||
            (!this.projectConfig._packageJson.version ||
                this.projectConfig._packageJson.version === '0.0.0' ||
                versionPlaceholderRegex.test(this.projectConfig._packageJson.version))) {
            if (this.projectConfig._rootPackageJson &&
                this.projectConfig._rootPackageJson.version) {
                this.projectConfig._projectVersion = this.projectConfig._rootPackageJson.version;
            }
        } else {
            this.projectConfig._projectVersion = this.projectConfig._packageJson.version;
        }

        if (this.projectConfig._packageJson && this.projectConfig._packageJson.author) {
            this.projectConfig._projectAuthor = this.projectConfig._packageJson.author;
        } else if (this.projectConfig._rootPackageJson && this.projectConfig._rootPackageJson.author) {
            this.projectConfig._projectAuthor = this.projectConfig._rootPackageJson.author;
        }

        if (this.projectConfig._packageJson && this.projectConfig._packageJson.homePage) {
            this.projectConfig._projectHomePage = this.projectConfig._packageJson.homePage;
        } else if (this.projectConfig._rootPackageJson && this.projectConfig._rootPackageJson.homePage) {
            this.projectConfig._projectHomePage = this.projectConfig._rootPackageJson.homePage;
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
        let str = input.replace(/[\$|\[]CURRENT[_\-]?YEAR[\$|\]]/gim, (new Date()).getFullYear().toString());

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

    private initBannerText(): void {
        if (!this.projectConfig.banner) {
            return;
        }

        const projectRoot = path.resolve(AngularBuildContext.workspaceRoot, this.projectConfig.root || '');
        let tempBannerText = this.projectConfig.banner;

        // read banner
        if (/\.txt$/i.test(tempBannerText)) {
            const bannerFilePath = findUpSync(tempBannerText, projectRoot, AngularBuildContext.workspaceRoot);
            if (bannerFilePath) {
                tempBannerText = readFileSync(bannerFilePath, 'utf-8');
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
