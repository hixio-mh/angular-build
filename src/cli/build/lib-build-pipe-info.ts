import { AngularBuildConfig, BuildOptions, LibProjectConfig } from '../../models';
import { TsTranspiledInfo } from '../../helpers';
import {Logger} from '../../utils';

export interface LibBuildPipeInfo {
    projectRoot: string;
    libConfigMaster: LibProjectConfig;
    libConfig: LibProjectConfig;
    buildOptions: BuildOptions;
    angularBuildConfig: AngularBuildConfig;
    packageName: string;
    logger: Logger;
    tsTranspiledInfoes?: TsTranspiledInfo[];
    mainFields?: { [key: string]: string };
}
