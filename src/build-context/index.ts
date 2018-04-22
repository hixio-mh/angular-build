import { existsSync, readFileSync, statSync } from 'fs';
import * as path from 'path';

import { virtualFs } from '@angular-devkit/core';
import * as ts from 'typescript';

import {
    AngularBuildConfig,
    AppProjectConfig,
    AppProjectConfigBase,
    BuildOptions,
    DllOptions,
    GlobalEntry,
    LibBundleOptions,
    LibProjectConfig,
    LibProjectConfigBase,
    ProjectConfig,
    ProjectConfigBase,
    TsTranspilationOptions,
} from '../interfaces';

import { InternalError, InvalidConfigError, InvalidOptionError } from '../error-models';

import { isInFolder, isSamePaths, Logger, LogLevelSring, normalizeRelativePath, readJsonSync } from '../utils';

export interface BuildOptionInternal extends BuildOptions {
    environment: { [key: string]: boolean | string };
}

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
    libs: LibProjectConfigInternal[];
    apps: AppProjectConfigInternal[];

    _schema?: { [key: string]: any };
    _configPath: string;
}

export interface LibBundleOptionsInternal extends LibBundleOptions {
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

export interface ProjectConfigInternal<TConfig extends ProjectConfigBase> extends ProjectConfig<TConfig> {
    _projectType?: 'app' | 'lib';
    _index?: number;
    _configPath?: string;

    _bannerText?: string;
    _packageConfigPath?: string;
    _rootPackageConfigPath?: string;
    _packageJson?: { [key: string]: string };
    _rootPackageJson?: { [key: string]: string };

    _projectName?: string;
    _projectVersion?: string;
    _projectDescription?: string;
    _projectAuthor?: string;
    _projectHomePage?: string;
    _packageScope?: string;
    _packageNameWithoutScope?: string;
    _parentPackageName?: string;
    _isPackagePrivate?: boolean;
}

export interface AppProjectConfigInternal extends AppProjectConfig, ProjectConfigInternal<AppProjectConfigBase> {
    _outputHashing?: {
        bundles?: boolean;
        chunks?: boolean;
        extractedAssets?: boolean;
    };

    _tsConfigPath?: string;
    _tsConfigJson?: any;
    _tsCompilerConfig?: ts.ParsedCommandLine;
    _tsOutDir?: string;
    _angularCompilerOptions?: any;
    _ecmaVersion?: number;
    _nodeResolveFields?: string[];

    _isDll?: boolean;
    _dllParsedResult?: DllParsedResult;
    _polyfillParsedResult?: DllParsedResult;
    _scriptParsedEntries?: GlobalParsedEntry[];
    _styleParsedEntries?: GlobalParsedEntry[];
}

export interface LibProjectConfigInternal extends LibProjectConfig, ProjectConfigInternal<LibProjectConfigBase> {
    _styleParsedEntries?: GlobalParsedEntry[];
}

export interface BuildContextInstanceOptions<TConfig extends AppProjectConfigInternal | LibProjectConfigInternal> {
    projectConfigWithoutEnvApplied: TConfig;
    projectConfig: TConfig;
    buildOptions: BuildOptionInternal;
    host?: virtualFs.Host<any>;
}

export interface BuildContextStaticOptions {
    workspaceRoot: string;
    startTime?: number;
    angularBuildConfig?: AngularBuildConfigInternal;
    fromAngularBuildCli?: boolean;
    cliRootPath?: string;
    cliVersion?: string;
    cliIsGlobal?: boolean;
    logger?: Logger;
    logLevel?: LogLevelSring;
}

export class AngularBuildContext<TConfig extends AppProjectConfigInternal | LibProjectConfigInternal> {
    static telemetryPluginAdded = false;

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

    static get cliRootPath(): string | undefined {
        if (!AngularBuildContext._initialized) {
            throw new InternalError('AngularBuildContext has not been initialized.');
        }

        return AngularBuildContext._cliRootPath;
    }

    static get cliIsGlobal(): boolean | undefined {
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

        if (typeof AngularBuildContext._nodeModulesPath !== 'undefined') {
            return AngularBuildContext._nodeModulesPath;
        }

        const tempNodeModulesPath = path.resolve(AngularBuildContext.workspaceRoot, 'node_modules');
        if (existsSync(tempNodeModulesPath)) {
            AngularBuildContext._nodeModulesPath = tempNodeModulesPath;
            return AngularBuildContext._nodeModulesPath;
        }

        let foundNodeModulesPath: string | null = null;
        const root = path.parse(AngularBuildContext.workspaceRoot).root;
        let currentDir = path.dirname(AngularBuildContext.workspaceRoot);

        while (currentDir && !isSamePaths(currentDir, root)) {
            const nodeModulesPath = path.resolve(currentDir, 'node_modules');
            if (existsSync(nodeModulesPath)) {
                foundNodeModulesPath = nodeModulesPath;
                break;
            } else {
                currentDir = path.dirname(currentDir);
            }
        }

        if (foundNodeModulesPath) {
            AngularBuildContext._nodeModulesPath = foundNodeModulesPath;
            return AngularBuildContext._nodeModulesPath;
        }

        AngularBuildContext._nodeModulesPath = null;
        return AngularBuildContext._nodeModulesPath;
    }

