import { AngularAppConfig, AngularBuildOptions } from './models';
export declare function getWebpackAngularConfigs(projectRoot: string, configPath?: string, buildOptions?: AngularBuildOptions): any;
export declare function getWebpackAngularConfig(projectRoot: string, appConfig: AngularAppConfig, buildOptions?: AngularBuildOptions): {
    resolve: {
        extensions: string[];
    };
    module: {
        rules: any;
    };
    plugins: any;
};
