/**
 * @additionalProperties false
 */
export interface AppConfigOverridable {
    /**
     * The root directory of the app.
     */
    root?: string;
    /**
     * The output directory for build results.
     */
    outDir?: string;
    /**
     * The main entry for the app.
     */
    main?: string;
    /**
   * The name of the test entry-point file.
   */
    test?: string;
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
     * If true, chunk into 'inline.js'
     */
    inlineChunk?: boolean;
    /**
     * If true, chunk into 'inline.js'
     */
    vendorChunk?: boolean;
    /**
     * List of application assets.
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
    provide?: { [key: string]: string };
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
    /**
     * The environment file for the build target.
     */
    environmentFile?: string;
    /**
     * Experimental support for a service worker from @angular/service-worker.
     */
    serviceWorker?: boolean;
    /**
     * Custom webpack config.
     */
    webpackConfig?: string;
    /**
     * If true, only custom webpack config is processed.
     */
    disableDefaultWebpackConfigs?: boolean;
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
    target?:
    'async-node'
    | 'electron-main'
    | 'electron-renderer'
    | 'node'
    | 'node-webkit'
    | 'web'
    | 'webworker';

    /**
     * To override properties based on build targets.
     */
    buildTargetOverrides?: {
        dll?: AppConfigOverridable;
        dev?: AppConfigOverridable;
        prod?: AppConfigOverridable;
        aot?: AppConfigOverridable;
        test?: AppConfigOverridable;
    } | { [name: string]: AppConfigOverridable };

    /**
     * Source file for environment config.
     */
    environmentSource?: string;
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
};

/**
 * Global scoped entry.
 * @additionalProperties true
 */
export type GlobalScopedEntry = {
    input: string;
    output?: string;
    lazy?: boolean;
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
    scriptsOutFileName?: string;
    stylesOutFileName?: string;
    iconsOutFileName?: string;
    customTagAttributes?: {
        tagName: string;
        attribute: { [key: string]: string | boolean };
        filter?: string[];
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
     * Build options.
     */
    buildOptions?: BuildOptions;
    /**
     * Test options.
     */
    test?: TestOptions;
}

/**
 * Build options.
 * @additionalProperties false
 */
export interface BuildOptions {
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
     * Set true for production build target.
     */
    production?: boolean;
    /**
     * Set true for AoT build target.
     */
    aot?: boolean;
    /**
     * Set true for Dll build target.
     */
    dll?: boolean;
    /**
   * Set true for test build target.
   */
    test?: boolean;
    /**
     * Additional build target environment.
     */
    environment?: { [key: string]: string };
    /**
     * Typescript webpack tool
     */
    typescriptWebpackTool?: '@ngtools/webpack' | 'default';
    /**
     * To reference dlls for all apps.
     */
    referenceDll?: boolean;
    /**
     * Appends version hash to the ouput files.
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
     * Skips copying assets.
     */
    skipCopyAssets?: boolean;
    /**
     * Skips generating icons.
     */
    skipGenerateIcons?: boolean;
}


/**
 * Test options.
 * @additionalProperties false
 */
export interface TestOptions {
    /**
      * Default test app name.
      */
    defaultTestApp?: string;
    /**
     * Generate code ceverage report
     */
    codeCoverage?: boolean | {
        exclude?: string[];
        disabled?:boolean;
    };
}
