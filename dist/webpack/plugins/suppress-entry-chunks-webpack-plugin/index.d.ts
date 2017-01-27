export interface SuppressEntryChunksPluginOptions {
    chunks?: string[];
    supressPattern?: RegExp;
    targetHtmlWebpackPluginId?: string;
    assetTagsFilterFunc?: (tag: any) => boolean;
}
export declare class SuppressEntryChunksWebpackPlugin {
    private readonly options;
    private isTargetHtmlWebpackPlugin;
    constructor(options: SuppressEntryChunksPluginOptions);
    apply(compiler: any): void;
    supressAssets(compilation: any, callback: any): void;
}
