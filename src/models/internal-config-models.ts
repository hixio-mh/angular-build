import { existsSync, readFileSync } from 'fs';
import * as path from 'path';

import * as ts from 'typescript';

import { Logger } from '../utils/logger';
import { readJsonSync } from '../utils/read-json';

import {
    AngularBuildConfig,
    AppProjectConfig,
    BundleOptions,
    LibProjectConfig,
    PreDefinedEnvironment,
    ProjectConfig,
    TsTranspilationOptions
} from './config-models';
import { InternalError, InvalidConfigError } from './errors';

export interface DllParsedResult {
    tsEntries: string[];
    scriptEntries: string[];
    styleEntries: string[];
}

export interface GlobalParsedEntry {
    paths: string[];
    entry: string;
    lazy?: boolean;
}

export interface AngularBuildConfigInternal extends AngularBuildConfig {
    _configPath: string;
    _schema?: object;
    _schemaValidated?: boolean;
}

export interface ProjectConfigSharedInternal {
    _projectType: 'app' | 'lib';
    _index: number;
    _styleParsedEntries: GlobalParsedEntry[];
}

export interface BundleOptionsInternal extends BundleOptions {
    _index?: number;
    _entryFilePath?: string;
    _outputFilePath?: string;

    _tsConfigPath?: string;
    _tsConfigJson?: any;
    _tsCompilerConfig?: ts.ParsedCommandLine;
    _ecmaVersion?: number;
    _nodeResolveFields?: string[];


    _expectedScriptTarget?: ts.ScriptTarget;
    _exactScriptTarget?: ts.ScriptTarget;
}

export interface TsTranspilationOptionsInternal extends TsTranspilationOptions {
    _tsConfigPath?: string;
    _tsConfigJson?: any;
    _tsCompilerConfig?: ts.ParsedCommandLine;
    _tsOutDir?: string;
    _angularCompilerOptions?: any;
}

export type ProjectConfigInternal = ProjectConfig & ProjectConfigSharedInternal;

export type AppProjectConfigInternal = AppProjectConfig & ProjectConfigSharedInternal & {
    _tsConfigPath?: string;
    _tsConfigJson?: any;
    _tsCompilerConfig?: ts.ParsedCommandLine;
    _tsOutDir?: string;
    _angularCompilerOptions?: any;
    _ecmaVersion?: number;
    _nodeResolveFields?: string[];

    _dllParsedResult?: DllParsedResult;
    _polyfillParsedResult?: DllParsedResult;
    _scriptParsedEntries?: GlobalParsedEntry[];
};

export type LibProjectConfigInternal = LibProjectConfig & ProjectConfigSharedInternal & {
};

export class AngularBuildContext {
    private static _initialized = false;

    private static _environment: PreDefinedEnvironment = {};
    static get environment(): PreDefinedEnvironment {
        if (!AngularBuildContext._initialized) {
            throw new InternalError('AngularBuildContext has not been initialized.');
        }
        return AngularBuildContext._environment;
    }

    private static _angularBuildConfig: AngularBuildConfigInternal | null = null;
    static get angularBuildConfig(): AngularBuildConfigInternal {
        if (!AngularBuildContext._initialized || AngularBuildContext._angularBuildConfig == null) {
            throw new InternalError('AngularBuildContext has not been initialized.');
        }
        return AngularBuildContext._angularBuildConfig;
    }

    private static _startTime = Date.now();
    static get startTime(): number {
        return AngularBuildContext._startTime;
    }

    private static _angularBuildVersion: string | null = null;
    static get angularBuildVersion(): string {
        if (!AngularBuildContext._initialized || AngularBuildContext._angularBuildVersion == null) {
            throw new InternalError('AngularBuildContext has not been initialized.');
        }
        return AngularBuildContext._angularBuildVersion;
    }

    private static _logger: Logger | null = null;
    static get logger(): Logger {
        if (!AngularBuildContext._initialized || AngularBuildContext._logger == null) {
            throw new InternalError('AngularBuildContext has not been initialized.');
        }
        return AngularBuildContext._logger;
    }

    private static _fromAngularBuildCli: boolean | null = null;
    static get fromAngularBuildCli(): boolean {
        if (!AngularBuildContext._initialized || AngularBuildContext._fromAngularBuildCli == null) {
            throw new InternalError('AngularBuildContext has not been initialized.');
        }
        return AngularBuildContext._fromAngularBuildCli;
    }

