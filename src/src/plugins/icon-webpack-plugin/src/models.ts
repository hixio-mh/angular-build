// See: http://realfavicongenerator.net/api/non_interactive_api#.WG8UhRt96Uk
export interface IconDesign {
    // rfg
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
        }
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
    },

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

    // favicon background color (see https://github.com/haydenbleasel/favicons#usage)
    background?: string;

    // favicon app title (see https://github.com/haydenbleasel/favicons#usage)
    appName?: string;

    // Your application's description. `string`
    appDescription?: string;

    // Your (or your developer's) URL. `string`
    developerUrl?: string;

    developerName?: string;

    // Offline
    lang?: string;

    // Offline
    dir?: string;

    // Offline
    // Your application's version number. `number`
    version?: string;

    // Offline
    // Android display: "browser" or "standalone". `string`
    display?: string;

    // Offline
    // Android orientation: "portrait" or "landscape". `string`
    orientation?: string;

    // Offline
    // Android start application's URL. `string`
    startUrl?: string;

    // which icons should be generated (see https://github.com/haydenbleasel/favicons#usage)
    design?: IconDesign;

    // rfg - Online
    settings?: {
        compression?: string;
        scalingAlgorithm?: string;
        errorOnImageTooSmall?: boolean;
    };

}

export interface IconPluginOptions extends IconOptions {

    // Plugnin options
    //
    // Your source logo
    masterPicture: string;

    // Loader/Plugnin options
    //
    // The prefix for all image files (might be a folder or a name)
    iconsPath?: string;

    // Emit all stats of the generated icons
    emitStats?: boolean;

    // The name of the json containing all favicon information
    statsFilename?: string;

    // Generate a cache file with control hashes and
    // don't rebuild the favicons until those hashes change
    persistentCache?: boolean;

    // Use RealFaviconGenerator to create favicons? `boolean`
    online?: boolean;

    // Use offline generation, if online generation has failed. `boolean`
    preferOnline?: boolean;

    // Inject the html into the html-webpack-plugin
    inject?: boolean;
    targetHtmlWebpackPluginId?: string;
    seperateOutput?: boolean;
    applyCustomAttributes?: boolean;
}

export interface IconLoaderOptions extends IconOptions {
    // Loader/Plugnin options
    //
    // The prefix for all image files (might be a folder or a name)
    iconsPath?: string;

    // Generate a cache file with control hashes and
    // don't rebuild the favicons until those hashes change
    persistentCache?: boolean;

    // Use RealFaviconGenerator to create favicons? `boolean`
    online?: boolean;

    // Use offline generation, if online generation has failed. `boolean`
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
