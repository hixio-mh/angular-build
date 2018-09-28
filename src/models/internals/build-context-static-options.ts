import { AngularBuildConfigInternal } from './angular-build-config-internal';

export interface BuildContextStaticOptions {
    workspaceRoot: string;
    filteredConfigNames?: string[];
    startTime?: number;
    angularBuildConfig?: AngularBuildConfigInternal;
    fromBuiltInCli?: boolean;
    cliRootPath?: string;
    cliVersion?: string;
    cliIsGlobal?: boolean;
}
