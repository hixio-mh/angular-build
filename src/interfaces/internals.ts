import { virtualFs } from '@angular-devkit/core';
import { ParsedCommandLine, ScriptTarget } from 'typescript';

import { Logger, LogLevelString } from '../utils';

import { AngularBuildConfig } from './angular-build-config';
import { AppProjectConfig, AppProjectConfigBase } from './app-project-config';
import { BuildOptions } from './build-options';
import { LibBundleOptions, LibProjectConfig, LibProjectConfigBase, TsTranspilationOptions } from './lib-project-config';
import { ProjectConfig, ProjectConfigBase } from './project-config';

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

    // tslint:disable-next-line:no-any
    _schema?: { [key: string]: any };
    _configPath: string;
}

export interface TsTranspilationOptionsInternal extends TsTranspilationOptions {
    _index: number;
    _tsConfigPath: string;
    // tslint:disable-next-line:no-any
    _tsConfigJson: { [key: string]: any };
    _tsCompilerConfig: ParsedCommandLine;
    _declaration: boolean;
    _scriptTarget: ScriptTarget;
    _tsOutDirRootResolved: string;

    // tslint:disable-next-line:no-any
    _angularCompilerOptions?: { [key: string]: any };
    _detectedEntryName?: string;
    _typingsOutDir?: string;
    _customTsOutDir?: string;
}

export interface LibBundleOptionsInternal extends LibBundleOptions {
    _index: number;
    _entryFilePath: string;
    _outputFilePath: string;

    _tsConfigPath?: string;
    // tslint:disable-next-line:no-any
    _tsConfigJson?: { [key: string]: any };
    _tsCompilerConfig?: ParsedCommandLine;

    _sourceScriptTarget?: ScriptTarget;
    _destScriptTarget?: ScriptTarget;
    _ecmaVersion?: number;
    _supportES2015?: boolean;

    _nodeResolveFields?: string[];
}

export interface PackageEntryPoints {
    main?: string;
    // tslint:disable-next-line:no-reserved-keywords
    module?: string;
    es2015?: string;
    esm5?: string;
    esm2015?: string;
    fesm2015?: string;
    fesm5?: string;
    typings?: string;
}

export interface ProjectConfigInternal<TConfig extends ProjectConfigBase> extends ProjectConfig<TConfig> {
    _configPath?: string;
    _workspaceRoot?: string;
    _nodeModulesPath?: string | null;
    _projectRoot?: string;
    _outputPath?: string;

    _projectType?: 'app' | 'lib';
    _index?: number;

    _bannerText?: string;
    _packageConfigPath?: string;
    _rootPackageConfigPath?: string;
    // tslint:disable-next-line:no-any
    _packageJson?: { [key: string]: any };
    // tslint:disable-next-line:no-any
    _rootPackageJson?: { [key: string]: any };

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
    // tslint:disable-next-line:no-any
    _tsConfigJson?: { [key: string]: any };
    _tsCompilerConfig?: ParsedCommandLine;
    // tslint:disable-next-line:no-any
    _angularCompilerOptions?: { [key: string]: any};
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
    _prevTsTranspilationVersionReplaced?: boolean;
    _prevTsTranspilationResourcesInlined?: boolean;

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
    filteredConfigNames?: string[];
    startTime?: number;
    angularBuildConfig?: AngularBuildConfigInternal;
    fromAngularBuildCli?: boolean;
    cliRootPath?: string;
    cliVersion?: string;
    cliIsGlobal?: boolean;
    logger?: Logger;
    logLevel?: LogLevelString;
}