    static get cliVersion(): string | undefined | null {
        if (!AngularBuildContext._initialized) {
            throw new InternalError('AngularBuildContext has not been initialized.');
        }

        if (typeof AngularBuildContext._cliVersion !== 'undefined') {
            return AngularBuildContext._cliVersion;
        }

        if (!AngularBuildContext.nodeModulesPath) {
            AngularBuildContext._cliVersion = null;
            return AngularBuildContext._cliVersion;
        }

        let foundJson = false;
        let angularBuildPackageJsonPath =
            path.resolve(AngularBuildContext.nodeModulesPath, '@bizappframework/angular-build/package.json');
        if (existsSync(angularBuildPackageJsonPath)) {
            foundJson = true;
        } else {
            if (existsSync(path.resolve(__dirname, '../package.json'))) {
                angularBuildPackageJsonPath = path.resolve(__dirname, '../package.json');
                foundJson = true;
            } else if (existsSync(path.resolve(__dirname, '../../package.json'))) {
                angularBuildPackageJsonPath = path.resolve(__dirname, '../../package.json');
                foundJson = true;
            } else if (AngularBuildContext.cliRootPath &&
                existsSync(path.resolve(AngularBuildContext.cliRootPath, 'package.json'))) {
                angularBuildPackageJsonPath = path.resolve(AngularBuildContext.cliRootPath, 'package.json');
                foundJson = true;
            }
        }

        if (foundJson) {
            const pkgJson = readJsonSync(angularBuildPackageJsonPath);
            AngularBuildContext._cliVersion = pkgJson.version;
        } else {
            AngularBuildContext._cliVersion = null;
        }

        return AngularBuildContext._cliVersion;
    }

    static get angularVersion(): string | undefined | null {
        if (typeof AngularBuildContext._angularVersion !== 'undefined') {
            return AngularBuildContext._angularVersion;
        }

        if (!AngularBuildContext.nodeModulesPath) {
            AngularBuildContext._angularVersion = null;
            return AngularBuildContext._angularVersion;
        }

        const angularCorePackageJsonPath = path.resolve(AngularBuildContext.nodeModulesPath, '@angular/core/package.json');
        if (existsSync(angularCorePackageJsonPath)) {
            const pkgJson = readJsonSync(angularCorePackageJsonPath);
            AngularBuildContext._angularVersion = pkgJson.version;
        } else {
            AngularBuildContext._angularVersion = null;
        }

        return AngularBuildContext._angularVersion;
    }

    static get webpackVersion(): string | undefined | null {
        if (typeof AngularBuildContext._webpackVersion !== 'undefined') {
            return AngularBuildContext._webpackVersion;
        }

        if (!AngularBuildContext.nodeModulesPath) {
            AngularBuildContext._webpackVersion = null;
            return AngularBuildContext._webpackVersion;
        }

        const webpackPackageJsonPath = path.resolve(AngularBuildContext.nodeModulesPath, 'webpack/package.json');
        if (existsSync(webpackPackageJsonPath)) {
            const pkgJson = readJsonSync(webpackPackageJsonPath);
            AngularBuildContext._webpackVersion = pkgJson.version;
        } else {
            AngularBuildContext._webpackVersion = null;
        }

        return AngularBuildContext._webpackVersion;
    }

    static get libCount(): number {
        return AngularBuildContext._libCount;
    }

    static get appCount(): number {
        return AngularBuildContext._appCount;
    }

    static get telemetryDisabled(): boolean {
        const disabled =
            process.argv.includes('--disable-telemetry') || process.env.ANGULAR_BUILD_TELEMETRY_OPTOUT ? true : false;
        return disabled;
    }

    readonly projectRoot?: string;
    readonly projectConfigWithoutEnvApplied: TConfig;
    readonly projectConfig: TConfig;
    readonly host?: virtualFs.Host<any>;

    get buildOptions(): BuildOptionInternal {
        return this._buildOptions;
    }

    private static _initialized = false;
    private static _appCount = 0;
    private static _libCount = 0;
    private static _startTime = Date.now();
    private static _angularVersion: string | undefined | null = undefined;
    private static _webpackVersion: string | undefined | null = undefined;
    private static _cliVersion: string | undefined | null = undefined;
    private static _nodeModulesPath: string | undefined | null = undefined;
    private static _workspaceRoot: string;
    private static _cliIsGlobal: boolean | undefined = undefined;
    private static _cliRootPath: string | undefined = undefined;
    private static _fromAngularBuildCli: boolean | undefined;
    private static _logger: Logger | null = null;
    private static _angularBuildConfig: AngularBuildConfigInternal | null | undefined = null;

