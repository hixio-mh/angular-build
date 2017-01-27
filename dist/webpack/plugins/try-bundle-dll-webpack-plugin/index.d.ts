export interface TryBundleDllPluginOptions {
    manifestFile: string;
    webpackDllConfig: any;
    debug?: boolean;
}
export declare class TryBundleDllWebpackPlugin {
    private readonly options;
    constructor(options: TryBundleDllPluginOptions);
    apply(compiler: any): void;
    tryDll(next: (err?: Error) => any): void;
    private checkManifestFile();
}
