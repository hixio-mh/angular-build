import { AngularBuildConfigInternal } from './angular-build-config-internal';

import { LoggerBase } from '../../utils';

export interface BuildContextStaticOptions {
    startTime: number;
    logger: LoggerBase;

    workspaceRoot: string;
    angularBuildConfig?: AngularBuildConfigInternal;

    angularBuildVersion?: string;
    fromBuiltInCli?: boolean;
    cliIsGlobal?: boolean;
    cliRootPath?: string;
    cliIsLink?: boolean;
}
