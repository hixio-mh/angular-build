import { ParsedCommandLine } from 'typescript';

import { JsonObject } from '../json-object';
import { ProjectConfig, ProjectConfigBase } from '../project-config';

import { BuildOptionsInternal } from './build-options-internal';

export interface ProjectConfigInternal<TConfig extends ProjectConfigBase> extends ProjectConfig<TConfig> {
    _configPath?: string;

    _workspaceRoot?: string;
    _nodeModulesPath?: string | null;
    _projectRoot?: string;
    _outputPath?: string;
    _buildOptions?: BuildOptionsInternal;

    _projectType: 'app' | 'lib';
    _index: number;

    _bannerText?: string;
    _packageConfigPath?: string;
    _rootPackageConfigPath?: string;
    _packageJson?: JsonObject;
    _rootPackageJson?: JsonObject;

    _projectName?: string;
    _packageNameWithoutScope?: string;

    _projectVersion?: string;
    _projectDescription?: string;
    _projectAuthor?: string;
    _projectHomePage?: string;
    _packageScope?: string;

    _isPackagePrivate?: boolean;

    _tsConfigPath?: string;
    _tsConfigJson?: JsonObject;
    _tsCompilerConfig?: ParsedCommandLine;
    _angularCompilerOptions?: JsonObject;
}
