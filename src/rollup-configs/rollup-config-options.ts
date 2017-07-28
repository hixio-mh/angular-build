import { AngularBuildConfig, BuildOptions, ProjectConfig } from '../models';
import { Logger } from '../utils';

export type RollupConfigOptions = {
    projectRoot: string;
    projectConfigMaster: ProjectConfig;
    projectConfig: ProjectConfig;
    buildOptions: BuildOptions;
    angularBuildConfig?: AngularBuildConfig;

    bundleRoot?: string;
    bundleEntryFile?: string;
    bundleOutFileName?: string;
    bundleOutDir?: string;
    bundleLibraryTarget?: string;
    packageName?: string;
    inlineResources?: boolean;
    useNodeResolve?: boolean;

    logger?: Logger;
    silent?: boolean;
};