    private readonly _buildOptions: BuildOptionInternal;

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
            AngularBuildContext._cliIsGlobal = options.fromAngularBuildCli && options.cliIsGlobal;
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

        if (options.host) {
            this.host = options.host;
        }

        this._buildOptions = options.buildOptions;
        this.projectConfigWithoutEnvApplied = options.projectConfigWithoutEnvApplied;
        this.projectConfig = options.projectConfig;

        this.validateProjectConfig();

        this.initPackageJsons();
        this.initBannerText();

        if (this.projectConfig._projectType === 'lib') {
            AngularBuildContext._libCount = AngularBuildContext._libCount + 1;

            this.initLibTsConfigs(this.projectConfig as LibProjectConfigInternal);
            this.initLibParsedResults(this.projectConfig as LibProjectConfigInternal);
        } else {
            AngularBuildContext._appCount = AngularBuildContext._appCount + 1;

            this.initAppTsConfigs(this.projectConfig as AppProjectConfigInternal);
            this.initAppParsedResults(this.projectConfig as AppProjectConfigInternal);
        }
    }

    private initPackageJsons(): void {
        const projectRoot = path.resolve(AngularBuildContext.workspaceRoot, this.projectConfig.root || '');
        let pkgConfigPath = path.resolve(projectRoot, 'package.json');

        if (this.projectConfig._projectType === 'lib') {
            const libConfig = this.projectConfig as LibProjectConfigInternal;
            if (libConfig.packageOptions &&
                libConfig.packageOptions.packageJsonFile) {
                pkgConfigPath = path.resolve(projectRoot, libConfig.packageOptions.packageJsonFile);
                if (existsSync(pkgConfigPath)) {
                    this.projectConfig._packageConfigPath = pkgConfigPath;
                    if (pkgConfigPath === path.resolve(AngularBuildContext.workspaceRoot, 'package.json')) {
                        this.projectConfig._rootPackageConfigPath = pkgConfigPath;
                    }
                } else {
                    throw new InvalidConfigError(
                        `The package config file: ${pkgConfigPath} doesn't exists.`);
                }
            }
        }

        if (!this.projectConfig._packageConfigPath) {
            if (this.projectConfig.root &&
                projectRoot !== AngularBuildContext.workspaceRoot &&
                existsSync(pkgConfigPath)) {
                this.projectConfig._packageConfigPath = pkgConfigPath;

                if (pkgConfigPath === path.resolve(AngularBuildContext.workspaceRoot, 'package.json')) {
                    this.projectConfig._rootPackageConfigPath = pkgConfigPath;
                }
            }

            if (!this.projectConfig._packageConfigPath &&
                this.projectConfig.root &&
                projectRoot !== AngularBuildContext.workspaceRoot &&
                path.resolve(projectRoot, '../package.json') !== pkgConfigPath) {
                pkgConfigPath = path.resolve(projectRoot, '../package.json');
                if (existsSync(pkgConfigPath)) {
                    this.projectConfig._packageConfigPath = pkgConfigPath;

                    if (pkgConfigPath === path.resolve(AngularBuildContext.workspaceRoot, 'package.json')) {
                        this.projectConfig._rootPackageConfigPath = pkgConfigPath;
                    }
                }
            }
            if (!this.projectConfig._packageConfigPath && existsSync(pkgConfigPath)) {
                this.projectConfig._packageConfigPath = pkgConfigPath;
                if (pkgConfigPath === path.resolve(AngularBuildContext.workspaceRoot, 'package.json')) {
                    this.projectConfig._rootPackageConfigPath = pkgConfigPath;
                }
            }
            if (!this.projectConfig._packageConfigPath &&
                path.resolve(AngularBuildContext.workspaceRoot, 'package.json') !== pkgConfigPath &&
                existsSync(path.resolve(AngularBuildContext.workspaceRoot, 'package.json'))) {
                pkgConfigPath = path.resolve(AngularBuildContext.workspaceRoot, 'package.json');
                this.projectConfig._packageConfigPath = pkgConfigPath;
                this.projectConfig._rootPackageConfigPath = pkgConfigPath;
            }
        }

        const rootPkgConfigPath = path.resolve(AngularBuildContext.workspaceRoot, 'package.json');
        if (!this.projectConfig._rootPackageConfigPath && existsSync(rootPkgConfigPath)) {
            this.projectConfig._rootPackageConfigPath = rootPkgConfigPath;
        }

        if (this.projectConfig._packageConfigPath) {
            this.projectConfig._packageJson = readJsonSync(this.projectConfig._packageConfigPath);
        }

        if (this.projectConfig._rootPackageConfigPath) {
            this.projectConfig._rootPackageJson = readJsonSync(this.projectConfig._rootPackageConfigPath);
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
            this.projectConfig._projectName.indexOf('/') > -1 &&
            this.projectConfig._projectName.startsWith('@')) {
            const nameParts = this.projectConfig._projectName.split('/');
            this.projectConfig._packageNameWithoutScope = nameParts[nameParts.length - 1];
        }

        if (this.projectConfig._projectName && this.projectConfig._projectName.indexOf('/') > -1) {
            const nameParts = this.projectConfig._projectName.split('/');
            if (nameParts.length > 2) {
                this.projectConfig._parentPackageName = nameParts[nameParts.length - 2];
            }
        }

        if (this.projectConfig._packageJson && this.projectConfig._packageJson.private) {
            this.projectConfig._isPackagePrivate = true;
        }
    }

