import { AppConfig, BuildOptions } from './models';
export declare function getWebpackCommonConfig(projectRoot: string, appConfig: AppConfig, buildOptions: BuildOptions): any;
export declare function getWebpackDllConfig(projectRoot: string, appConfig: AppConfig, buildOptions: BuildOptions): any;
export declare function getWebpackNonDllConfig(projectRoot: string, appConfig: AppConfig, buildOptions: BuildOptions): any;
export declare function getWebpackSharedConfigPartial(projectRoot: string, appConfig: AppConfig, buildOptions: BuildOptions): {
    target: string;
    devtool: string | boolean;
    context: string;
    output: {
        path: string;
        publicPath: string;
        filename: string;
        sourceMapFilename: string;
        chunkFilename: string;
        library: string;
    };
    plugins: any[];
    performance: {
        hints: string | boolean;
        maxAssetSize: number;
        maxEntrypointSize: number;
        assetFilter(assetFilename: string): boolean;
    };
    node: {
        fs: string;
        global: boolean;
        crypto: string;
        tls: string;
        net: string;
        process: boolean;
        module: boolean;
        clearImmediate: boolean;
        setImmediate: boolean;
    };
    stats: {
        colors: boolean;
        hash: boolean;
        timings: boolean;
        errors: boolean;
        errorDetails: boolean;
        warnings: boolean;
        assets: boolean;
        version: boolean;
        publicPath: boolean;
        chunkModules: boolean;
        reasons: boolean;
        children: boolean;
        chunks: boolean;
    };
};
export declare function getWebpackDllConfigPartial(projectRoot: string, appConfig: AppConfig, buildOptions: BuildOptions): {
    resolve: {
        extensions: string[];
    };
    entry: {
        [key: string]: string[];
    };
    output: {
        libraryTarget: string;
    };
    module: {
        rules: any[];
    };
    plugins: any[];
};
export declare function getWebpackNonDllConfigPartial(projectRoot: string, appConfig: AppConfig, buildOptions: BuildOptions): {
    resolve: {
        extensions: string[];
        modules: string[];
    };
    entry: {
        [key: string]: string[];
    };
    module: {
        rules: any;
    };
    plugins: any;
};
