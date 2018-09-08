import { existsSync, readFileSync } from 'fs';
import * as path from 'path';

import { virtualFs } from '@angular-devkit/core';
import * as ts from 'typescript';

import {
  AngularBuildConfig,
  AppProjectConfig,
  AppProjectConfigBase,
  BuildOptions,
  GlobalEntry,
  LibBundleOptions,
  LibProjectConfig,
  LibProjectConfigBase,
  ProjectConfig,
  ProjectConfigBase,
  TsTranspilationOptions,
} from '../interfaces';

import { InternalError, InvalidConfigError, InvalidOptionError } from '../error-models';

import {
  findUpSync,
  formatTsDiagnostics,
  isInFolder,
  isSamePaths,
  Logger, LogLevelSring,
  normalizeRelativePath,
  readJsonSync
} from '../utils';

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

export interface TsTranspilationOptionsInternal extends TsTranspilationOptions {
  _index: number;
  _tsConfigPath: string;
  _tsConfigJson: any;
  _tsCompilerConfig: ts.ParsedCommandLine;
  _declaration: boolean;
  _scriptTarget: ts.ScriptTarget;
  _tsOutDirRootResolved: string;

  _angularCompilerOptions?: any;
  _detectedEntryName?: string;
  _typingsOutDir?: string;
  _customTsOutDir?: string;
}

export interface LibBundleOptionsInternal extends LibBundleOptions {
  _index: number;
  _entryFilePath: string;
  _outputFilePath: string;

  _tsConfigPath?: string;
  _tsConfigJson?: any;
  _tsCompilerConfig?: ts.ParsedCommandLine;

  _sourceScriptTarget?: ts.ScriptTarget;
  _destScriptTarget?: ts.ScriptTarget;
  _ecmaVersion?: number;
  _supportES2015?: boolean;

  _nodeResolveFields?: string[];
}

export interface PackageEntryPoints {
  main?: string;
  module?: string;
  es2015?: string;
  esm5?: string;
  esm2015?: string;
  fesm2015?: string;
  fesm5?: string;
  typings?: string;
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
  _packageNameWithoutScope?: string;

  _projectVersion?: string;
  _projectDescription?: string;
  _projectAuthor?: string;
  _projectHomePage?: string;
  _packageScope?: string;

  _isPackagePrivate?: boolean;
  _isNestedPackage?: boolean;

  _tsConfigPath?: string;
  _tsConfigJson?: any;
  _tsCompilerConfig?: ts.ParsedCommandLine;
  _angularCompilerOptions?: any;
}

export interface AppProjectConfigInternal extends AppProjectConfig, ProjectConfigInternal<AppProjectConfigBase> {
  _outputHashing?: {
    bundles?: boolean;
    chunks?: boolean;
    extractedAssets?: boolean;
  };

  _ecmaVersion?: number;
  _supportES2015?: boolean;
  _nodeResolveFields?: string[];

  _isDll?: boolean;
  _dllParsedResult?: DllParsedResult;
  _polyfillParsedResult?: DllParsedResult;
  _scriptParsedEntries?: GlobalParsedEntry[];
  _styleParsedEntries?: GlobalParsedEntry[];
}

export interface LibProjectConfigInternal extends LibProjectConfig, ProjectConfigInternal<LibProjectConfigBase> {
  _styleParsedEntries?: GlobalParsedEntry[];

  _tsTranspilations?: TsTranspilationOptionsInternal[];
  _bundles?: LibBundleOptionsInternal[];

  _packageJsonOutDir?: string;
  _packageEntryPoints?: PackageEntryPoints;
}

export interface BuildContextInstanceOptions<TConfig extends AppProjectConfigInternal | LibProjectConfigInternal> {
  projectConfigWithoutEnvApplied: TConfig;
  projectConfig: TConfig;
  buildOptions: BuildOptionInternal;
  host: virtualFs.Host;
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
    const disabled =
      process.argv.includes('--disable-telemetry') || process.env.ANGULAR_BUILD_TELEMETRY_OPTOUT ? true : false;

    return disabled;
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

  get iconsStatCacheDirectory(): string {
    if (this._iconsStatCachePath) {
      return this._iconsStatCachePath;
    }

    const cacheDir = path.resolve(AngularBuildContext.workspaceRoot,
      this.projectConfig.outputPath || this.projectConfig.root || '',
      './.icons-cache/');
    this._iconsStatCachePath = cacheDir;

    return this._iconsStatCachePath;
  }

  private static _initialized = false;
  private static _appCount = 0;
  private static _libCount = 0;
  private static _startTime = Date.now();
  private static _angularVersion: string | undefined | null = undefined;
  private static _typescriptVersion: string | undefined | null = undefined;
  private static _webpackVersion: string | undefined | null = undefined;
  private static _rollupVersion: string | undefined | null = undefined;
  private static _cliVersion: string | undefined | null = undefined;
  private static _nodeModulesPath: string | undefined | null = undefined;
  private static _workspaceRoot: string;
  private static _cliIsGlobal: boolean | undefined = undefined;
  private static _cliRootPath: string | undefined = undefined;
  private static _fromAngularBuildCli: boolean | undefined;
  private static _logger: Logger | null = null;
  private static _angularBuildConfig: AngularBuildConfigInternal | null | undefined = null;

  private readonly _buildOptions: BuildOptionInternal;

  private _buildOptimizerCachePath: string | undefined = undefined;
  private _rptCachePath: string | undefined = undefined;
  private _iconsStatCachePath: string | undefined = undefined;

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

    this.host = options.host;
    this.aliasHost = new virtualFs.AliasHost(options.host as virtualFs.Host<any>);
    this._buildOptions = options.buildOptions;
    this.projectConfigWithoutEnvApplied = options.projectConfigWithoutEnvApplied;
    this.projectConfig = options.projectConfig;

    if (this.projectConfig.root && path.isAbsolute(this.projectConfig.root)) {
      throw new InvalidConfigError(
        `The 'projects[${this.projectConfig.name || this.projectConfig._index}].root' must be relative path.`);
    }

    // read package.json files
    this.initPackageJsons();