    private initBannerText(): void {
        if (!this.projectConfig.banner) {
            return;
        }

        const projectRoot = path.resolve(AngularBuildContext.workspaceRoot, this.projectConfig.root || '');
        let tempBannerText = this.projectConfig.banner;

        // read banner
        if (/\.txt$/i.test(tempBannerText)) {
            if (this.projectConfig.root && existsSync(path.resolve(projectRoot, tempBannerText))) {
                tempBannerText = readFileSync(path.resolve(projectRoot, tempBannerText), 'utf-8');
            } else if (projectRoot !== AngularBuildContext.workspaceRoot &&
                existsSync(path.resolve(AngularBuildContext.workspaceRoot, tempBannerText))) {
                tempBannerText = readFileSync(path.resolve(AngularBuildContext.workspaceRoot, tempBannerText), 'utf-8');
            } else {
                throw new InvalidConfigError(
                    `The banner text file: ${path.resolve(projectRoot, tempBannerText)} doesn't exists.`);
            }
        }

        if (tempBannerText) {
            tempBannerText = this.addCommentToBanner(tempBannerText);
            tempBannerText = tempBannerText.replace(/[\$|\[]CURRENT[_\-]?YEAR[\$|\]]/gim,
                (new Date()).getFullYear().toString());
            if (this.projectConfig._projectName) {
                tempBannerText = tempBannerText.replace(/[\$|\[](PACKAGE|APP|APPLICATION|PROJECT)?[_\-]?NAME[\$|\]]/gim,
                    this.projectConfig._projectName);
            }

            if (this.projectConfig._projectVersion) {
                tempBannerText =
                    tempBannerText.replace(/[\$|\[](PACKAGE|APP|APPLICATION|PROJECT)?[_\-]?VERSION[\$|\]]/gim,
                        this.projectConfig._projectVersion);
            }

            this.projectConfig._bannerText = tempBannerText;
        }
    }

