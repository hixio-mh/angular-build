import { IconPluginOptions } from './models';
export interface IconStatsResult {
    outputName: string;
    stats: {
        html: string[];
    };
}
export interface HtmlPluginArgs {
    html?: string;
    assets?: {
        publicPath?: string;
        chunks?: {};
        js?: string[];
        css?: string[];
    };
    plugin?: {
        options?: {
            template?: string;
            filename?: string;
            hash?: boolean;
            inject?: boolean | string;
            compile?: boolean;
            favicon?: string;
            minify?: boolean | {};
            cache?: boolean;
            showErrors?: boolean;
            chunks?: string | string[];
            excludeChunks?: string[];
            title?: string;
            xhtml?: boolean;
            id?: string;
            customAttributes?: any;
        };
        childCompilerHash?: string;
        childCompilationOutputName?: string;
        assetJson?: string;
    };
    outputName?: string;
}
export declare class IconWebpackPlugin {
    private readonly defaultPluginOptions;
    private readonly rawOptions;
    private options;
    private optionInitialized;
    private context;
    private iconStatsResult;
    private childComplier;
    private isTargetHtmlWebpackPlugin;
    constructor(options: IconPluginOptions | string);
    private initOptions(context);
    apply(compiler: any): void;
}
export declare class ChildComplier {
    private readonly context;
    private readonly parentCompilation;
    constructor(context: string, parentCompilation: any);
    compileTemplate(options: IconPluginOptions): Promise<IconStatsResult>;
    private getCompilerName(context, filename);
}
