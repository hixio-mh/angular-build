import { AngularAppConfig, AngularBuildOptions } from './models';
export declare function getWebpackAngularConfig(projectRoot: string, appConfig: AngularAppConfig, buildOptions: AngularBuildOptions): any;
export declare function getWebpackTypescriptConfigPartial(projectRoot: string, appConfig: AngularAppConfig, buildOptions: AngularBuildOptions): {
    resolve: {
        extensions: string[];
        plugins: any[];
    };
    module: {
        rules: any[];
    };
    plugins: any[];
};