    // apps
    private initAppTsConfigs(appConfig: AppProjectConfigInternal): void {
        const projectRoot = path.resolve(AngularBuildContext.workspaceRoot, appConfig.root || '');

        let tsConfigFilePath = path.resolve(projectRoot, appConfig.tsConfig || 'tsconfig.json');
        if (existsSync(tsConfigFilePath)) {
            appConfig._tsConfigPath = tsConfigFilePath;
        } else if (!appConfig.tsConfig &&
            appConfig.root &&
            projectRoot !== AngularBuildContext.workspaceRoot &&
            path.resolve(projectRoot, '../tsconfig.json') !== tsConfigFilePath) {
            tsConfigFilePath = path.resolve(projectRoot, '../tsconfig.json');
            if (existsSync(tsConfigFilePath)) {
                appConfig._tsConfigPath = tsConfigFilePath;
            }
        }
        if (!appConfig._tsConfigPath &&
            !appConfig.tsConfig &&
            path.resolve(AngularBuildContext.workspaceRoot, 'tsconfig.json') !== tsConfigFilePath) {
            tsConfigFilePath = path.resolve(AngularBuildContext.workspaceRoot, 'tsconfig.json');
            if (existsSync(tsConfigFilePath)) {
                appConfig._tsConfigPath = tsConfigFilePath;
            }
        }

        if (appConfig._tsConfigPath) {
            const jsonConfigFile = ts.readConfigFile(appConfig._tsConfigPath, ts.sys.readFile);
            if (jsonConfigFile.error && jsonConfigFile.error.length) {
                const formattedMsg = AngularBuildContext.formatDiagnostics(jsonConfigFile.error);
                if (formattedMsg) {
                    throw new InvalidConfigError(formattedMsg);
                }
            }

            // _tsConfigJson
            appConfig._tsConfigJson = jsonConfigFile.config;

            // _tsCompilerConfig
            appConfig._tsCompilerConfig = ts.parseJsonConfigFileContent(appConfig._tsConfigJson,
                ts.sys,
                path.dirname(appConfig._tsConfigPath),
                undefined,
                appConfig._tsConfigPath);
            const compilerOptions = appConfig._tsCompilerConfig.options;

            // _tsOutDir
            let tsOutputPath: string | undefined;
            if (!compilerOptions.outDir) {
                if (appConfig.outputPath) {
                    const outputPath = path.resolve(AngularBuildContext.workspaceRoot, appConfig.outputPath);
                    tsOutputPath = outputPath;
                }
            } else {
                tsOutputPath = path.isAbsolute(compilerOptions.outDir)
                    ? path.resolve(compilerOptions.outDir)
                    : path.resolve(path.dirname(appConfig._tsConfigPath), compilerOptions.outDir);
            }

            if (tsOutputPath && compilerOptions.rootDir &&
                !isSamePaths(compilerOptions.rootDir, path.dirname(appConfig._tsConfigPath)) &&
                isInFolder(compilerOptions.rootDir, path.dirname(appConfig._tsConfigPath))) {
                const relSubDir = normalizeRelativePath(
                    path.relative(
                        compilerOptions.rootDir,
                        path.dirname(appConfig._tsConfigPath)));
                tsOutputPath = path.resolve(tsOutputPath, relSubDir);
            }
            appConfig._tsOutDir = tsOutputPath;

            // _angularCompilerOptions
            appConfig._angularCompilerOptions = appConfig._tsConfigJson.angularCompilerOptions;

            // _ecmaVersion
            if (compilerOptions.target === ts.ScriptTarget.ES2017) {
                appConfig._ecmaVersion = 8;
            } else if (compilerOptions.target === ts.ScriptTarget.ES2016) {
                appConfig._ecmaVersion = 7;
            } else if (compilerOptions.target !== ts.ScriptTarget.ES3 && compilerOptions.target !== ts.ScriptTarget.ES5) {
                appConfig._ecmaVersion = 6;
            }

            // _nodeResolveFields
            let nodeResolveFields: string[] = [];
            if (compilerOptions.target === ts.ScriptTarget.ES2017) {
                nodeResolveFields.push('es2017');
                nodeResolveFields.push('es2016');
                nodeResolveFields.push('es2015');
            } else if (compilerOptions.target === ts.ScriptTarget.ES2016) {
                nodeResolveFields.push('es2016');
                nodeResolveFields.push('es2015');
            } else if (compilerOptions.target !== ts.ScriptTarget.ES3 &&
                compilerOptions.target !== ts.ScriptTarget.ES5) {
                nodeResolveFields.push('es2015');
            }

            if (appConfig.nodeResolveFields &&
                Array.isArray(appConfig.nodeResolveFields) &&
                appConfig.nodeResolveFields.length > 0) {
                nodeResolveFields = appConfig.nodeResolveFields;
            } else {
                if (appConfig._projectType === 'app' &&
                    (!appConfig.platformTarget || appConfig.platformTarget === 'web')) {
                    nodeResolveFields.push('browser');
                }
                const defaultMainFields = ['module', 'main'];
                nodeResolveFields.push(...defaultMainFields);
            }

            appConfig._nodeResolveFields = nodeResolveFields;
        }
    }

    private initAppParsedResults(appConfig: AppProjectConfigInternal): void {
        const projectRoot = path.resolve(AngularBuildContext.workspaceRoot, appConfig.root || '');

        // output hashing
        if (typeof (appConfig.outputHashing as any) === 'string') {
            const outputHashing = <string>(appConfig.outputHashing as any);
            if (outputHashing === 'all') {
                const objConfig = {
                    bundles: true,
                    chunks: true,
                    extractedAssets: true
                };

                appConfig.outputHashing = objConfig;
                appConfig._outputHashing = objConfig;
            } else if (outputHashing === 'bundles') {
                const objConfig = {
                    bundles: true,
                    chunks: true
                };

                appConfig.outputHashing = objConfig;
                appConfig._outputHashing = objConfig;
            } else if (outputHashing === 'media') {
                const objConfig = {
                    extractedAssets: true
                };

                appConfig.outputHashing = objConfig;
                appConfig._outputHashing = objConfig;
            } else if (outputHashing === 'none') {
                const objConfig = {
                    bundles: false,
                    chunks: false,
                    extractedAssets: false
                };

                appConfig.outputHashing = objConfig;
                appConfig._outputHashing = objConfig;
            }
        }

        if (typeof appConfig.outputHashing === 'undefined') {
            if (!appConfig.platformTarget || appConfig.platformTarget === 'web') {
                if (this.hasAspAppendVersion(appConfig)) {
                    const objConfig = {
                        bundles: false,
                        chunks: false,
                        extractedAssets: appConfig.optimization || this.buildOptions.environment.prod ? true : false
                    };

                    appConfig.outputHashing = objConfig;
                    appConfig._outputHashing = objConfig;
                } else {
                    const shouldHash = appConfig.optimization || this.buildOptions.environment.prod ? true : false;
                    const objConfig = {
                        bundles: shouldHash,
                        chunks: shouldHash,
                        extractedAssets: shouldHash
                    };

                    appConfig.outputHashing = objConfig;
                    appConfig._outputHashing = objConfig;
                }
            }
        }

        if (appConfig.dlls && (appConfig._isDll || appConfig.referenceDll)) {
            appConfig._dllParsedResult = AngularBuildContext.parseDllEntries(projectRoot, appConfig.dlls);
        }

        if (!appConfig._isDll && appConfig.polyfills && appConfig.polyfills.length > 0) {
            const polyfills = Array.isArray(appConfig.polyfills) ? appConfig.polyfills : [appConfig.polyfills];
            appConfig._polyfillParsedResult = AngularBuildContext.parseDllEntries(projectRoot, polyfills);
        }

        if (!appConfig._isDll && appConfig.styles && Array.isArray(appConfig.styles) && appConfig.styles.length > 0) {
            appConfig._styleParsedEntries =
                AngularBuildContext.parseGlobalEntries(appConfig.styles, projectRoot, 'styles');
        }

        if (!appConfig._isDll &&
            appConfig.scripts &&
            Array.isArray(appConfig.scripts) &&
            appConfig.scripts.length > 0) {
            appConfig._scriptParsedEntries =
                AngularBuildContext.parseGlobalEntries(appConfig.scripts, projectRoot, 'scripts');
        }
    }

