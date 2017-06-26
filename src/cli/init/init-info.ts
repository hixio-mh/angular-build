import { AngularBuildConfig } from '../../models';
import { Logger } from '../../utils';

export interface CommandOptions {
    /**
     * Package manager to use while installing dependencies.
     */
    packageManager?: 'npm' | 'yarn';
    /**
     * Link angular-build cli to current project.
     * @default false
     */
    link?: boolean;
    /**
     * Install webpack loaders and dependencies.
     */
    installDeps?: boolean;
    /**
     * Your angular project type - lib or app.
     */
    projectType?: 'app' | 'lib';
}


export interface InitInfo {
    logger: Logger;
    cwd: string;
    cliIsLocal: boolean;
    commandOptions: CommandOptions;

    userPackageConfig?: any;
    angularBuildSchema?: any;
    userAngularBuildConfig?: AngularBuildConfig;
    angularBuildConfigToWrite?: AngularBuildConfig;

    //shouldWriteFaviconConfig?: boolean;
    //faviconConfigSrcDir?: string;
    //faviconConfigToWrite?: any;
}