    private static _libCount: number = 0;
    static get libCount(): number {
        return AngularBuildContext._libCount;
    }

    private static _appCount: number = 0;
    static get appCount(): number {
        return AngularBuildContext._appCount;
    }

    static get telemetryDisabled(): boolean {
        const disabled =
            process.argv.includes('--disable-telemetry') || process.env.ANGULAR_BUILD_TELEMETRY_OPTOUT ? true : false;
        return disabled;
    }

    static angularBuildCliRootPath?: string;
    static cliIsGlobal?: boolean;

    static watch?: boolean;
    static progress?: boolean;
    static cleanOutDirs?: boolean;
    static webpackArgv?: any;

    static telemetryPluginAdded: boolean = false;

    // app only
    dllBuildOnly?: boolean;

    constructor(
        readonly projectConfigMaster: ProjectConfigInternal,
        readonly projectConfig: ProjectConfigInternal
    ) {
        if (projectConfig._projectType === 'lib') {
            AngularBuildContext._libCount = AngularBuildContext._libCount + 1;
        } else {
            AngularBuildContext._appCount = AngularBuildContext._appCount + 1;
        }
    }

    static init(environment: PreDefinedEnvironment,
        angularBuildConfig: AngularBuildConfigInternal,
        fromAngularBuildCli: boolean,
        angularBuildVersion: string, startTime: number): void {
        AngularBuildContext._environment = environment;
        AngularBuildContext._angularBuildConfig = angularBuildConfig;
        AngularBuildContext._fromAngularBuildCli = fromAngularBuildCli;
        AngularBuildContext._angularBuildVersion = angularBuildVersion;
        AngularBuildContext._startTime = startTime;

        AngularBuildContext._logger = new Logger({
            name: '',
            logLevel: angularBuildConfig.logLevel || 'info',
            debugPrefix: 'DEBUG:',
            warnPrefix: 'WARNING:'
        });

        AngularBuildContext._initialized = true;
    }

    static get projectRoot(): string {
        if (!AngularBuildContext._initialized) {
            throw new InternalError('AngularBuildContext has not been initialized.');
        }

        return path.dirname(AngularBuildContext.angularBuildConfig._configPath);
    }

    private static _nodeModulesPath: string = '';
    static get nodeModulesPath(): string {
        if (AngularBuildContext._nodeModulesPath) {
            return AngularBuildContext._nodeModulesPath;
        }

        AngularBuildContext._nodeModulesPath = path.resolve(AngularBuildContext.projectRoot, 'node_modules');
        return AngularBuildContext._nodeModulesPath;
    }

    private static _angularVersion: string = '';
    static get angularVersion(): string {
        if (typeof AngularBuildContext._angularVersion !== 'undefined') {
            return AngularBuildContext._angularVersion;
        }

        const angularCorePackageJsonPath = path.resolve(AngularBuildContext.nodeModulesPath, '@angular/core/package.json');
        if (existsSync(angularCorePackageJsonPath)) {
            const pkgJson = readJsonSync(angularCorePackageJsonPath);
            AngularBuildContext._angularVersion = pkgJson.version;
        } else {
            AngularBuildContext._angularVersion = '';
        }

        return AngularBuildContext._angularVersion;
    }

    private static _webpackVersion: string = '';
    static get webpackVersion(): string {
        if (typeof AngularBuildContext._webpackVersion !== 'undefined') {
            return AngularBuildContext._webpackVersion;
        }

        const webpackPackageJsonPath = path.resolve(AngularBuildContext.nodeModulesPath, 'webpack/package.json');
        if (existsSync(webpackPackageJsonPath)) {
            const pkgJson = readJsonSync(webpackPackageJsonPath);
            AngularBuildContext._webpackVersion = pkgJson.version;
        } else {
            AngularBuildContext._webpackVersion = '';
        }

        return AngularBuildContext._webpackVersion;
    }

