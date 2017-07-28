// See: http://realfavicongenerator.net/api/non_interactive_api#.WG8UhRt96Uk

/**
 * @additionalProperties true
 */
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
        margin?: number | string;
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
        margin?: number | string;
    };

    openGraph?: {
        pictureAspect?: string;
        backgroundColor?: string;
        margin?: number | string;
        ratio?: string;
    };

    firefoxApp?: {
        pictureAspect?: string;
        keepPictureInCircle?: string | boolean;
        circleInnerMargin?: string;
        backgroundColor?: string;
        margin?: number | string;
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

/**
 * @additionalProperties true
 */
export interface FaviconConfig {

    apiKey?: string;

    /**
     * see https://github.com/haydenbleasel/favicons#usage
     */
    background?: string;

    /**
     * see https://github.com/haydenbleasel/favicons#usage
     */
    appName?: string;

    appDescription?: string;

    developerUrl?: string;

    developerName?: string;

    lang?: string;

    dir?: string;

    /**
     * Your application's version number.
     */
    version?: string;

    /**
     * Android display: "browser" or "standalone".
     */
    display?: string;

    /**
     * Android orientation: "portrait" or "landscape".
     */
    orientation?: string;

    /**
     * Android start application's Url.
     */
    startUrl?: string;

    /**
     * see https://github.com/haydenbleasel/favicons#usage
     */
    design?: IconDesign;

    settings?: {
        compression?: string;
        scalingAlgorithm?: string;
        errorOnImageTooSmall?: boolean;
    };

    versioning?: boolean | {
        paramName: string;
        paramValue: string;
    };

    /**
     * Your source logo
     */
    masterPicture?: string;

    /**
     * The prefix for all image files (might be a folder or a name)
     */
    iconsPath?: string;

    /**
     * Emit all stats of the generated icons
     * @default false
     */
    emitStats?: boolean;

    /**
     * The name of the json containing all favicon information
     */
    statsFilename?: string;

    /* Generate a cache file with control hashes and
    * don't rebuild the favicons until those hashes change.
    */
    persistentCache?: boolean;

    /**
     * Use RealFaviconGenerator to create favicons? `boolean`
     */
    online?: boolean;

    /**
     * Use offline generation, if online generation has failed. `boolean`
     */
    preferOnline?: boolean;

    /**
     * Copy 'favicon.ico' file to root output directory
     */
    emitFaviconIcoToOutDirRoot?: boolean;
}
