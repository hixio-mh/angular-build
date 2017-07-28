import { AngularBuildConfig } from '../../models';
import { Logger } from '../../utils';

export interface CommandOptions {
    packageManager?: 'npm' | 'yarn';
    link?: boolean;
    projectType?: 'app' | 'lib';
}

export interface InitInfo {
    logger: Logger;
    cwd: string;
    cliIsLocal: boolean;
    commandOptions: CommandOptions;

    isAspNetMvc?: boolean;
    shouldInstallPolyfills?: boolean;
    userPackageConfig?: any;
    angularBuildSchema?: any;
    userAngularBuildConfig?: AngularBuildConfig;
    angularBuildConfigToWrite?: AngularBuildConfig;
    webpackConfigFileCreated?: boolean;
}
