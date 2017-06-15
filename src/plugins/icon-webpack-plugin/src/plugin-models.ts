import { FaviconConfig } from './interfaces';

export interface IconPluginOptions extends FaviconConfig {
    targetHtmlWebpackPluginIds?: string[];
}

export interface IconLoaderOptions extends FaviconConfig {
    context?: string;
    regExp?: any;
}

export interface IconLoaderResult {
    iconsPath: string;
    html: string[];
    files: string[];
}

export interface IconGenerateResult {
    iconsPath: string;
    html: string[];
    files: IconFileInfo[];
}

export interface IconFileInfo {
    name: string;
    size?: number;
    contents: Buffer;
}
