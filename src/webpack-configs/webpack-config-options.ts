import { AngularBuildConfig, BuildOptions, ProjectConfig } from '../models';
import { Logger } from '../utils';

export type WebpackConfigOptions = {
    projectRoot: string;
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

    logger?: Logger;
    silent?: boolean;
    webpackIsGlobal?: boolean;
};