    private _bannerText?: string;
    get bannerText(): string | undefined {
        if (typeof this._bannerText !== 'undefined') {
            return this._bannerText;
        }

        if (!this.projectConfig.banner) {
            this._bannerText = '';
            return this._bannerText;
        }

        const srcDir = path.resolve(AngularBuildContext.projectRoot, this.projectConfig.srcDir || '');
        let tempBannerText = this.projectConfig.banner;

        // read banner
        if (/\.txt$/i.test(tempBannerText)) {
            if (this.projectConfig.srcDir && existsSync(path.resolve(srcDir, tempBannerText))) {
                tempBannerText = readFileSync(path.resolve(srcDir, tempBannerText), 'utf-8');
            } else if (srcDir !== AngularBuildContext.projectRoot &&
                existsSync(path.resolve(AngularBuildContext.projectRoot, tempBannerText))) {
                tempBannerText = readFileSync(path.resolve(AngularBuildContext.projectRoot, tempBannerText), 'utf-8');
            } else {
                throw new InvalidConfigError(
                    `The banner text file: ${path.resolve(srcDir, tempBannerText)} doesn't exists.`);
            }
        }

        if (tempBannerText) {
            tempBannerText = this.addCommentToBanner(tempBannerText);
            tempBannerText = tempBannerText.replace(/[\$|\[]CURRENT[_\-]?YEAR[\$|\]]/gim,
                (new Date()).getFullYear().toString());
            if (this.projectName) {
                tempBannerText = tempBannerText.replace(/[\$|\[](PACKAGE|APP|APPLICATION|PROJECT)?[_\-]?NAME[\$|\]]/gim,
                    this.projectName);
            }

            if (this.projectVersion) {
                tempBannerText =
                    tempBannerText.replace(/[\$|\[](PACKAGE|APP|APPLICATION|PROJECT)?[_\-]?VERSION[\$|\]]/gim,
                        this.projectVersion);
            }

            this._bannerText = tempBannerText;
        }

        this._bannerText = this._bannerText || '';
        return this._bannerText;
    }

    private _packageConfigPath?: string;
    get packageConfigPath(): string | undefined {
        if (typeof this._packageConfigPath !== 'undefined') {
            return this._packageConfigPath;
        }

        this.initPackageConfigPaths();
        return this._packageConfigPath;
    }

    private _rootPackageConfigPath?: string;
    get rootPackageConfigPath(): string | undefined {
        if (typeof this._rootPackageConfigPath !== 'undefined') {
            return this._rootPackageConfigPath;
        }

        this.initPackageConfigPaths();
        return this._rootPackageConfigPath;
    }

    private _packageJson?: any;
    get packageJson(): any {
        if (typeof this._packageJson !== 'undefined') {
            return this._packageJson;
        }

        const packageConfigPath = this.packageConfigPath;
        if (!packageConfigPath) {
            this._packageJson = null;
            return this._packageJson;
        }

        this._packageJson = readJsonSync(packageConfigPath);
        return this._packageJson;
    }

    private _rootPackageJson?: any;
    get rootPackageJson(): any {
        if (typeof this._rootPackageJson !== 'undefined') {
            return this._rootPackageJson;
        }

        this.initPackageConfigPaths();
        const rootPackageConfigPath = this._rootPackageConfigPath;
        if (!rootPackageConfigPath) {
            this._rootPackageJson = null;
            return this._rootPackageJson;
        }

        this._rootPackageJson = readJsonSync(rootPackageConfigPath);
        return this._rootPackageJson;
    }

    get projectName(): string | undefined {
        const packageJson = this.packageJson;
        if (packageJson) {
            return packageJson.name;
        }

        return undefined;
    }

    get projectVersion(): string | undefined {
        const packageJson = this.packageJson;
        const rootPackageJson = this.rootPackageJson;

        if (rootPackageJson &&
            rootPackageJson.version &&
            (!packageJson.version || packageJson.version === '0.0.0' ||
                packageJson.version === '[PLACEHOLDER]' ||
                packageJson.version === '0.0.0-[PLACEHOLDER]')) {
            return rootPackageJson.version;
        } else {
            if (packageJson && packageJson.version) {
                return packageJson.version;
            }
            return undefined;
        }
    }

    get projectDescription(): string | undefined {
        const packageJson = this.packageJson;

        if (packageJson && packageJson.description) {
            return packageJson.description;
        }
        return undefined;
    }

    get projectAuthor(): string | undefined {
        const packageJson = this.packageJson;
        const rootPackageJson = this.rootPackageJson;

        if (packageJson && packageJson.author) {
            return packageJson.author;
        } else if (rootPackageJson && rootPackageJson.author) {
            return rootPackageJson.author;
        }
        return undefined;
    }

