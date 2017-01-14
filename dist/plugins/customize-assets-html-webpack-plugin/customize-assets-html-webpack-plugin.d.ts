export declare class CustomizeAssetsHtmlPluginOptions {
    targetHtmlWebpackPluginId?: string;
    clearHeadAssets?: boolean;
    clearBodyAssets?: boolean;
    moveHeadAssetsToBody?: boolean;
    moveBodyAssetsToHead?: boolean;
    cssSrcToHeadAssets?: string[];
    scriptSrcToHeadAssets?: string[];
    cssSrcToBodyAssets?: string[];
    scriptSrcToBodyAssets?: string[];
    addPublicPath?: boolean;
    assetTagsFilterFunc?: (tag: any) => boolean;
    customScriptAttributes?: {
        [key: string]: string;
    };
    customLinkAttributes?: {
        [key: string]: string;
    };
    removeStartingSlash?: boolean;
}
export declare class CustomizeAssetsHtmlWebpackPlugin {
    private readonly options;
    private publicPath;
    private isTargetHtmlWebpackPlugin;
    constructor(options: CustomizeAssetsHtmlPluginOptions);
    apply(compiler: any): void;
}
