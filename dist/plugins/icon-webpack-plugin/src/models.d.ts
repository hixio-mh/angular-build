/// <reference types="node" />
export interface IconDesign {
    androidChrome?: {
        pictureAspect?: string;
        themeColor?: string;
        manifest?: {
            display?: string;
            orientation?: string;
            declared?: boolean;
            name?: string;
            onConflict?: string;
            startUrl?: string;
        };
        assets?: {
            legacyIcon?: boolean;
            lowResolutionIcons?: boolean;
        };
    };
    ios?: {
        pictureAspect?: string;
        margin?: number;
        backgroundColor?: string;
        startupImage?: {
            backgroundColor?: string;
        };
        assets?: {
            ios6AndPriorIcons?: boolean;
            ios7AndLaterIcons?: boolean;
            precomposedIcons?: boolean;
            declareOnlyDefaultIcon?: boolean;
        };
    };
    safariPinnedTab?: {
        pictureAspect?: string;
        threshold?: number;
        themeColor?: string;
    };
    windows?: {
        pictureAspect?: string;
        backgroundColor?: string;
        onConflict: string;
        assets?: {
            windows80Ie10Tile?: boolean;
            windows10Ie11EdgeTiles?: {
                small?: boolean;
                medium?: boolean;
                big?: boolean;
                rectangle?: boolean;
            };
        };
    };
    desktopBrowser?: {};
    coast?: {
        pictureAspect?: string;
        backgroundColor?: string;
        margin?: number;
    };
    openGraph?: {
        pictureAspect?: string;
        backgroundColor?: string;
        margin?: number;
        ratio?: string;
    };
    firefoxApp?: {
        pictureAspect?: string;
        keepPictureInCircle?: string;
        circleInnerMargin?: string;
        backgroundColor?: string;
        margin?: number;
        manifest?: {
            appName?: string;
            appDescription?: string;
            developerName?: string;
            developerUrl?: string;
        };
    };
    yandexBrowser?: {
        backgroundColor?: string;
        manifest?: {
            showTitle?: boolean;
            version?: string;
        };
    };
}
export interface IconOptions {
    apiKey?: string;
    background?: string;
    appName?: string;
    appDescription?: string;
    developerUrl?: string;
    developerName?: string;
    lang?: string;
    dir?: string;
    version?: string;
    display?: string;
    orientation?: string;
    startUrl?: string;
    design?: IconDesign;
    settings?: {
        compression?: string;
        scalingAlgorithm?: string;
        errorOnImageTooSmall?: boolean;
    };
}
export interface IconPluginOptions extends IconOptions {
    masterPicture: string;
    iconsPath?: string;
    emitStats?: boolean;
    statsFilename?: string;
    persistentCache?: boolean;
    online?: boolean;
    preferOnline?: boolean;
    inject?: boolean;
    targetHtmlWebpackPluginId?: string;
    seperateOutput?: boolean;
    applyCustomAttributes?: boolean;
}
export interface IconLoaderOptions extends IconOptions {
    iconsPath?: string;
    persistentCache?: boolean;
    online?: boolean;
    preferOnline?: boolean;
    context?: string;
    regExp?: any;
}
export interface IconLoaderResult {
    iconsPath: string;
    html: string[];
    files: string[];
}
export interface IconResult {
    iconsPath: string;
    html: string[];
    files: IconFileInfo[];
}
export interface IconFileInfo {
    name: string;
    size?: number;
    contents: Buffer;
}