    // libs
    private initLibTsConfigs(libConfig: LibProjectConfigInternal): void {
        const projectRoot = path.resolve(AngularBuildContext.workspaceRoot, libConfig.root || '');

        if (libConfig.tsTranspilation) {
            const tsTranspilation = libConfig.tsTranspilation as TsTranspilationOptionsInternal;
            tsTranspilation._tsConfigPath = path.resolve(projectRoot, tsTranspilation.tsConfig);

            const jsonConfigFile = ts.readConfigFile(tsTranspilation._tsConfigPath, ts.sys.readFile);
            if (jsonConfigFile.error && jsonConfigFile.error.length) {
                const formattedMsg = AngularBuildContext.formatDiagnostics(jsonConfigFile.error);
                if (formattedMsg) {
                    throw new InvalidConfigError(formattedMsg);
                }
            }

            // _tsConfigJson
            tsTranspilation._tsConfigJson = jsonConfigFile.config;

            // _tsCompilerConfig
            tsTranspilation._tsCompilerConfig = ts.parseJsonConfigFileContent(tsTranspilation._tsConfigJson,
                ts.sys,
                path.dirname(tsTranspilation._tsConfigPath),
                undefined,
                tsTranspilation._tsConfigPath);
            const compilerOptions = tsTranspilation._tsCompilerConfig.options;

            // _tsOutDir
            let tsOutputPath: string | undefined;
            if (!compilerOptions.outDir) {
                if (libConfig.outputPath) {
                    const outputPath = path.resolve(AngularBuildContext.workspaceRoot, libConfig.outputPath);
                    tsOutputPath = outputPath;
                }
            } else {
                tsOutputPath = path.isAbsolute(compilerOptions.outDir)
                    ? path.resolve(compilerOptions.outDir)
                    : path.resolve(path.dirname(tsTranspilation._tsConfigPath), compilerOptions.outDir);
            }

            if (tsOutputPath != null && compilerOptions.rootDir &&
                !isSamePaths(compilerOptions.rootDir, path.dirname(tsTranspilation._tsConfigPath)) &&
                isInFolder(compilerOptions.rootDir, path.dirname(tsTranspilation._tsConfigPath))) {
                const relSubDir = normalizeRelativePath(
                    path.relative(
                        compilerOptions.rootDir,
                        path.dirname(tsTranspilation._tsConfigPath)));
                tsOutputPath = path.resolve(tsOutputPath, relSubDir);
            }
            if (tsOutputPath) {
                tsTranspilation._tsOutDir = tsOutputPath;
            }

            // _angularCompilerOptions
            tsTranspilation._angularCompilerOptions = tsTranspilation._tsConfigJson.angularCompilerOptions;
        }
    }

