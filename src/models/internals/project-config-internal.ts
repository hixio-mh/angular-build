import { ParsedCommandLine } from 'typescript';

import { ProjectConfig, ProjectConfigBase } from '../project-config';

import { BuildOptionsInternal } from './build-options-internal';

export interface ProjectConfigInternal<TConfig extends ProjectConfigBase> extends ProjectConfig<TConfig> {
    _configPath?: string;

    _workspaceRoot?: string;
    _nodeModulesPath?: string | null;
    _projectRoot?: string;
    _outputPath?: string;
    _buildOptions?: BuildOptionsInternal;
    _rptCacheDirectory?: string;

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

    _tsConfigPath?: string;
    // tslint:disable-next-line:no-any
    _tsConfigJson?: { [key: string]: any };
    _tsCompilerConfig?: ParsedCommandLine;
    // tslint:disable-next-line:no-any
    _angularCompilerOptions?: { [key: string]: any };
}
