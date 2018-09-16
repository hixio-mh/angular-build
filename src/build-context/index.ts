// tslint:disable:no-any
// tslint:disable:no-unsafe-any

import { existsSync, readFileSync } from 'fs';
import * as path from 'path';

import { virtualFs } from '@angular-devkit/core';

import {
    AngularBuildConfigInternal,
    AppProjectConfigInternal,
    BuildContextInstanceOptions,
    BuildContextStaticOptions,
    BuildOptionInternal,
    LibProjectConfigInternal
} from '../interfaces/internals';

import { InternalError, InvalidConfigError } from '../error-models';
import { initAppConfig, initLibConfig, validateOutputPath } from '../helpers';
import { findUpSync, isInFolder, Logger, readJsonSync } from '../utils';

export class AngularBuildContext<TConfig extends AppProjectConfigInternal | LibProjectConfigInternal> {
    static telemetryPluginAdded = false;
    static tscCliPath: string | null | undefined;
    static ngcCliPath: string | null | undefined;

    static get startTime(): number {
        return AngularBuildContext._startTime;
    }

    static get angularBuildConfig(): AngularBuildConfigInternal | null | undefined {
        if (!AngularBuildContext._initialized) {
            throw new InternalError('AngularBuildContext has not been initialized.');
        }

        return AngularBuildContext._angularBuildConfig;
    }

    static get logger(): Logger {
        if (!AngularBuildContext._initialized || AngularBuildContext._logger == null) {
            throw new InternalError('AngularBuildContext has not been initialized.');
        }

        return AngularBuildContext._logger;
    }