    // replace tokens
    if (this.projectConfig.outputPath) {
      this.projectConfig.outputPath = this.replaceOutputTokens(this.projectConfig.outputPath, true);
    }

    // validation
    this.validateOutputPath();

    // init banner
    this.initBannerText();

    if (this.projectConfig._projectType === 'lib') {
      AngularBuildContext._libCount = AngularBuildContext._libCount + 1;
      this.initLibConfig(this.projectConfig as LibProjectConfigInternal);
    } else {
      AngularBuildContext._appCount = AngularBuildContext._appCount + 1;
      this.initAppConfig(this.projectConfig as AppProjectConfigInternal);
    }
  }

  private validateOutputPath(): void {
    const workspaceRoot = AngularBuildContext.workspaceRoot;
    const projectConfig = this.projectConfig;

    if (!projectConfig.outputPath) {
      throw new InvalidConfigError(
        `The 'projects[${projectConfig.name || projectConfig._index}].outputPath' is required.`);
    }

    if (path.isAbsolute(projectConfig.outputPath)) {
      throw new InvalidConfigError(
        `The 'projects[${projectConfig.name || projectConfig._index}].outputPath' must be relative path.`);
    }

    const projectRoot = path.resolve(workspaceRoot, projectConfig.root || '');

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

  private replaceOutputTokens(input: string, forFileName: boolean): string {
    let str = input.replace(/[\$|\[]CURRENT[_\-]?YEAR[\$|\]]/gim, (new Date()).getFullYear().toString());

    if (this.projectConfig._projectName) {
      let name = this.projectConfig._projectName;
      if (forFileName) {
        name = name.replace(/@/gm, '').replace(/\//gm, '-');
      }

      str = str
        .replace(/[\$|\[](APP|APPLICATION|PROJECT|PACKAGE)[_\-]?NAME[\$|\]]/gim,
          name);
    }

    if (this.projectConfig._packageNameWithoutScope) {
      let name = this.projectConfig._packageNameWithoutScope;
      if (forFileName) {
        name = name.replace(/@/gm, '').replace(/\//gm, '-');
      }

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
      tempBannerText = this.replaceOutputTokens(tempBannerText, false);
      this.projectConfig._bannerText = tempBannerText;
    }
  }

  private parseScriptAndStyleEntries(extraEntries: string | (string | GlobalEntry)[], defaultEntry: string):
    GlobalParsedEntry[] {
    if (!extraEntries || !extraEntries.length) {
      return [];
    }

    const projectRoot = path.resolve(AngularBuildContext.workspaceRoot, this.projectConfig.root || '');
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
        parsedEntry.paths = [];
        inputs.forEach(input => {
          let resolvedPath = path.resolve(projectRoot, input);

          if (AngularBuildContext.nodeModulesPath &&
            !existsSync(resolvedPath) &&
            input.startsWith('~node_modules') &&
            existsSync(path.resolve(AngularBuildContext.workspaceRoot, input.substr(1)))) {
            resolvedPath = path.resolve(AngularBuildContext.workspaceRoot, input.substr(1));
          } else if (AngularBuildContext.nodeModulesPath &&
            !existsSync(resolvedPath) &&
            input.startsWith('~') &&
            existsSync(path.resolve(AngularBuildContext.nodeModulesPath, input.substr(1)))) {
            resolvedPath = path.resolve(AngularBuildContext.nodeModulesPath, input.substr(1));
          } else if (!existsSync(resolvedPath) &&
            input.startsWith('~') &&
            existsSync(path.resolve(AngularBuildContext.workspaceRoot, input.substr(1)))) {
            resolvedPath = path.resolve(AngularBuildContext.workspaceRoot, input.substr(1));
          }

          parsedEntry.paths.push(resolvedPath);
        });

        if (extraEntry.bundleName) {
          extraEntry.bundleName = this.replaceOutputTokens(extraEntry.bundleName, true);

          if (/(\\|\/)$/.test(extraEntry.bundleName) &&
            !Array.isArray(extraEntry.input) &&
            typeof extraEntry.input === 'string') {
            parsedEntry.entry = extraEntry.bundleName +
              path.basename(extraEntry.input as string)
                .replace(/\.(ts|js|less|sass|scss|styl|css)$/i, '');
          } else {
            parsedEntry.entry = extraEntry.bundleName.replace(/\.(js|css)$/i, '');
          }
        } else if (extraEntry.lazy &&
          !Array.isArray(extraEntry.input) &&
          typeof extraEntry.input === 'string') {
          parsedEntry.entry = path.basename(extraEntry.input as string)
            .replace(/\.(js|ts|css|scss|sass|less|styl)$/i, '');
        } else {
          parsedEntry.entry = defaultEntry;
        }

        return parsedEntry;
      });
  }

  private getnodeResolveFieldsFromScriptTarget(scriptTarget: ts.ScriptTarget | undefined): string[] {
    const nodeResolveFields: string[] = [];

    if (scriptTarget === ts.ScriptTarget.ES2018) {
      nodeResolveFields.push('es2018');
      nodeResolveFields.push('es2017');
      nodeResolveFields.push('es2016');
      nodeResolveFields.push('es2015');
      nodeResolveFields.push('esm2015');
      nodeResolveFields.push('fesm2015');
    } else if (scriptTarget === ts.ScriptTarget.ES2017) {
      nodeResolveFields.push('es2017');
      nodeResolveFields.push('es2016');
      nodeResolveFields.push('es2015');
      nodeResolveFields.push('esm2015');
      nodeResolveFields.push('fesm2015');
    } else if (scriptTarget === ts.ScriptTarget.ES2016) {
      nodeResolveFields.push('es2016');
      nodeResolveFields.push('es2015');
      nodeResolveFields.push('esm2015');
      nodeResolveFields.push('fesm2015');
    } else if (scriptTarget !== ts.ScriptTarget.ES3 &&
      scriptTarget !== ts.ScriptTarget.ES5) {
      nodeResolveFields.push('es2015');
      nodeResolveFields.push('esm2015');
      nodeResolveFields.push('fesm2015');
    }

    return nodeResolveFields;
  }

  private getEcmaVersionFromScriptTarget(scriptTarget: ts.ScriptTarget | undefined): number | undefined {
    if (scriptTarget === ts.ScriptTarget.ES2017) {
      return 8;
    } else if (scriptTarget === ts.ScriptTarget.ES2016) {
      return 7;
    } else if (scriptTarget === ts.ScriptTarget.ES2015) {
      return 6;
    } else if (scriptTarget === ts.ScriptTarget.ES5) {
      return 5;
    } else if (scriptTarget === ts.ScriptTarget.ES3) {
      return 4;
    }

    return undefined;
  }

  private toTsScriptTarget(target: string): ts.ScriptTarget | undefined {
    switch (target) {
      case 'ES3':
      case 'es3':
        return ts.ScriptTarget.ES3;
      case 'ES5':
      case 'es5':
        return ts.ScriptTarget.ES5;
      case 'ES2015':
      case 'es2015':
        return ts.ScriptTarget.ES2015;
      case 'ES2016':
      case 'es2016':
        return ts.ScriptTarget.ES2016;
      case 'ES2017':
      case 'es2017':
        return ts.ScriptTarget.ES2017;
      case 'ES2018':
      case 'es2018':
        return ts.ScriptTarget.ES2018;
      case 'ESNext':
      case 'esnext':
        return ts.ScriptTarget.ESNext;
      case 'Latest':
      case 'latest':
        return ts.ScriptTarget.Latest;
      default:
        return undefined;
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

  private readTsConfig(tsConfigPath: string,
    config: {
      _tsConfigPath?: string;
      _tsConfigJson?: any;
      _tsCompilerConfig?: ts.ParsedCommandLine;
      _angularCompilerOptions?: any;
    },
    projectConfig: AppProjectConfigInternal | LibProjectConfigInternal): void {
    config._tsConfigPath = tsConfigPath;
    if (!config._tsConfigJson || !config._tsCompilerConfig) {
      if (projectConfig.tsConfig && projectConfig._tsConfigPath && tsConfigPath === projectConfig._tsConfigPath) {
        config._tsConfigJson = projectConfig._tsConfigJson;
        config._tsCompilerConfig = projectConfig._tsCompilerConfig;
        config._angularCompilerOptions = projectConfig._angularCompilerOptions;
      } else {
        const jsonConfigFile = ts.readConfigFile(tsConfigPath, ts.sys.readFile);
        if (jsonConfigFile.error && jsonConfigFile.error.length) {
          const formattedMsg = formatTsDiagnostics(jsonConfigFile.error);
          if (formattedMsg) {
            throw new InvalidConfigError(formattedMsg);
          }
        }

        // _tsConfigJson
        config._tsConfigJson = jsonConfigFile.config;

        // _tsCompilerConfig
        config._tsCompilerConfig = ts.parseJsonConfigFileContent(
          config._tsConfigJson,
          ts.sys,
          path.dirname(tsConfigPath),
          undefined,
          tsConfigPath);

        // _angularCompilerOptions
        config._angularCompilerOptions =
          config._tsConfigJson.angularCompilerOptions;
      }
    }
  }

  private checkPathUp(regex: RegExp, currentDir: string, rootPath: string): boolean {
    do {
      if (regex.test(currentDir)) {
        return true;
      }

      currentDir = path.dirname(currentDir);
      if (!currentDir || path.parse(currentDir).root === currentDir) {
        break;
      }

    } while (currentDir && isInFolder(rootPath, currentDir));

    return false;
  }

  // libs
  private initLibConfig(libConfig: LibProjectConfigInternal): void {
    if (!libConfig.outputPath) {
      throw new InvalidConfigError(
        `The 'projects[${libConfig.name || libConfig._index}].outputPath' value is required.`);
    }

    const projectRoot = path.resolve(AngularBuildContext.workspaceRoot, libConfig.root || '');
    const outputPath = path.resolve(AngularBuildContext.workspaceRoot, libConfig.outputPath);

    // package.json
    if (libConfig.packageJsonOutDir) {
      libConfig._packageJsonOutDir = this.replaceOutputTokens(libConfig.packageJsonOutDir, true);
      libConfig._packageJsonOutDir = path.resolve(outputPath, libConfig._packageJsonOutDir);
    } else if (outputPath) {
      if (libConfig._isNestedPackage) {
        const nestedPath =
          libConfig._packageNameWithoutScope!.substr(libConfig._packageNameWithoutScope!.indexOf('/') + 1);

        libConfig._packageJsonOutDir = path.resolve(outputPath, nestedPath);
      } else {
        libConfig._packageJsonOutDir = outputPath;
      }
    }

    // tsConfig
    if (libConfig.tsConfig) {
      const tsConfigPath = path.resolve(projectRoot, libConfig.tsConfig);
      this.readTsConfig(tsConfigPath, libConfig, libConfig);
    }

    // tsTranspilations
    const tsTranspilationInternals: TsTranspilationOptionsInternal[] = [];
    if (libConfig.tsTranspilations && Array.isArray(libConfig.tsTranspilations)) {
      const tsTranspilations = libConfig.tsTranspilations;
      for (let i = 0; i < tsTranspilations.length; i++) {
        const tsTranspilationPartial = tsTranspilations[i] as Partial<TsTranspilationOptionsInternal>;
        let tsConfigPath = '';
        if (tsTranspilationPartial.tsConfig) {
          tsConfigPath = path.resolve(projectRoot, tsTranspilationPartial.tsConfig);
        } else {
          if (libConfig.tsConfig && libConfig._tsConfigPath) {
            tsConfigPath = libConfig._tsConfigPath;
          } else if (i > 0 && tsTranspilationInternals[i - 1]._tsConfigPath) {
            tsConfigPath = tsTranspilationInternals[i - 1]._tsConfigPath as string;
          } else if (i === 0) {
            const foundTsConfigPath = this.detectTsConfigPathForLib(projectRoot);
            if (foundTsConfigPath) {
              tsConfigPath = foundTsConfigPath;
            }
          }
        }

        if (!tsConfigPath) {
          throw new InvalidConfigError(
            `The 'projects[${libConfig.name || libConfig._index}].ngcTranspilations[${i
            }].tsConfig' value is required.`);
        }

        if (i > 0 && tsConfigPath === tsTranspilationInternals[i - 1]._tsConfigPath) {
          tsTranspilationPartial._tsConfigPath = tsTranspilationInternals[i - 1]._tsConfigPath;
          tsTranspilationPartial._tsConfigJson = tsTranspilationInternals[i - 1]._tsConfigJson;
          tsTranspilationPartial._tsCompilerConfig = tsTranspilationInternals[i - 1]._tsCompilerConfig;
          tsTranspilationPartial._angularCompilerOptions =
            tsTranspilationInternals[i - 1]._angularCompilerOptions;
        }

        const tsTranspilation =
          this.initTsTranspilationOptionsInternal(tsConfigPath, tsTranspilationPartial, 1, libConfig);
        tsTranspilationInternals.push(tsTranspilation);
      }
    } else if (libConfig.tsTranspilations) {
      const tsConfigPath = libConfig.tsConfig && libConfig._tsConfigPath
        ? libConfig._tsConfigPath
        : this.detectTsConfigPathForLib(projectRoot);

      if (!tsConfigPath) {
        throw new InvalidConfigError(
          `Could not detect tsconfig file for 'projects[${libConfig.name || libConfig._index}].`);
      }

      const esm2015TranspilationPartial: Partial<TsTranspilationOptionsInternal> = {
        target: 'es2015',
        outDir: 'esm2015',
        moveTypingFilesToPackageRoot: true
      };
      const esm2015Transpilation =
        this.initTsTranspilationOptionsInternal(tsConfigPath, esm2015TranspilationPartial, 0, libConfig);
      tsTranspilationInternals.push(esm2015Transpilation);

      const esm5TranspilationPartial: Partial<TsTranspilationOptionsInternal> = {
        target: 'es5',
        outDir: 'esm5',
        declaration: false,
        moveTypingFilesToPackageRoot: false,
        reExportTypingEntryToOutputRoot: false
      };
      const esm5Transpilation =
        this.initTsTranspilationOptionsInternal(tsConfigPath, esm5TranspilationPartial, 1, libConfig);
      tsTranspilationInternals.push(esm5Transpilation);
    }
    libConfig._tsTranspilations = tsTranspilationInternals;

    // bundles
    const bundleInternals: LibBundleOptionsInternal[] = [];
    if (libConfig.bundles && Array.isArray(libConfig.bundles)) {
      const bundles = libConfig.bundles;
      for (let i = 0; i < bundles.length; i++) {
        const bundlePartial = bundles[i] as Partial<LibBundleOptionsInternal>;
        bundleInternals.push(this.initLibBundleTargetInternal(bundleInternals, bundlePartial, i, libConfig));
      }
    } else if (libConfig.bundles) {
      let shouldBundlesDefault = libConfig.tsTranspilations === 'auto';
      if (!shouldBundlesDefault &&
        libConfig._tsTranspilations.length >= 2 &&
        libConfig._tsTranspilations[0].target === 'es2015' &&
        libConfig._tsTranspilations[1].target === 'es5') {
        shouldBundlesDefault = true;
      }

      if (shouldBundlesDefault) {
        const es2015BundlePartial: Partial<LibBundleOptionsInternal> = {
          libraryTarget: 'es',
          entryRoot: 'tsTranspilationOutDir',
          tsTranspilationIndex: 0
        };

        const es2015BundleInternal =
          this.initLibBundleTargetInternal(bundleInternals, es2015BundlePartial, 0, libConfig);
        bundleInternals.push(es2015BundleInternal);

        const es5BundlePartial: Partial<LibBundleOptionsInternal> = {
          libraryTarget: 'es',
          entryRoot: 'tsTranspilationOutDir',
          tsTranspilationIndex: 1
        };

        const es5BundleInternal =
          this.initLibBundleTargetInternal(bundleInternals, es5BundlePartial, 1, libConfig);
        bundleInternals.push(es5BundleInternal);

        const umdBundlePartial: Partial<LibBundleOptionsInternal> = {
          libraryTarget: 'umd',
          entryRoot: 'prevBundleOutDir'
        };
        const umdBundleInternal =
          this.initLibBundleTargetInternal(bundleInternals, umdBundlePartial, 2, libConfig);
        bundleInternals.push(umdBundleInternal);
      } else {
        throw new InvalidConfigError(
          `Counld not detect to bunlde automatically, please correct option in 'projects[${libConfig.name ||
          libConfig._index
          }].bundles'.`);
      }
    }
    libConfig._bundles = bundleInternals;

    // parsed result
    if (libConfig.styles && Array.isArray(libConfig.styles) && libConfig.styles.length > 0) {
      libConfig._styleParsedEntries =
        this.parseScriptAndStyleEntries(libConfig.styles, 'styles');
    }
  }

  private detectTsConfigPathForLib(projectRoot: string): string | null {
    return findUpSync([
      'tsconfig-build.json',
      'tsconfig.lib.json',
      'tsconfig.build.json',
      'tsconfig-lib.json',
      'tsconfig.json'
    ],
      projectRoot,
      AngularBuildContext.workspaceRoot);
  }

  private initTsTranspilationOptionsInternal(tsConfigPath: string,
    tsTranspilation: Partial<TsTranspilationOptionsInternal>,
    i: number,
    libConfig: LibProjectConfigInternal):
    TsTranspilationOptionsInternal {
    this.readTsConfig(tsConfigPath, tsTranspilation, libConfig);
    const compilerOptions = tsTranspilation._tsCompilerConfig!.options;

    // scriptTarget
    let scriptTarget: ts.ScriptTarget = ts.ScriptTarget.ES2015;
    if (tsTranspilation.target) {
      const tsScriptTarget = this.toTsScriptTarget(tsTranspilation.target as string);
      if (tsScriptTarget) {
        scriptTarget = tsScriptTarget;
      }
    } else if (compilerOptions.target) {
      scriptTarget = compilerOptions.target;
    }

    // declaration
    let declaration = true;
    if (tsTranspilation.declaration === false) {
      declaration = false;
    } else if (!tsTranspilation.declaration && !compilerOptions.declaration) {
      declaration = false;
    }

    // tsOutDir
    const outputRootDir = libConfig.outputPath
      ? path.resolve(AngularBuildContext.workspaceRoot, libConfig.outputPath)
      : null;
    let tsOutDir: string;
    if (tsTranspilation.outDir) {
      if (!outputRootDir) {
        throw new InvalidConfigError(
          `The 'projects[${libConfig.name || libConfig._index}].outputPath' value is required.`);
      }

      tsOutDir =
        path.resolve(outputRootDir, this.replaceOutputTokens(tsTranspilation.outDir, true));
      tsTranspilation._customTsOutDir = tsOutDir;
    } else {
      if (compilerOptions.outDir) {
        tsOutDir = path.isAbsolute(compilerOptions.outDir)
          ? path.resolve(compilerOptions.outDir)
          : path.resolve(path.dirname(tsConfigPath), compilerOptions.outDir);
      } else {
        if (!outputRootDir) {
          throw new InvalidConfigError(
            `The 'projects[${libConfig.name || libConfig._index}].outputPath' value is required.`);
        }

        tsOutDir = outputRootDir;
        tsTranspilation._customTsOutDir = tsOutDir;
      }
    }
    if (compilerOptions.rootDir &&
      !isSamePaths(compilerOptions.rootDir, path.dirname(tsConfigPath))) {
      const relSubDir = isInFolder(compilerOptions.rootDir, path.dirname(tsConfigPath))
        ? normalizeRelativePath(
          path.relative(compilerOptions.rootDir, path.dirname(tsConfigPath)))
        : normalizeRelativePath(path.relative(path.dirname(tsConfigPath), compilerOptions.rootDir));
      tsOutDir = path.resolve(tsOutDir, relSubDir);
    }

    // typingsOutDir
    if (tsTranspilation.moveTypingFilesToPackageRoot) {
      tsTranspilation._typingsOutDir = libConfig._packageJsonOutDir;
    } else {
      tsTranspilation._typingsOutDir = tsOutDir;
    }

    // detect entry
    if (libConfig.packageEntryFileForTsTranspilation) {
      tsTranspilation._detectedEntryName =
        libConfig.packageEntryFileForTsTranspilation.replace(/\.(js|ts)$/i, '');
    } else {
      const flatModuleOutFile =
        !tsTranspilation.useTsc &&
          tsTranspilation._angularCompilerOptions &&
          tsTranspilation._angularCompilerOptions.flatModuleOutFile
          ? tsTranspilation._angularCompilerOptions.flatModuleOutFile as string
          : null;

      if (flatModuleOutFile) {
        tsTranspilation._detectedEntryName = flatModuleOutFile.replace(/\.js$/i, '');
      } else {
        const tsSrcDir = path.dirname(tsConfigPath);
        if (existsSync(path.resolve(tsSrcDir, 'index.ts'))) {
          tsTranspilation._detectedEntryName = 'index';
        } else if (existsSync(path.resolve(tsSrcDir, 'main.ts'))) {
          tsTranspilation._detectedEntryName = 'main';
        }
      }
    }

    // package entry points
    if (libConfig._packageJsonOutDir && tsTranspilation._detectedEntryName) {
      libConfig._packageEntryPoints = libConfig._packageEntryPoints || {};
      const packageEntryPoints = libConfig._packageEntryPoints;
      const packageJsonOutDir = libConfig._packageJsonOutDir;

      const entryFileAbs =
        path.resolve(tsOutDir, `${tsTranspilation._detectedEntryName}.js`);

      if ((compilerOptions.module === ts.ModuleKind.ES2015 ||
        compilerOptions.module === ts.ModuleKind.ESNext) &&
        (tsTranspilation.target === 'es2015' ||
          (!tsTranspilation.target && compilerOptions.target === ts.ScriptTarget.ES2015))) {
        packageEntryPoints.es2015 = normalizeRelativePath(path.relative(packageJsonOutDir,
          entryFileAbs));
        packageEntryPoints.esm2015 = normalizeRelativePath(path.relative(packageJsonOutDir,
          entryFileAbs));
      } else if ((compilerOptions.module === ts.ModuleKind.ES2015 ||
        compilerOptions.module === ts.ModuleKind.ESNext) &&
        (tsTranspilation.target === 'es5' ||
          (!tsTranspilation.target && compilerOptions.target === ts.ScriptTarget.ES5))) {
        packageEntryPoints.esm5 = normalizeRelativePath(path.relative(packageJsonOutDir,
          entryFileAbs));
        packageEntryPoints.module = normalizeRelativePath(path.relative(packageJsonOutDir,
          entryFileAbs));
      } else if (compilerOptions.module === ts.ModuleKind.UMD ||
        compilerOptions.module === ts.ModuleKind.CommonJS) {
        packageEntryPoints.main = normalizeRelativePath(path.relative(packageJsonOutDir,
          entryFileAbs));
      }

      if (compilerOptions._declaration && tsTranspilation._typingsOutDir) {
        packageEntryPoints.typings = normalizeRelativePath(path.relative(packageJsonOutDir,
          path.join(tsTranspilation._typingsOutDir, `${tsTranspilation._detectedEntryName}.d.ts`)));
      }
    }

    return {
      ...tsTranspilation,
      _index: i,
      _scriptTarget: scriptTarget,
      _tsConfigPath: tsConfigPath,
      _tsConfigJson: tsTranspilation._tsConfigJson as any,
      _tsCompilerConfig: tsTranspilation._tsCompilerConfig as ts.ParsedCommandLine,
      _declaration: declaration,
      _tsOutDirRootResolved: tsOutDir
    };
  }

  private initLibBundleTargetInternal(bundles: LibBundleOptionsInternal[],
    currentBundle: Partial<LibBundleOptionsInternal>,
    i: number,
    libConfig: LibProjectConfigInternal): LibBundleOptionsInternal {
    if (!libConfig.outputPath) {
      throw new InvalidConfigError(`The 'projects[${libConfig.name || libConfig._index
        }].outputPath' value is required.`);
    }

    if (!currentBundle.libraryTarget) {
      throw new InvalidConfigError(
        `The 'projects[${libConfig.name || libConfig._index}].bundles[${i
        }].libraryTarget' value is required.`);
    }

    const outputPath = path.resolve(AngularBuildContext.workspaceRoot, libConfig.outputPath);
    const projectRoot = path.resolve(AngularBuildContext.workspaceRoot, libConfig.root || '');
    const libraryTarget = currentBundle.libraryTarget;

    // externals
    if (typeof currentBundle.externals === 'undefined' && libConfig.externals) {
      currentBundle.externals = JSON.parse(JSON.stringify(libConfig.externals));
    }

    // nodeModulesAsExternals
    if (typeof currentBundle.nodeModulesAsExternals === 'undefined' &&
      typeof libConfig.nodeModulesAsExternals !== 'undefined') {
      currentBundle.nodeModulesAsExternals = libConfig.nodeModulesAsExternals;
    }

    // includeDefaultAngularAndRxJsGlobals
    if (typeof currentBundle.includeDefaultAngularAndRxJsGlobals === 'undefined' &&
      typeof libConfig.includeDefaultAngularAndRxJsGlobals !== 'undefined') {
      currentBundle.includeDefaultAngularAndRxJsGlobals = libConfig.includeDefaultAngularAndRxJsGlobals;
    }

    if (currentBundle.entryRoot && currentBundle.entryRoot === 'prevBundleOutDir') {
      let foundBundleTarget: LibBundleOptionsInternal | undefined;
      if (i > 0) {
        foundBundleTarget = bundles[i - 1];
      }
      if (!foundBundleTarget) {
        throw new InvalidConfigError(
          `No previous bundle target found, please correct value in 'projects[${libConfig.name ||
          libConfig._index
          }].bundles[${i
          }].entryRoot'.`);
      }

      currentBundle._entryFilePath = foundBundleTarget._outputFilePath;
      currentBundle._sourceScriptTarget = foundBundleTarget._destScriptTarget;
      currentBundle._destScriptTarget = foundBundleTarget._destScriptTarget;
    } else if (currentBundle.entryRoot && currentBundle.entryRoot === 'tsTranspilationOutDir') {
      if (!libConfig._tsTranspilations || !libConfig._tsTranspilations.length) {
        throw new InvalidConfigError(
          `To use 'tsTranspilationOutDir', the 'projects[${libConfig.name || libConfig._index
          }].tsTranspilations' option is required.`);
      }

      let foundTsTranspilation: TsTranspilationOptionsInternal;

      if (typeof currentBundle.tsTranspilationIndex === 'undefined') {
        foundTsTranspilation = libConfig._tsTranspilations[0];
      } else {
        if (currentBundle.tsTranspilationIndex > libConfig._tsTranspilations.length - 1) {
          throw new InvalidConfigError(
            `No _tsTranspilations found, please correct value in 'projects[${libConfig.name ||
            libConfig._index
            }].bundles[${i
            }].tsTranspilationIndex'.`);
        }

        foundTsTranspilation = libConfig._tsTranspilations[currentBundle.tsTranspilationIndex];
      }

      const entryRootDir = foundTsTranspilation._tsOutDirRootResolved;
      let entryFile = currentBundle.entry;
      if (!entryFile && foundTsTranspilation._detectedEntryName) {
        entryFile = `${foundTsTranspilation._detectedEntryName}.js`;
      }
      if (!entryFile) {
        throw new InvalidConfigError(
          `The 'projects[${libConfig.name || libConfig._index}].bundles[${i}].entry' value is required.`);
      }

      currentBundle._entryFilePath = path.resolve(entryRootDir, entryFile);

      currentBundle._sourceScriptTarget = foundTsTranspilation._scriptTarget;
      currentBundle._destScriptTarget = foundTsTranspilation._scriptTarget;
    } else if (currentBundle.entryRoot && currentBundle.entryRoot === 'outputPath') {
      if (!currentBundle.entry) {
        throw new InvalidConfigError(
          `The 'projects[${libConfig.name || libConfig._index}].bundles[${i
          }].entry' value is required.`);
      }

      const entryFilePath = path.resolve(outputPath, currentBundle.entry);
      currentBundle._entryFilePath = entryFilePath;

      if (/\.f?esm?2018\.js$/i.test(entryFilePath) ||
        this.checkPathUp(/f?esm?2018$/i, path.dirname(entryFilePath), outputPath)) {
        currentBundle._sourceScriptTarget = ts.ScriptTarget.ES2018;
      } else if (/\.f?esm?2017\.js$/i.test(entryFilePath) ||
        this.checkPathUp(/f?esm?2017$/i, path.dirname(entryFilePath), outputPath)) {
        currentBundle._sourceScriptTarget = ts.ScriptTarget.ES2017;
      } else if (/\.f?esm?2016\.js$/i.test(entryFilePath) ||
        this.checkPathUp(/f?esm?2016$/i, path.dirname(entryFilePath), outputPath)) {
        currentBundle._sourceScriptTarget = ts.ScriptTarget.ES2016;
      } else if (/\.f?esm?2015\.js$/i.test(entryFilePath) ||
        this.checkPathUp(/f?esm?2015$/i, path.dirname(entryFilePath), outputPath)) {
        currentBundle._sourceScriptTarget = ts.ScriptTarget.ES2015;
      } else if (/\.f?esm?5\.js$/i.test(entryFilePath) ||
        this.checkPathUp(/f?esm?5$/i, path.dirname(entryFilePath), outputPath)) {
        currentBundle._sourceScriptTarget = ts.ScriptTarget.ES5;
      }

      currentBundle._destScriptTarget = currentBundle._sourceScriptTarget;
    } else {
      if (!currentBundle.entry) {
        throw new InvalidConfigError(
          `The 'projects[${libConfig.name || libConfig._index}].bundles[${i
          }].entry' value is required.`);
      }

      currentBundle._entryFilePath = path.resolve(projectRoot, currentBundle.entry);

      if (/\.ts$/i.test(currentBundle.entry)) {
        if (currentBundle.tsConfig) {
          currentBundle._tsConfigPath = path.resolve(projectRoot, currentBundle.tsConfig);
        } else if (libConfig._tsConfigPath) {
          currentBundle._tsConfigPath = libConfig._tsConfigPath;
          currentBundle._tsConfigJson = libConfig._tsConfigJson;
          currentBundle._tsCompilerConfig = libConfig._tsCompilerConfig;
        }
      }
    }

    let nodeResolveFields: string[] = [];

    if (currentBundle._tsConfigPath) {
      this.readTsConfig(currentBundle._tsConfigPath, currentBundle, libConfig);

      if (!currentBundle._sourceScriptTarget) {
        currentBundle._sourceScriptTarget = currentBundle._tsCompilerConfig!.options.target;
      }
      if (!currentBundle._destScriptTarget) {
        currentBundle._destScriptTarget = currentBundle._tsCompilerConfig!.options.target;
      }
    }

    if (currentBundle._destScriptTarget) {
      const scriptTarget = currentBundle._destScriptTarget as ts.ScriptTarget;

      // ecmaVersion
      const ecmaVersion = this.getEcmaVersionFromScriptTarget(scriptTarget);
      if (ecmaVersion) {
        currentBundle._ecmaVersion = ecmaVersion;
      }

      // supportES2015
      currentBundle._supportES2015 = scriptTarget !== ts.ScriptTarget.ES3 &&
        scriptTarget !== ts.ScriptTarget.ES5;

      // nodeResolveFields
      nodeResolveFields = this.getnodeResolveFieldsFromScriptTarget(scriptTarget);
    }

    // nodeResolveFields
    const defaultMainFields = ['module', 'main'];
    nodeResolveFields.push(...defaultMainFields);
    currentBundle._nodeResolveFields = nodeResolveFields;

    // outputFilePath
    let bundleOutFilePath = '';
    if (currentBundle.outputFilePath) {
      bundleOutFilePath = this.replaceOutputTokens(currentBundle.outputFilePath, true);

      const isDir = /(\\|\/)$/.test(bundleOutFilePath) ||
        !/\.js$/i.test(bundleOutFilePath);
      bundleOutFilePath = path.resolve(outputPath, bundleOutFilePath);
      if (isDir) {
        const outFileName =
          libConfig._packageNameWithoutScope!.replace(/\//gm, '-');
        bundleOutFilePath = path.resolve(bundleOutFilePath, `${outFileName}.js`);
      }
    } else {
      const outFileName =
        libConfig._packageNameWithoutScope!.replace(/\//gm, '-');

      if (currentBundle.libraryTarget === 'umd') {
        bundleOutFilePath = path.resolve(outputPath, `bundles/${outFileName}.umd.js`);
      } else if (currentBundle._destScriptTarget) {
        const scriptTargetStr = ts.ScriptTarget[currentBundle._destScriptTarget].replace(/^ES/i, '');
        const fesmFolderName = `fesm${scriptTargetStr}`;
        bundleOutFilePath = path.resolve(outputPath, fesmFolderName, `${outFileName}.js`);
      } else {
        bundleOutFilePath = path.resolve(outputPath, `bundles/${outFileName}.es.js`);
      }
    }

    if (currentBundle._entryFilePath && /\[name\]/g.test(bundleOutFilePath)) {
      bundleOutFilePath = bundleOutFilePath.replace(/\[name\]/g,
        path.basename(currentBundle._entryFilePath).replace(/\.(js|ts)$/i, ''));
    }

    // package entry points
    if (libConfig._packageJsonOutDir) {
      libConfig._packageEntryPoints = libConfig._packageEntryPoints || {};
      const packageEntryPoints = libConfig._packageEntryPoints;
      const packageJsonOutDir = libConfig._packageJsonOutDir;
      const scriptTarget = currentBundle._destScriptTarget;

      if (currentBundle.libraryTarget === 'es' && scriptTarget === ts.ScriptTarget.ES2015) {
        packageEntryPoints.fesm2015 = normalizeRelativePath(path.relative(packageJsonOutDir,
          bundleOutFilePath));
      } else if (currentBundle.libraryTarget === 'es' && scriptTarget === ts.ScriptTarget.ES5) {
        packageEntryPoints.fesm5 = normalizeRelativePath(path.relative(packageJsonOutDir,
          bundleOutFilePath));
      } else if (currentBundle.libraryTarget === 'umd') {
        packageEntryPoints.main = normalizeRelativePath(path.relative(packageJsonOutDir,
          bundleOutFilePath));
      }
    }

    return {
      ...currentBundle,
      libraryTarget: libraryTarget,
      _index: i,
      _entryFilePath: currentBundle._entryFilePath,
      _outputFilePath: bundleOutFilePath
    };
  }

  // apps
  private initAppConfig(appConfig: AppProjectConfigInternal): void {
    this.applyAppProjectConfigDefaults(appConfig);

    const projectRoot = path.resolve(AngularBuildContext.workspaceRoot, appConfig.root || '');

    if (appConfig.buildOptimizer && !appConfig.aot) {
      throw new InvalidOptionError('The `buildOptimizer` option cannot be used without `aot`.');
    }

    // tsConfig
    if (appConfig.tsConfig) {
      appConfig._tsConfigPath = path.resolve(projectRoot, appConfig.tsConfig);
    } else {
      const tsconfigFiles = ['tsconfing.app.json', 'tsconfing-app.json'];
      if (appConfig.platformTarget === 'node') {
        tsconfigFiles.push('tsconfig.server.json');
        tsconfigFiles.push('tsconfig-server.json');
      } else {
        tsconfigFiles.push('tsconfig.browser.json');
        tsconfigFiles.push('tsconfig-browser.json');
      }

      const foundTsConfigFilePath =
        findUpSync(tsconfigFiles, projectRoot, AngularBuildContext.workspaceRoot);
      if (foundTsConfigFilePath) {
        appConfig._tsConfigPath = foundTsConfigFilePath;
      }
    }

    if (appConfig._tsConfigPath) {
      this.readTsConfig(appConfig._tsConfigPath, appConfig, appConfig);

      const compilerOptions = appConfig._tsCompilerConfig!.options;

      // script target
      appConfig._supportES2015 = compilerOptions.target !== ts.ScriptTarget.ES3 &&
        compilerOptions.target !== ts.ScriptTarget.ES5;

      // _ecmaVersion
      const ecmaVersion = this.getEcmaVersionFromScriptTarget(compilerOptions.target);
      if (ecmaVersion) {
        appConfig._ecmaVersion = ecmaVersion;
      }

      // _nodeResolveFields
      let nodeResolveFields = this.getnodeResolveFieldsFromScriptTarget(compilerOptions.target);

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

    // dlls
    if (appConfig.vendors && (appConfig._isDll || appConfig.referenceDll)) {
      appConfig._dllParsedResult = this.parseDllEntries(appConfig.vendors, true);
    }

    // polyfills
    if (!appConfig._isDll && appConfig.polyfills && appConfig.polyfills.length > 0) {
      const polyfills = Array.isArray(appConfig.polyfills) ? appConfig.polyfills : [appConfig.polyfills];
      appConfig._polyfillParsedResult = this.parseDllEntries(polyfills, false);
    }

    // styles
    if (!appConfig._isDll && appConfig.styles && Array.isArray(appConfig.styles) && appConfig.styles.length > 0) {
      appConfig._styleParsedEntries =
        this.parseScriptAndStyleEntries(appConfig.styles, 'styles');
    }

    // scripts
    if (!appConfig._isDll &&
      appConfig.scripts &&
      Array.isArray(appConfig.scripts) &&
      appConfig.scripts.length > 0) {
      appConfig._scriptParsedEntries =
        this.parseScriptAndStyleEntries(appConfig.scripts, 'scripts');
    }
  }

  private applyAppProjectConfigDefaults(appConfig: AppProjectConfigInternal): void {
    if (appConfig.skip) {
      return;
    }

    const environment = this.buildOptions.environment;

    if (typeof appConfig.optimization === 'undefined' && (environment.prod || environment.production)) {
      appConfig.optimization = true;
    }

    if (!appConfig.platformTarget) {
      appConfig.platformTarget = 'web';
    }

    if (appConfig.publicPath == null) {
      if (!appConfig.platformTarget || appConfig.platformTarget === 'web') {
        appConfig.publicPath = '/';
      }
    }

    if (appConfig.publicPath) {
      appConfig.publicPath = /\/$/.test(appConfig.publicPath) ? appConfig.publicPath : appConfig.publicPath + '/';
    }

    if (typeof appConfig.concatenateModules === 'undefined' &&
      appConfig.platformTarget !== 'node' &&
      appConfig.optimization &&
      !appConfig._isDll) {
      appConfig.concatenateModules = true;
    }

    if (typeof appConfig.aot === 'undefined' &&
      appConfig.optimization &&
      !appConfig.referenceDll &&
      !appConfig._isDll) {
      appConfig.aot = true;
    }

    if (typeof appConfig.buildOptimizer === 'undefined' &&
      appConfig.aot &&
      appConfig.platformTarget !== 'node' &&
      appConfig.optimization &&
      !appConfig._isDll) {
      appConfig.buildOptimizer = true;
    }

    appConfig.mainChunkName = appConfig.mainChunkName || 'main';
    appConfig.polyfillsChunkName = appConfig.polyfillsChunkName || 'polyfills';
    appConfig.vendorChunkName = appConfig.vendorChunkName || 'vendor';

    if (typeof appConfig.vendorChunk === 'undefined' &&
      appConfig.platformTarget !== 'node' &&
      !appConfig.optimization &&
      !appConfig.referenceDll &&
      !appConfig._isDll) {
      appConfig.vendorChunk = true;
    }

    if (typeof appConfig.sourceMap === 'undefined' && !appConfig.optimization) {
      appConfig.sourceMap = true;
    }

    if (typeof appConfig.extractCss === 'undefined') {
      if (!appConfig.platformTarget || appConfig.platformTarget === 'web') {
        if (appConfig.optimization || appConfig._isDll) {
          appConfig.extractCss = true;
        }
      } else {
        appConfig.extractCss = false;
      }
    }

    if (typeof appConfig.extractLicenses === 'undefined') {
      if (!appConfig.platformTarget || appConfig.platformTarget === 'web') {
        if (appConfig.optimization || appConfig._isDll) {
          appConfig.extractLicenses = true;
        }
      } else {
        appConfig.extractLicenses = false;
      }
    }

    if (typeof appConfig.namedChunks === 'undefined') {
      appConfig.namedChunks = !appConfig.optimization;
    }

    if (appConfig._isDll) {
      if (appConfig.referenceDll) {
        appConfig.referenceDll = false;
      }
      if (appConfig.aot) {
        appConfig.aot = false;
      }
      if (appConfig.buildOptimizer) {
        appConfig.buildOptimizer = false;
      }
      if (appConfig.htmlInject) {
        delete appConfig.htmlInject;
      }
      if (typeof appConfig.environmentVariables !== 'undefined') {
        delete appConfig.environmentVariables;
      }
      if (appConfig.banner) {
        delete appConfig.banner;
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

  private parseDllEntries(inputs: string | string[], forDll: boolean): DllParsedResult {
    const result: DllParsedResult = {
      tsEntries: [],
      scriptEntries: [],
      styleEntries: []
    };
    const projectRoot = path.resolve(AngularBuildContext.workspaceRoot, this.projectConfig.root || '');

    if (!inputs || (Array.isArray(inputs) && !inputs.length)) {
      return result;
    }

    const dllEntries: string[] = [];

    if (Array.isArray(inputs)) {
      (inputs as string[]).forEach(e => {
        if (!dllEntries.includes(e)) {
          dllEntries.push(e);
        }
      });
    } else if (typeof inputs === 'string') {
      const e = inputs as string;
      if (e && e.length && !dllEntries.includes(e)) {
        dllEntries.push(e);
      }
    }

    if (!dllEntries.length) {
      return result;
    }

    dllEntries
      .forEach((e: string) => {
        if (!forDll) {
          const resolvedPath = path.resolve(projectRoot, e);
          if (existsSync(resolvedPath)) {
            if (e.match(/\.ts$/i)) {
              if (!result.tsEntries.includes(resolvedPath)) {
                result.tsEntries.push(resolvedPath);
              }
            } else {
              if (!result.scriptEntries.includes(resolvedPath)) {
                result.scriptEntries.push(resolvedPath);
              }
            }
          } else {
            if (!result.scriptEntries.includes(resolvedPath)) {
              result.scriptEntries.push(resolvedPath);
            }
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

    return result;
  }
}

