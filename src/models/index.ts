/**
 * @additionalProperties false
 */
export interface AppConfigOverridable {
    /**
     * The root directory of app.
     */
    root?: string;
    /**
     * The output directory of bundled assets.
     */
    outDir?: string;
    /**
     * The entry for app main bootstrap file.
     */
    main?: string;
    /**
     * The entries for app polyfills to be imported to the main entry.
     * @default []
     */
    polyfills?: string | string[];
    /**
     * The entries for dll bundle.
     * @default []
     */
    dlls?: (string | DllEntry)[];
    /**
     * The output chunk name for dll bundle.
     * @default vendor
     */
    dllChunkName?: string;
    /**
     * The asset entries to be copied to output directory.
     * @default []
     */
    assets?: (string | AssetEntry)[];
    /**
     * Global script entries to be included in the build. Supported styles are .css, .scss, .less and .stylus.
     * @default []
     */
    styles?: (string | GlobalScopedEntry)[];
    /**
     * Script entries to be added to the global scope.
     * @default []
     */
    scripts?: (string | GlobalScopedEntry)[];
    /**
     *  To automatically load modules with alias key.
     */
    provide: { [key: string]: string };
    /**
     * The index html template file.
     */
    index?: string;
    /**
     * The html injection options.
     */
    htmlInjectOptions?: HtmlInjectOptions;
    /**
     * The favicon configuration file.
     * @default favicon-config.json
     */
    faviconConfig?: string;
    /**
     * The typescript configuration file.
     * @default tsconfig.json
     */
    tsconfig?: string;
    /**
     * The public url address of the output files.
     */
    publicPath?: string;
    /**
     * To reference dll.
     */
    referenceDll?: boolean;
    /**
     * Replaces resources that matches resourceRegExp with newResource.
     */
    moduleReplacements?: ModuleReplacementEntry[];
    /**
     * Appends version hash to the ouput bundled files.
     */
    appendOutputHash?: boolean;
    /**
     * Generates sourcemaps.
     */
    sourceMap?: boolean;
    /**
     * Extracts css.
     */
    extractCss?: boolean;
    /**
     * Compress assets.
     */
    compressAssets?: boolean;
    /**
     * Skips copying assets.
     */
    skipCopyAssets?: boolean;
    /**
     * Skips generating icons.
     */
    skipGenerateIcons?: boolean;
    /**
     * To skip this app config when bundling.
     */
    skip?: boolean;
    /**
     * Options to pass to style preprocessors
     */
    stylePreprocessorOptions?: StylePreprocessorOptions;

    test?: string;
    /**
     * i18n file.
     */
    i18nFile?: string;
    /**
     * i18n format.
     */
    i18nFormat?: string;
    /**
     * Locale.
     */
    locale?: string;
    /**
     *  AoT resource override path.
     */
    aotResourceOverridePath?: string;
}

/**
 * The app config.
  * @additionalProperties false
 */
export interface AppConfig extends AppConfigOverridable {
    /**
     * Name for app config.
     */
    name?: string;
    /**
     * Extends the app config from another one. Use the name of another app config.
     */
    extends?: string,
    /**
     * Tells the build system which environment the application is targeting.
     * @default web
     */
    target?: 'async-node'
    | 'electron'
    | 'electron-renderer'
    | 'node'
    | 'node-webkit'
    | 'node-webkit'
    | 'web'
    | 'webworker';

    /**
     * To override properties based on build targets.
     */
    //buildTargetOverrides: { [name: string]: { [key: string]: any } };
    buildTargetOverrides: {
        dev?: AppConfigOverridable;
        prod?: AppConfigOverridable;
        dll?: AppConfigOverridable;
        aot?: AppConfigOverridable;
    };
    /**
     * The optin to select environment file to be used with build target - dev or prod.
     */
    environments?: { [key: string]: string };
}

/**
 * @additionalProperties false
 */
export type AssetEntry = {
    /**
     * The source file, it can be absolute or relative path or glob pattern.
     */
    from: string | {
        glob: string;
        dot?: boolean;
    };
    /**
     * The output root if from is file or dir.
     */
    to?: string;
    /**
     * 'file' if to has extension or from is file.
     * 'dir' if from is directory, to has no extension or ends in '/'.
     */
    toType?: string;
    /**
     * A path that determines how to interpret the from path.
     */
    context?: string;
    /**
     * Removes all directory references and only copies file names.
     * @default false
     */
    flatten?: boolean;
    /**
     * Additional globs to ignore for this pattern.
     */
    ignore?: string[];
    /**
     * Overwrites files already in compilation.assets (usually added by other plugins).
     * @default false
     */
    force?: boolean;
};

export type GlobalScopedEntry = {
    input: string;
    output?: string;
    lazy?: boolean;
    path?: string;
    entry?: string;
}

export type DllEntry = {
    entry: string | string[];
    importToMain?: boolean;
    excludes?: string[];
}

export type ModuleReplacementEntry = {
    resourceRegExp: string;
    newResource?: string;
}

export type HtmlInjectOptions = {
    indexOutFileName?: string;
    stylesOutFileName?: string;
    iconsOutFileName?: string;
    customTagAttributes?: {
        tagName: string;
        attribute: { [key: string]: string | boolean };
    }[];
}

export type StylePreprocessorOptions = {
    /**
     * "Paths to include. Paths will be resolved to project root."
     * @default []
     */
    includePaths: string[];
}

/**
 * Angular build config schema.
  * @additionalProperties true
 */
export interface AngularBuildConfig {
    /**
     * Properties of the different applications in this project.
      * @minItems 1
     */
    apps: AppConfig[];
    /**
     * Build options
     */
    buildOptions?: BuildOptions;
}

/**
 * Build options.
 * @additionalProperties false
 */
export interface BuildOptions {
    /**
     * The 'angular-build.json' oar 'angular-cli.json' config file path.
     */
    configFilePath?: string;
    /**
     * To build only specific app. Use app's name.
     */
    app?: string | string[];
    /**
     * Shows progress.
     */
    progress?: boolean;
    /**
     * If true, the console displays detailed diagnostic information.
     * @default false
     */
    verbose?: boolean;
    /**
     * Show performance hints.
     * @default false
     */
    performanceHint?: boolean;
    /**
     * Set true for production.
     */
    production?: boolean;
    /**
     * Set true for dll build.
     */
    dll?: boolean;
    /**
     * Set true for aot build.
     */
    aot?: boolean;
    /**
     * To reference dlls for all apps.
     */
    referenceDll?: boolean;
    /**
     * Appends version hash to the ouput bundled files.
     */
    appendOutputHash?: boolean;
    /**
     * Generates sourcemaps.
     */
    sourceMap?: boolean;
    /**
     * Extracts css.
     */
    extractCss?: boolean;
    /**
     * Compress assets.
     */
    compressAssets?: boolean;
    /**
     * Skips copying assets.
     */
    skipCopyAssets?: boolean;
    /**
     * Skips generating icons.
     */
    skipGenerateIcons?: boolean;
}