    static get fromAngularBuildCli(): boolean {
        if (!AngularBuildContext._initialized) {
            throw new InternalError('AngularBuildContext has not been initialized.');
        }

        if (AngularBuildContext._fromAngularBuildCli) {
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

        // tslint:disable-next-line:no-typeof-undefined
        if (typeof AngularBuildContext._nodeModulesPath !== 'undefined') {
            return AngularBuildContext._nodeModulesPath;
        }

        const foundNodeModulesPath = findUpSync('node_modules',
            AngularBuildContext.workspaceRoot,
            path.parse(AngularBuildContext.workspaceRoot).root);

        if (foundNodeModulesPath) {
            AngularBuildContext._nodeModulesPath = foundNodeModulesPath;
        } else {
            AngularBuildContext._nodeModulesPath = null;
        }

        return AngularBuildContext._nodeModulesPath;
    }

    static get cliVersion(): string | undefined | null {
        if (!AngularBuildContext._initialized) {
            throw new InternalError('AngularBuildContext has not been initialized.');
        }

        // tslint:disable-next-line:no-typeof-undefined
        if (typeof AngularBuildContext._cliVersion !== 'undefined') {
            return AngularBuildContext._cliVersion;
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
            AngularBuildContext._cliVersion = pkgJson.version;
        } else {
            AngularBuildContext._cliVersion = null;
        }

        return AngularBuildContext._cliVersion;
    }

    static get angularVersion(): string | undefined | null {
        // tslint:disable-next-line:no-typeof-undefined
        if (typeof AngularBuildContext._angularVersion !== 'undefined') {
            return AngularBuildContext._angularVersion;
        }

        let packageJsonPath = '';

        if (AngularBuildContext.nodeModulesPath) {
            const tempPath = path.resolve(AngularBuildContext.nodeModulesPath, '@angular/core/package.json');
            if (existsSync(tempPath)) {
                packageJsonPath = tempPath;
            }
        }

        if (!packageJsonPath &&
            AngularBuildContext.cliRootPath &&
            existsSync(path.resolve(AngularBuildContext.cliRootPath, 'node_modules/@angular/core/package.json'))) {
            packageJsonPath = path.resolve(AngularBuildContext.cliRootPath, 'node_modules/@angular/core/package.json');
        }

        if (packageJsonPath) {
            const pkgJson = readJsonSync(packageJsonPath);
            AngularBuildContext._angularVersion = pkgJson.version;
        } else {
            AngularBuildContext._angularVersion = null;
        }

        return AngularBuildContext._angularVersion;
    }

    static get typescriptVersion(): string | undefined | null {
        // tslint:disable-next-line:no-typeof-undefined
        if (typeof AngularBuildContext._typescriptVersion !== 'undefined') {
            return AngularBuildContext._typescriptVersion;
        }

        let packageJsonPath = '';

        if (AngularBuildContext.nodeModulesPath) {
            const tempPath = path.resolve(AngularBuildContext.nodeModulesPath, 'typescript/package.json');
            if (existsSync(tempPath)) {
                packageJsonPath = tempPath;
            }
        }

        if (!packageJsonPath &&
            AngularBuildContext.cliRootPath &&
            existsSync(path.resolve(AngularBuildContext.cliRootPath, 'node_modules/typescript/package.json'))) {
            packageJsonPath = path.resolve(AngularBuildContext.cliRootPath, 'node_modules/typescript/package.json');
        }

        if (packageJsonPath) {
            const pkgJson = readJsonSync(packageJsonPath);
            AngularBuildContext._typescriptVersion = pkgJson.version;
        } else {
            AngularBuildContext._typescriptVersion = null;
        }

        return AngularBuildContext._typescriptVersion;
    }

    static get webpackVersion(): string | undefined | null {
        // tslint:disable-next-line:no-typeof-undefined
        if (typeof AngularBuildContext._webpackVersion !== 'undefined') {
            return AngularBuildContext._webpackVersion;
        }

        let packageJsonPath = '';

        if (AngularBuildContext.nodeModulesPath) {
            const tempPath = path.resolve(AngularBuildContext.nodeModulesPath, 'webpack/package.json');
            if (existsSync(tempPath)) {
                packageJsonPath = tempPath;
            }
        }

        if (!packageJsonPath &&
            AngularBuildContext.cliRootPath &&
            existsSync(path.resolve(AngularBuildContext.cliRootPath, 'node_modules/webpack/package.json'))) {
            packageJsonPath = path.resolve(AngularBuildContext.cliRootPath, 'node_modules/webpack/package.json');
        }

        if (packageJsonPath) {
            const pkgJson = readJsonSync(packageJsonPath);
            AngularBuildContext._webpackVersion = pkgJson.version;
        } else {
            AngularBuildContext._webpackVersion = null;
        }

        return AngularBuildContext._webpackVersion;
    }

    static get rollupVersion(): string | undefined | null {
        // tslint:disable-next-line:no-typeof-undefined
        if (typeof AngularBuildContext._rollupVersion !== 'undefined') {
            return AngularBuildContext._rollupVersion;
        }

        let packageJsonPath = '';

        if (AngularBuildContext.nodeModulesPath) {
            const tempPath = path.resolve(AngularBuildContext.nodeModulesPath, 'rollup/package.json');
            if (existsSync(tempPath)) {
                packageJsonPath = tempPath;
            }
        }

        if (!packageJsonPath &&
            AngularBuildContext.cliRootPath &&
            existsSync(path.resolve(AngularBuildContext.cliRootPath, 'node_modules/rollup/package.json'))) {
            packageJsonPath = path.resolve(AngularBuildContext.cliRootPath, 'node_modules/rollup/package.json');
        }

        if (packageJsonPath) {
            const pkgJson = readJsonSync(packageJsonPath);
            AngularBuildContext._rollupVersion = pkgJson.version;
        } else {
            AngularBuildContext._rollupVersion = null;
        }

        return AngularBuildContext._rollupVersion;
    }

    static get libCount(): number {
        return AngularBuildContext._libCount;
    }

    static get appCount(): number {
        return AngularBuildContext._appCount;
    }

    static get telemetryDisabled(): boolean {
        return process.argv.includes('--disable-telemetry') || process.env.ANGULAR_BUILD_TELEMETRY_OPTOUT ? true : false;
    }

    readonly projectConfigWithoutEnvApplied: TConfig;
    readonly projectConfig: TConfig;
    readonly host: virtualFs.Host;
    readonly aliasHost: virtualFs.Host<any>;

    get buildOptions(): BuildOptionInternal {
        return this._buildOptions;
    }

    get buildOptimizerCacheDirectory(): string {
        if (this._buildOptimizerCachePath) {
            return this._buildOptimizerCachePath;
        }

        let cacheDir = '';

        if (AngularBuildContext.nodeModulesPath &&
            isInFolder(AngularBuildContext.workspaceRoot, AngularBuildContext.nodeModulesPath)) {

            let prefix = '';
            if (this.projectConfig.root) {
                prefix = `-${path.basename(this.projectConfig.root)}`;
            } else if (this.projectConfig._packageNameWithoutScope) {
                prefix = `-${path.basename(this.projectConfig._packageNameWithoutScope)}`;
            }

            const pkgPath = path.resolve(AngularBuildContext.nodeModulesPath, '@angular-devkit/build-optimizer');
            if (existsSync(pkgPath)) {
                cacheDir = path.resolve(pkgPath, `./.${prefix}cache/`);
            }
        }

        if (!cacheDir) {
            cacheDir = path.resolve(AngularBuildContext.workspaceRoot, this.projectConfig.root || '', './.bo-cache/');
        }

        this._buildOptimizerCachePath = cacheDir;

        return this._buildOptimizerCachePath;
    }

    get rptCacheDirectory(): string {
        if (this._rptCachePath) {
            return this._rptCachePath;
        }

        const cacheDir = path.resolve(AngularBuildContext.workspaceRoot, this.projectConfig.root || '', './.rpt-cache/');
        this._rptCachePath = cacheDir;

        return this._rptCachePath;
    }

    private static _initialized = false;
    private static _appCount = 0;
    private static _libCount = 0;
    private static _startTime = Date.now();
    private static _angularVersion: string | undefined | null;
    private static _typescriptVersion: string | undefined | null;
    private static _webpackVersion: string | undefined | null;
    private static _rollupVersion: string | undefined | null;
    private static _cliVersion: string | undefined | null;
    private static _nodeModulesPath: string | undefined | null;
    private static _workspaceRoot: string;
    private static _cliIsGlobal: boolean | null = null;
    private static _cliRootPath: string | null = null;
    private static _fromAngularBuildCli: boolean | null;
    private static _logger: Logger | null = null;
    private static _angularBuildConfig: AngularBuildConfigInternal | null = null;

    private readonly _buildOptions: BuildOptionInternal;

    private _buildOptimizerCachePath: string | null = null;
    private _rptCachePath: string | null = null;

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

        if (options.fromAngularBuildCli != null && AngularBuildContext._fromAngularBuildCli == null) {
            AngularBuildContext._fromAngularBuildCli = options.fromAngularBuildCli;
        }

        if (options.angularBuildConfig != null && AngularBuildContext._angularBuildConfig == null) {
            AngularBuildContext._angularBuildConfig = options.angularBuildConfig;
        }

        if (options.cliRootPath != null && AngularBuildContext._cliRootPath == null) {
            AngularBuildContext._cliRootPath = options.cliRootPath;
        }

        if (options.cliVersion != null && AngularBuildContext._cliVersion == null) {
            AngularBuildContext._cliVersion = options.cliVersion;
        }

        if (options.cliIsGlobal != null && AngularBuildContext._cliIsGlobal == null) {
            AngularBuildContext._cliIsGlobal = options.fromAngularBuildCli && options.cliIsGlobal ? true : false;
        }

        if (options.logger) {
            AngularBuildContext._logger = options.logger;
        } else if (!AngularBuildContext._logger) {
            AngularBuildContext._logger = options.logger ||
                new Logger({
                    name: '',
                    logLevel: options.logLevel || 'info',
                    debugPrefix: 'DEBUG:',
                    warnPrefix: 'WARNING:'
                });
        }

        AngularBuildContext._initialized = true;

        this.host = options.host;
        this.aliasHost = new virtualFs.AliasHost(options.host as virtualFs.Host<any>);
        this._buildOptions = options.buildOptions;
        this.projectConfigWithoutEnvApplied = options.projectConfigWithoutEnvApplied;
        this.projectConfig = options.projectConfig;

        if (this.projectConfig.root && path.isAbsolute(this.projectConfig.root)) {
            throw new InvalidConfigError(
                `The 'projects[${this.projectConfig.name || this.projectConfig._index}].root' must be relative path.`);
        }

        this.projectConfig._workspaceRoot = AngularBuildContext._workspaceRoot;
        this.projectConfig._nodeModulesPath = AngularBuildContext._nodeModulesPath;
        this.projectConfig._projectRoot = path.resolve(AngularBuildContext.workspaceRoot, this.projectConfig.root || '');
        if (this.projectConfig.outputPath) {
            this.projectConfig._outputPath = path.resolve(AngularBuildContext.workspaceRoot, this.projectConfig.outputPath);
        }

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
                this.projectConfig._packageJson.version === '[PLACEHOLDER]' ||
                this.projectConfig._packageJson.version === '0.0.0-[PLACEHOLDER]')) {
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

        if (this.projectConfig._projectName &&
            (this.projectConfig._projectName.split('/').length > 2 ||
                (!this.projectConfig._projectName.startsWith('@') &&
                    this.projectConfig._projectName.split('/').length >= 2))) {
            this.projectConfig._isNestedPackage = true;
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
