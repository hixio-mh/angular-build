/// <reference types="yargs" />
import * as yargs from 'yargs';
import { CliOptions } from './models';
import { AngularBuildConfig, IconPluginOptions } from '../webpack';
export declare const initCommandModule: yargs.CommandModule;
export interface PackageToCheck {
    packageName: string;
    isPreReleased?: boolean;
    version?: string;
    resolvedPath?: string;
}
export interface PackageJsonConfig {
    dependencies?: {
        [key: string]: string;
    };
    devDependencies?: {
        [key: string]: string;
    };
    peerDependencies?: {
        [key: string]: string;
    };
}
export interface InitConfig {
    cliOptions: CliOptions;
    cliPackageJsonConfig?: PackageJsonConfig;
    angularBuildConfig?: AngularBuildConfig;
    overrideAngularBuildConfigFile?: boolean;
    angularBuildConfigFileExists?: boolean;
    userAngularCliConfig?: any;
    useAngularCliConfigFile?: boolean;
    angularCliConfigFileExists?: boolean;
    faviconConfig?: IconPluginOptions;
    webpackConfigFileName?: string;
    webpackConfigFileExists?: boolean;
    overrideWebpackConfigFile?: boolean;
    userPackageConfigFileExists?: boolean;
    userPackageConfigFile?: string;
    userPackageConfig?: any;
    tsConfig?: any;
}
export declare function init(cliOptions: CliOptions): Promise<{}>;