    get projectHomePage(): string | undefined {
        const packageJson = this.packageJson;
        const rootPackageJson = this.rootPackageJson;

        if (packageJson && packageJson.homepage) {
            return packageJson.homepage;
        } else if (rootPackageJson && rootPackageJson.homepage) {
            return rootPackageJson.homepage;
        }
        return undefined;
    }

    get packageScope(): string | undefined {
        const packageName = this.projectName;
        if (!packageName) {
            return undefined;
        }

        if (packageName.indexOf('/') > -1 && packageName.startsWith('@')) {
            const nameParts = packageName.split('/');
            return nameParts[0];
        } else {
            return undefined;
        }
    }

    get packageNameWithoutScope(): string | undefined {
        const packageName = this.projectName;
        if (!packageName) {
            return undefined;
        }

        if (packageName.indexOf('/') > -1 && packageName.startsWith('@')) {
            const nameParts = packageName.split('/');
            return nameParts[nameParts.length - 1];
        } else {
            return packageName;
        }
    }

    get parentPackageName(): string | undefined {
        const packageName = this.projectName;
        if (!packageName) {
            return undefined;
        }

        if (packageName.indexOf('/') > -1) {
            const nameParts = packageName.split('/');
            if (nameParts.length > 2) {
                return nameParts[nameParts.length - 2];
            }
        }

        return undefined;
    }

    get isPackagePrivate(): boolean | undefined {
        const packageJson = this.packageJson;
        if (packageJson) {
            return packageJson.private;
        }

        return undefined;
    }

    private initPackageConfigPaths(): void {
        if (typeof this._packageConfigPath !== 'undefined') {
            return;
        }

        const srcDir = path.resolve(AngularBuildContext.projectRoot, this.projectConfig.srcDir || '');
        let pkgConfigPath = path.resolve(srcDir, 'package.json');

        if (this.projectConfig._projectType === 'lib') {
            const libConfig = this.projectConfig as LibProjectConfig;
            if (libConfig.packageOptions &&
                libConfig.packageOptions.packageJsonFile) {
                pkgConfigPath = path.resolve(srcDir, libConfig.packageOptions.packageJsonFile);
                if (existsSync(pkgConfigPath)) {
                    this._packageConfigPath = pkgConfigPath;
                    if (pkgConfigPath === path.resolve(AngularBuildContext.projectRoot, 'package.json')) {
                        this._rootPackageConfigPath = pkgConfigPath;
                    }
                } else {
                    throw new InvalidConfigError(
                        `The package config file: ${pkgConfigPath} doesn't exists.`);
                }
            }
        }

        if (!this._packageConfigPath) {
            if (this.projectConfig.srcDir &&
                srcDir !== AngularBuildContext.projectRoot &&
                existsSync(pkgConfigPath)) {
                this._packageConfigPath = pkgConfigPath;

                if (pkgConfigPath === path.resolve(AngularBuildContext.projectRoot, 'package.json')) {
                    this._rootPackageConfigPath = pkgConfigPath;
                }
            }
            if (!this._packageConfigPath &&
                this.projectConfig.srcDir &&
                srcDir !== AngularBuildContext.projectRoot &&
                path.resolve(srcDir, '../package.json') !== pkgConfigPath) {
                pkgConfigPath = path.resolve(srcDir, '../package.json');
                if (existsSync(pkgConfigPath)) {
                    this._packageConfigPath = pkgConfigPath;

                    if (pkgConfigPath === path.resolve(AngularBuildContext.projectRoot, 'package.json')) {
                        this._rootPackageConfigPath = pkgConfigPath;
                    }
                }
            }
            if (!this._packageConfigPath &&
                path.resolve(AngularBuildContext.projectRoot, 'package.json') !== pkgConfigPath &&
                existsSync(path.resolve(AngularBuildContext.projectRoot, 'package.json'))) {
                pkgConfigPath = path.resolve(AngularBuildContext.projectRoot, 'package.json');
                this._packageConfigPath = pkgConfigPath;
                this._rootPackageConfigPath = pkgConfigPath;
            }
        }

        const rootPkgConfigPath = path.resolve(AngularBuildContext.projectRoot, 'package.json');
        if (!this._rootPackageConfigPath && existsSync(rootPkgConfigPath)) {
            this._rootPackageConfigPath = rootPkgConfigPath;
        }

        this._rootPackageConfigPath = this._rootPackageConfigPath || '';
        this._packageConfigPath = this._packageConfigPath || '';
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
}
