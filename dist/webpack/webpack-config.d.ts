import { AngularAppConfig, AngularBuildOptions, AngularBuildConfig } from './models';
export declare function getWebpackConfigs(projectRoot: string, angularBuildConfig?: AngularBuildConfig, buildOptions?: AngularBuildOptions): any[];
export declare function getWebpackConfig(projectRoot: string, appConfig: AngularAppConfig, buildOptions?: AngularBuildOptions, skipMerge?: boolean): any;
