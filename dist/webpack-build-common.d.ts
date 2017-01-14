import { AppConfig, BuildOptions } from './models';
export declare function getWebpackCommonConfig(projectRoot: string, appConfig: AppConfig, buildOptions?: BuildOptions): {
    target: string;
    devtool: string | boolean;
    resolve: {
        extensions: string[];
        modules: string[];
    };
    context: string;
    entry: {
        [key: string]: string[];
    };
    output: {
        path: string;
        publicPath: string;
        filename: string;
        sourceMapFilename: string;
        chunkFilename: string;
        libraryTarget: string;
        library: string;
    };
    module: {
        rules: any;
    };
    plugins: any;
    performance: {
        hints: string | boolean;
        maxAssetSize: number;
        maxEntrypointSize: number;
        assetFilter(assetFilename: any): any;
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
};
