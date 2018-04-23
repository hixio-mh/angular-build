export interface MasterPicture {
    type?: 'inline' | 'url';
    content?: string;
    url?: string;
}

export interface AndroidChromeDesign {
    /**
     * The picture aspect.
     */
    pictureAspect?: 'noChange' | 'backgroundAndMargin' | 'shadow';
    /**
     * The theme color.
     */
    themeColor?: string;
    /**
     * @additionalProperties true
     */
    manifest?: {
        /**
         * Specify the appearance of the web site when the user clicks the home scren link.
         */
        display?: 'browser' | 'standalone';
        /**
         * When present and display is standalone, force the screen to a particular orientation. Either portrait or landscape.
         */
        orientation?: 'portrait' | 'landscape';
        /**
         * Use onConflict to indicate how to react in case of conflict.
         * If the existing manifest contains an entry that RealFaviconGenerator also generates.
         */
        onConflict?: 'raiseError' | 'override' | 'keepExisting';
        /**
         * The page actually added to the home screen.
         * Typically, the home page of the site. Leave this field blank to let a visitor add any page to the home screen.
         */
        startUrl?: string;
        /**
         * The application name is used as the title of the link when the visitor adds the site to the home screen.
         */
        name?: string;
        declared?: boolean;
    };
    /**
     * @additionalProperties true
     */
    assets?: {
        /**
         * If true, the service generates icons and HTML markups for Android Chrome running on Android Chrome M38 and prior.
         */
        legacyIcon?: boolean;
        /**
         * If true, the service creates all documented icons for home screen and splash screen.
         * Else, it creates only recommended, high resolution icons.
         */
        lowResolutionIcons?: boolean;
    };
}

export interface IoSDesign {
    pictureAspect?: 'noChange' | 'backgroundAndMargin';
    margin?: number | string;
    backgroundColor?: string;
    /**
     * @additionalProperties true
     */
    startupImage?: {
        backgroundColor?: string;
    };
    /**
     * @additionalProperties true
     */
    assets?: {
        ios6AndPriorIcons?: boolean;
        ios7AndLaterIcons?: boolean;
        precomposedIcons?: boolean;
        declareOnlyDefaultIcon?: boolean;
    };
}

export interface SafariPinnedTabDesign {
    pictureAspect?: 'noChange' | 'silhouette' | 'blackAndWhite';
    threshold?: number;
    themeColor?: string;
}

export interface WindowsDesign {
    pictureAspect?: 'noChange' | 'whiteSilhouette';
    backgroundColor?: string;
    onConflict: string;
    /**
     * @additionalProperties true
     */
    assets?: {
        windows80Ie10Tile?: boolean;
        /**
         * @additionalProperties true
         */
        windows10Ie11EdgeTiles?: {
            small?: boolean;
            medium?: boolean;
            big?: boolean;
            rectangle?: boolean;
        };
    };
}

export interface CoastDesign {
    pictureAspect?: 'noChange' | 'backgroundAndMargin';
    backgroundColor?: string;
    margin?: number | string;
}


export interface OpenGraphDesign {
    pictureAspect?: 'noChange' | 'backgroundAndMargin';
    backgroundColor?: string;
    margin?: number | string;
    ratio?: string;
}

export interface FirefoxAppDesign {
    pictureAspect?: 'noChange' | 'circle';
    keepPictureInCircle?: string | boolean;
    circleInnerMargin?: string;
    backgroundColor?: string;
    margin?: number | string;
    /**
     * @additionalProperties true
     */
    manifest?: {
        appName?: string;
        appDescription?: string;
        developerName?: string;
        developerUrl?: string;
    };
}


export interface YandexBrowserDesign {
    backgroundColor?: string;
    /**
     * @additionalProperties true
     */
    manifest?: {
        showTitle?: boolean;
        version?: string;
    };
}

export interface IconDesign {
    androidChrome?: AndroidChromeDesign | boolean;
    ios?: IoSDesign | boolean;
    safariPinnedTab?: SafariPinnedTabDesign | boolean;
    windows?: WindowsDesign | boolean;
    desktopBrowser?: {} | boolean;
    coast?: CoastDesign | boolean;
    openGraph?: OpenGraphDesign | boolean;
    firefoxApp?: FirefoxAppDesign | boolean;
    yandexBrowser?: YandexBrowserDesign | boolean;
}

/**
 * Favicons config
 * @additionalProperties false
 */
export interface FaviconsConfig {
    /**
     * Link to schema.
     */
    $schema?: string;
    /**
     * Your API key. Register at {@link https://realfavicongenerator.net/api/#register_key realfavicongenerator.net}
     */
    apiKey?: string;
    /**
     * Your source logo.
     */
    masterPicture?: string | MasterPicture;
    /**
     * The output folder for all generated image files.
     * @default icons-[hash]/
     */
    iconsPath?: string;
    /**
     * The background color.
     */
    backgroundColor?: string;
    /**
     * The app name.
     */
    appName?: string;
    /**
     * The app description.
     */
    appDescription?: string;
    /**
     * The developer url.
     */
    developerUrl?: string;
    /**
     * The developer name.
     */
    developerName?: string;
    /**
     * The default locale language.
     */
    lang?: string;
    /**
     * The language direction 'ltr' or 'rtl'.
     */
    dir?: string;
    /**
     * Your application's version number.
     */
    version?: string;

    /**
     * See {@link https://realfavicongenerator.net/api/non_interactive_api#favicon_design Non-interactive API}
     * Use lower-camel case instead.
     *
     */
    design?: IconDesign;
    /**
     * See {@link https://realfavicongenerator.net/api/non_interactive_api#settings Non-interactive API}
     * Use lower-camel case instead.
     */
    settings?: {
        compression?: string;
        scalingAlgorithm?: string;
        errorOnImageTooSmall?: boolean;
    };
    /**
     * See {@link https://realfavicongenerator.net/api/non_interactive_api#versioning Non-interactive API}
     * Use lower-camel case instead.
     */
    versioning?: boolean | {
        paramName: string;
        paramValue: string;
    };

    /**
     * Set true for enabling cache.
     * @default true
     */
    cache?: boolean;
    /**
     * If true, generate favicons using realfavicongenerator.net.
     * @default true
     */
    online?: boolean;
    /**
     * If true, when online generation failed, try to generate offline.
     * @default true
     */
    fallbackOffline?: boolean;
    /**
     * If true, copy 'favicon.ico' file to root output directory.
     * @default true
     */
    emitFaviconIcoToOutDirRoot?: boolean;
}