    private initLibParsedResults(libConfig: LibProjectConfigInternal): void {
        const projectRoot = path.resolve(AngularBuildContext.workspaceRoot, libConfig.root || '');

        if (libConfig.styles && Array.isArray(libConfig.styles) && libConfig.styles.length > 0) {
            libConfig._styleParsedEntries =
                AngularBuildContext.parseGlobalEntries(libConfig.styles, projectRoot, 'styles');
        }
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

    private static formatDiagnostics(diagnostic: ts.Diagnostic | ts.Diagnostic[]): string {
        if (!diagnostic) {
            return '';
        }

        const diags = Array.isArray(diagnostic) ? diagnostic : [diagnostic];
        if (!diags || !diags.length || !diags[0].length) {
            return '';
        }

        return diags
            .map((d) => {
                let res = ts.DiagnosticCategory[d.category];
                if (d.file) {
                    res += ` at ${d.file.fileName}:`;
                    const { line, character } = d.file.getLineAndCharacterOfPosition(d.start as number);
                    res += (line + 1) + ':' + (character + 1) + ':';
                }
                res += ` ${ts.flattenDiagnosticMessageText(d.messageText, '\n')}`;
                return res;
            })
            .join('\n');
    }

    private static parseDllEntries(srcDir: string,
        inputs: string | DllOptions | string[], checkFileExists?: boolean): DllParsedResult {
        const result: DllParsedResult = {
            tsEntries: [],
            scriptEntries: [],
            styleEntries: []
        };

        if (!inputs ||
            (Array.isArray(inputs) && !inputs.length) ||
            (typeof inputs === 'object' && !Object.keys(inputs).length)) {
            return result;
        }

        const dllEntries: string[] = [];
        const packageJsonEntries: string[] = [];
        const excludes: string[] = [];
        if (Array.isArray(inputs)) {
            (inputs as string[]).forEach(e => {
                if (/(\/|\\)?package\.json$/i.test(e)) {
                    if (!packageJsonEntries.includes(e)) {
                        packageJsonEntries.push(e);
                    }
                } else {
                    if (!dllEntries.includes(e)) {
                        dllEntries.push(e);
                    }
                }
            });
        } else if (typeof inputs === 'string') {
            const e = inputs as string;
            if (/(\/|\\)?package\.json$/i.test(e)) {
                if (e && e.length && !packageJsonEntries.includes(e)) {
                    packageJsonEntries.push(e);
                }
            } else {
                if (e && e.length && !dllEntries.includes(e)) {
                    dllEntries.push(e);
                }
            }
        } else if (typeof inputs === 'object') {
            const dllOptions = inputs as DllOptions;
            if (dllOptions.exclude) {
                dllOptions.exclude.forEach(e => {
                    if (e && e.length && !excludes.includes(e)) {
                        excludes.push(e);
                    }
                });
            }
            if (dllOptions.entry && dllOptions.entry.length) {
                if (Array.isArray(dllOptions.entry)) {
                    (dllOptions.entry as string[]).forEach(e => {
                        if (/(\/|\\)?package\.json$/i.test(e)) {
                            if (e && e.length && !packageJsonEntries.includes(e)) {
                                packageJsonEntries.push(e);
                            }
                        } else {
                            if (e && e.length && !dllEntries.includes(e) && !excludes.includes(e)) {
                                dllEntries.push(e);
                            }
                        }
                    });
                } else if (typeof dllOptions.entry === 'string') {
                    const e = dllOptions.entry as string;
                    if (/(\/|\\)?package\.json$/i.test(e)) {
                        if (e && e.length && !packageJsonEntries.includes(e)) {
                            packageJsonEntries.push(e);
                        }
                    } else {
                        if (e && e.length && !dllEntries.includes(e) && !excludes.includes(e)) {
                            dllEntries.push(e);
                        }
                    }
                }
            }
        }

        if (!dllEntries.length && !packageJsonEntries.length) {
            return result;
        }

        dllEntries
            .forEach((e: string) => {
                const dllPathInSrcDir = path.resolve(srcDir, e);
                if (checkFileExists && !existsSync(dllPathInSrcDir)) {
                    throw new InvalidConfigError(`Couldn't resolve dll entry, path: ${dllPathInSrcDir}.`);
                }

                if (e.match(/\.ts$/i) &&
                    existsSync(dllPathInSrcDir) &&
                    statSync(dllPathInSrcDir).isFile()) {
                    if (!result.tsEntries.includes(dllPathInSrcDir)) {
                        result.tsEntries.push(dllPathInSrcDir);
                    }
                } else {
                    if (e.match(/\.(css|sass|scss|less|styl)$/i)) {
                        if (!result.styleEntries.includes(e)) {
                            result.styleEntries.push(e);
                        }
                    } else {
                        if (!result.scriptEntries.includes(e)) {
                            result.scriptEntries.push(e);
                        }
                    }
                }
            });
        packageJsonEntries
            .forEach((e: string) => {
                const packagePath = path.resolve(srcDir, e);
                if (existsSync(packagePath) && statSync(packagePath).isFile()) {
                    const pkgConfig: any = readJsonSync(packagePath);
                    const deps: any = pkgConfig.dependencies || {};
                    const packageEntries: string[] = [];
                    Object.keys(deps)
                        .filter((key: string) => !excludes.includes(key) &&
                            !key.startsWith('@types/') &&
                            !dllEntries.includes(key) &&
                            !packageEntries.includes(key))
                        .forEach((key: string) => {
                            packageEntries.push(key);
                        });
                    if (packageEntries.length > 0) {
                        packageEntries.forEach((name: string) => {
                            if (!result.scriptEntries.includes(name)) {
                                result.scriptEntries.push(name);
                            }
                        });
                    }
                } else {
                    throw new InvalidConfigError(`Error in parsing dll entry, path doesn't exists, path: ${packagePath}.`);
                }
            });

        return result;
    }

    private static parseGlobalEntries(extraEntries: string | (string | GlobalEntry)[],
        baseDir: string, defaultEntry: string): GlobalParsedEntry[] {
        if (!extraEntries || !extraEntries.length) {
            return [];
        }

        const entries = Array.isArray(extraEntries) ? extraEntries : [extraEntries];
        const clonedEntries = entries.map((entry: any) =>
            typeof entry === 'object' ? Object.assign({}, entry) : entry
        );

        return clonedEntries
            .map((extraEntry: string | GlobalEntry) =>
                typeof extraEntry === 'object' ? extraEntry : { input: extraEntry })
            .map((extraEntry: GlobalEntry) => {
                const parsedEntry: GlobalParsedEntry = {
                    paths: [],
                    entry: '',
                    lazy: extraEntry.lazy
                };

                const inputs = Array.isArray(extraEntry.input) ? extraEntry.input : [extraEntry.input];
                parsedEntry.paths = inputs.map(input => path.resolve(baseDir, input));

                if (extraEntry.bundleName) {
                    if (/(\\|\/)$/.test(extraEntry.bundleName) &&
                        !Array.isArray(extraEntry.input) &&
                        typeof extraEntry.input === 'string') {
                        parsedEntry.entry = extraEntry.bundleName +
                            path.basename(extraEntry.input as string).replace(/\.(ts|js|less|sass|scss|styl|css)$/i, '');
                    } else {
                        parsedEntry.entry = extraEntry.bundleName.replace(/\.(js|css)$/i, '');
                    }
                } else if (extraEntry.lazy && !Array.isArray(extraEntry.input) &&
                    typeof extraEntry.input === 'string') {
                    parsedEntry.entry = path.basename(extraEntry.input as string)
                        .replace(/\.(js|ts|css|scss|sass|less|styl)$/i, '');
                } else {
                    parsedEntry.entry = defaultEntry;
                }

                return parsedEntry;
            });
    }

    private validateProjectConfig(): void {
        const workspaceRoot = AngularBuildContext.workspaceRoot;
        const projectConfig = this.projectConfig;

        if (!projectConfig.outputPath) {
            throw new InvalidConfigError(
                `The 'projects[${projectConfig.name || projectConfig._index}].outputPath' is required.`);
        }

        if (projectConfig.root && path.isAbsolute(projectConfig.root)) {
            throw new InvalidConfigError(
                `The 'projects[${projectConfig.name || projectConfig._index}].root' must be relative path.`);
        }

        if (projectConfig.outputPath && path.isAbsolute(projectConfig.outputPath)) {
            throw new InvalidConfigError(
                `The 'projects[${projectConfig.name || projectConfig._index}].outputPath' must be relative path.`);
        }

        const projectRoot = path.resolve(workspaceRoot, projectConfig.root || '');

        if (projectConfig.outputPath) {
            const outputPath = path.resolve(workspaceRoot, projectConfig.outputPath);

            if (isSamePaths(workspaceRoot, outputPath)) {
                throw new InvalidConfigError(
                    `The 'projects[${projectConfig.name || projectConfig._index
                    }].outputPath' must not be the same as workspace root directory.`);
            }
            if (isSamePaths(projectRoot, outputPath) || outputPath === '.') {
                throw new InvalidConfigError(
                    `The 'projects[${projectConfig.name || projectConfig._index
                    }].outputPath' must not be the same as project root directory.`);
            }
            if (outputPath === path.parse(outputPath).root) {
                throw new InvalidConfigError(
                    `The 'projects[${projectConfig.name || projectConfig._index
                    }].outputPath' must not be the same as system root directory.`);
            }

            const srcDirHomeRoot = path.parse(projectRoot).root;
            if (outputPath === srcDirHomeRoot) {
                throw new InvalidConfigError(
                    `The 'projects[${projectConfig.name || projectConfig._index
                    }].outputPath' must not be the same as system root directory.`);
            }
            if (isInFolder(outputPath, workspaceRoot)) {
                throw new InvalidConfigError(
                    `The workspace folder must not be inside 'projects[${projectConfig.name || projectConfig._index
                    }].outputPath' directory.`);
            }
            if (isInFolder(outputPath, projectRoot)) {
                throw new InvalidConfigError(
                    `The project root folder must not be inside 'projects[${projectConfig.name || projectConfig._index
                    }].outputPath' directory.`);
            }
        }

        if (this.projectConfig._projectType === 'app') {
            const appConfig = this.projectConfig as AppProjectConfigInternal;

            if (appConfig.buildOptimizer && !appConfig.aot) {
                throw new InvalidOptionError('The `buildOptimizer` option cannot be used without `aot`.');
            }
        }
    }

    private hasAspAppendVersion(appConfig: AppProjectConfigInternal): boolean {
        if (appConfig.htmlInject && (appConfig.htmlInject.customAttributes ||
            appConfig.htmlInject.customLinkAttributes ||
            appConfig.htmlInject.customLinkAttributes)) {
            let customAttributes = Object.assign({}, appConfig.htmlInject.customAttributes || {});
            customAttributes = Object.assign({}, customAttributes, appConfig.htmlInject.customLinkAttributes || {});
            customAttributes = Object.assign({}, customAttributes, appConfig.htmlInject.customLinkAttributes || {});
            if (customAttributes['asp-append-version']) {
                return true;
            }
        }
        return false;
    }
}
