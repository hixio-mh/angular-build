/**
 * The project config base
 * @additionalProperties false
 */
export interface ProjectConfigBase {
    /**
     * The project type.
     */
    projectType?: 'app' | 'lib';
    /**
     * The root src folder of your project. E.g. 'src' or 'lib' or 'client' or 'packages/core'.
     * Usually 'srcDir' is refer to a folder containing your typescript source files.
     * If not specified and main entry is present, default to directory of main entry,
     * otherwise, current working directory is used.
     */
    srcDir?: string;
    /**
     * The output directory for build results.
     * If not specified, default to ./dist folder.
     * If not specified and 'srcDir' is libs/core, then 'outDir' will be dist/core.
     */
    outDir?: string;
    /**
     * The main entry file to be bundled.
     */
    entry?: string;
    /**
     * The output bundle file name for main entry.
     */
    outFileName?: string;
    /**
     * The typescript configuration file.
     * @default tsconfig.json
     */
    tsconfig?: string;
    /**
     * List of assets to be copied to 'outDir'.
     * @default []
     */
    assets?: (string | AssetEntry)[];
    /**
     * List of global style entries to be transpiled and copied to 'outDir'.
     * Default supported styles are .css, .scss/.sass and .less.
     * @default []
     */
    styles?: (string | StyleEntry)[];
    /**
     * If true, sourcemaps will be generated.
     */
    sourceMap?: boolean;
    /**
     * If true, minified files will be generated.
     */
    minify?: boolean;
    /**
     * Banner text or file name to add at the top of each generated bundle files.
     * For example, 'banner.txt'.
     */
    banner?: string;
    /**
     * Options to pass to style preprocessors
     */
    stylePreprocessorOptions?: StylePreprocessorOptions;
    /**
     * Bundle module format.
     */
    libraryTarget?: LibraryTarget;
    /**
     * The libraryName is used depending on the value of the 'libraryTarget' options.
     */
    libraryName?: string;
    /**
     * The externals configuration option provides a way of excluding dependencies from the output bundle.
     */
    externals?: ExternalsEntry | ExternalsEntry[];
    /**
     * Tells the build system which platform environment the application is targeting.
     * This is only used by webpack.
     */
    platformTarget?:
    'async-node'
    | 'electron-main'
    | 'electron-renderer'
    | 'node'
    | 'node-webkit'
    | 'web'
    | 'webworker';
    /**
     * This option controls if and how source maps are generated.
     * This is only used by webpack's devTool.
     */
    sourceMapDevTool?: 'eval' | 'inline-source-map' | 'cheap-eval-source-map' | 'cheap-source-map' |
    'cheap-module-eval-source-map' | 'cheap-module-source-map' | 'eval-source-map' | 'source-map' |
    'nosources-source-map' | 'hidden-source-map' | 'nosources-source-map' | '@eval' | '@inline-source-map' |
    '@cheap-eval-source-map' | '@cheap-source-map' | '@cheap-module-eval-source-map' | '@cheap-module-source-map' |
    '@eval-source-map' | '@source-map' | '@nosources-source-map' | '@hidden-source-map' | '@nosources-source-map' |
    '#eval' | '#inline-source-map' | '#cheap-eval-source-map' | '#cheap-source-map' | '#cheap-module-eval-source-map' |
    '#cheap-module-source-map' | '#eval-source-map' | '#source-map' | '#nosources-source-map' | '#hidden-source-map' |
    '#nosources-source-map' | '#@eval' | '#@inline-source-map' | '#@cheap-eval-source-map' | '#@cheap-source-map' |
    '#@cheap-module-eval-source-map' | '#@cheap-module-source-map' | '#@eval-source-map' | '#@source-map' |
    '#@nosources-source-map' | '#@hidden-source-map' | '#@nosources-source-map' | boolean;

    /**
     * Whether to resolve symlinks to their symlinked location.
     * This is only used by webpack.
     */
    preserveSymlinks?: boolean;
    /**
     * Webpack Bundle analyzer options.
     * This is only used by webpack.
     */
    bundleAnalyzerOptions?: BundleAnalyzerOptions;
    /**
     * Replaces resources with new resources.
     * This is only used by webpack.
     */
    moduleReplacements?: ModuleReplacementEntry[];
    /**
     * Custom webpack config file to be merged. Path will be resolved to project root.
     */
    webpackConfig?: string;
    /**
     * If true, only custom webpack config is processed.
     */
    disableDefaultWebpackConfigs?: boolean;
    /**
     * Typescript loader for webpack.
     * This is only used by webpack.
     */
    tsLoader?: 'auto' | '@ngtools/webpack';
    /**
     * The webpack stats option lets you precisely control what bundle information gets displayed.
     * This is only used by webpack.
     */
    stats?: WebpackStatsPreset | WebpackStatsToStringOptions;
    /**
     * If true, this config will be skipped by the build process.
     */
    skip?: boolean;
}

/**
 * The project config
 * @additionalProperties false
 */
export interface ProjectConfig extends ProjectConfigBase {
    /**
     * The ref name for this project config.
     */
    name?: string;
    /**
     * Extends the project config from another one. Use the name property of another project config.
     */
    extends?: string;
}

/**
 * The library project config
 * @additionalProperties false
 */
export interface LibProjectConfigBase extends ProjectConfigBase {
    /**
     * Typescript transpilation configurations.
     */
    tsTranspilations?: TsTranspilation | TsTranspilation[];
    /**
     * If true, default Angular and RxJs global module names are added as externals.
     * @default true
     */
    includeAngularAndRxJsExternals?: boolean;
    /**
     * Bundle target options.
     */
    bundleTargets?: BundleTarget | BundleTarget[];
    /**
     * Bundle tool used for .
     * @default rollup
     */
    bundleTool?: 'rollup' | 'webpack';
    /**
     * Packaging options for library project.
     */
    packageOptions?: PackageOptions;
}

/**
 * The library project config
 * @additionalProperties false
 */
export interface LibProjectConfig extends LibProjectConfigBase, ProjectConfig {
    /**
     * To override properties based on build target environments.
     */
    envOverrides?: {
        dev?: LibProjectConfigBase;
        prod?: LibProjectConfigBase;
    } | { [name: string]: LibProjectConfigBase };
}

/**
 * The application project config base
 * @additionalProperties false
 */
export interface AppProjectConfigBase extends ProjectConfigBase {
    /**
     * Global script entries.
     * @default []
     */
    scripts?: (string | ScriptEntry)[];
    /**
     * The polyfill entries for app. If entry ends with .ts, path will be resolved from app root, otherwise from project root.
     * @default []
     */
    polyfills?: string | string[];
    /**
     * The output chunk name for polyfills.
     * @default polyfills
     */
    polyfillsChunkName?: string;
    /**
     * The vendor module entries for dll bundle. If entry ends with .ts, path will be resolved from app root, otherwise from project root.
     * @default []
     */
    dlls?: (string | DllEntry)[];
    /**
     * If true, requested modules started with node_modules path are chunk into [vendorChunkName].js.
     */
    vendorChunk?: boolean;
    /**
     * The output chunk name for vendor or dll chunk.
     * @default vendor
     */
    vendorChunkName?: string;
    /**
     * Additional module paths to be chunk into vendor. Paths are relative to srcDir.
     */
    vendorChunkPaths?: string[];
    /**
     * If true, chunk main into [inlineChunkName].js.
     */
    inlineChunk?: boolean;
    /**
     * The output chunk name for inline.
     * @default inline
     */
    inlineChunkName?: string;
    /**
     *  To load global modules automatically  with alias key.
     */
    globalProvides?: { [key: string]: string };
    /**
     * The html injection options.
     */
    htmlInjectOptions?: HtmlInjectOptions;
    /**
     * The favicon configuration file.
     */
    faviconConfig?: string;
    /**
     * The url where files will be deployed.
     * @default /
     */
    publicPath?: string;
    /**
     * The base URL for all relative URLs on a page.
     */
    baseHref?: string;
    /**
     * To consume  dll bundle created by the dll build.
     */
    referenceDll?: boolean;
    /**
     * Appends version hash to the output bundled files.
     */
    appendOutputHash?: boolean;
    /**
     * Specifies a list of files to be excluded from javascript source map loader. Paths will be resolved to project root.
     */
    jsSourceMapExcludes?: string[];
    /**
     * If true, build process will extracts css specified in styles entry as styles.css.
     */
    extractCss?: boolean;
    /**
     *  Allows you to create global constants which can be configured at compile time.
     */
    globalConstants?: { [key: string]: any };
    /**
     * Performance options for application project.
     */
    performanceOptions?: PerformanceOptions;
}

/**
 * The application project config
 * @additionalProperties false
 */
export interface AppProjectConfig extends AppProjectConfigBase, ProjectConfig {
    /**
     * To override properties based on build targets.
     */
    envOverrides?: {
        dll?: AppProjectConfigBase;
        dev?: AppProjectConfigBase;
        prod?: AppProjectConfigBase;
        aot?: AppProjectConfigBase;
        test?: AppProjectConfigBase;
        universal?: AppProjectConfigBase;
    } |
    { [name: string]: AppProjectConfigBase };
}

/**
 * Library target
 */
export type LibraryTarget = 'iife' | 'commonjs' | 'commonjs2' | 'amd' | 'umd' | 'es';

/**
 * Typescript transpile options
 * @additionalProperties false
 */
export interface TsTranspilation {
    /**
     * Name for describing or referencing this transpilation.
     */
    name?: string;
    /**
     * Typescript configuration file for this transpilation.
     */
    tsconfig?: string;
    /**
     * Specifies ECMAScript target version.
     */
    target?: 'es5' | 'es6' | 'es2015' | 'es2016' | 'es2017' | 'esnext';
    /**
     * Specifies module code generation.
     */
    module?: 'none' | 'amd' | 'commonjs' | 'es2015' | 'es6' | 'system' | 'umd';
    /**
     * Generate corresponding d.ts file.
     */
    declaration?: boolean;
    /**
     * No emit output.
     */
    noEmit?: boolean;
    /**
     * Output directory for this transpilation. Path will be relative to outDir of library project config.
     */
    outDir?: string;
    /**
     * If true, templateUrl and styleUrls resources are copy into output locations.
     * @default true
     */
    copyTemplateAndStyleUrls?: boolean;
}

/**
 * Bundle target options
 * @additionalProperties false
 */
export interface BundleTarget {
    /**
     * Name for describing or referencing this target.
     */
    name?: string;
    /**
     * Custom entry resolution for bundling. If not specified, main entry is used.
     */
    entryResolution?: {
        /**
         * Entry resolution root directory.
         */
        entryRoot: 'tsTranspilationOutDir' | 'bundleTargetOutDir' | 'outDir';
        /**
         * If 'tsTranspilations' is array, name or array index can be specified.
         * If not specified, first item will be used.
         */
        tsTranspilationIndex?: number | string;
        /**
         * If 'bundleTargets' is array, name or array index can be specified.
         * If not specified, previous item will be used.
         */
        bundleTargetIndex?: number | string;
    };
    /**
     * Custom main entry file name, if not present, main entry will be used.
     * If 'entryResolution' is present, path will be resolved from 'entryResolution.entryRoot'.
     */
    entry?: string;
    /**
     * Bundle module format.
     */
    libraryTarget?: LibraryTarget;
    /**
     * Custom bundle output file name.
     */
    outFileName?: string;
    /**
     * Custom output directory for bundled results.
     */
    outDir?: string;
    /**
     * Adds `@__PURE__` annotation comments to IIFEs for library bundle with es5 target and umd format.
     */
    addPureAnnotations?: boolean;
    /**
     * Transforms entry file or bundled result to specific ECMA script target.
     * @default none
     */
    scriptTarget?: 'none' | 'es5';
    /**
     * If true, the process will perform script target transformation only.
     * @default false
     */
    transformScriptTargetOnly?: boolean;
    /**
     * If true, templateUrl and styleUrls will be inlined.
     * @default true
     */
    inlineResources?: boolean;
}

/**
 * Packaging options for library project
 * @additionalProperties false
 */
export interface PackageOptions {
    /**
     * The source package.json file to be updated and copied.
     */
    packageConfigFile?: string;
    /**
     * Module main fields
     */
    mainFields: {
        /**
         * The main index for package.json file.
         */
        main?: string;
        /**
         * The esm module index for package.json file.
         */
        module?: string;
        /**
         * The es2015 module index for package.json file.
         */
        es2015?: string;
        /**
         * The typings index for package.json file.
         */
        typings?: string;
    } & { [key: string]: string };
    /**
     * Custom destination directory for 'package.json'.
     */
    outDir?: string;
    /**
     * If true, update version in package.json with project root package.json's version.
     * @default true
     */
    useRootPackageConfigVerion?: boolean;
}

/**
 * External module entry
 */
export type ExternalsEntry = string | ExternalsObjectElement;

/**
 * External object element
 */
export type ExternalsObjectElement = {
    [key: string]: boolean |
                   string |
                   {
                       commonjs: string;
                       amd: string;
                       root: string;
                       [key: string]: string | boolean;
                   };
};

/**
 * Module replacement entry
 * @additionalProperties false
 */
export interface ModuleReplacementEntry {
    resourcePath: string;
    newResourcePath: string;
    resolveFrom?: 'projectRoot' | 'srcDir';
}

/**
 * Style preprocessor options
 * @additionalProperties false
 */
export interface StylePreprocessorOptions {
    /**
     * An array of paths that LibSass can look in to attempt to resolve your @import declarations.
     * @default []
     */
    includePaths: string[];
}

/**
 * Webpack Stats presets
 */
export type WebpackStatsPreset
    = boolean
      | 'errors-only'
      | 'minimal'
      | 'none'
      | 'normal'
      | 'verbose';

/**
 * Webpack Stats toJson options
 */
export interface WebpackStatsToJsonOptions {
    /** Add asset Information */
    assets?: boolean;
    /** Sort assets by a field */
    assetsSort?: string;
    /** Add information about cached (not built) modules */
    cached?: boolean;
    /** Add children information */
    children?: boolean;
    /** Add built modules information to chunk information */
    chunkModules?: boolean;
    /** Add the origins of chunks and chunk merging info */
    chunkOrigins?: boolean;
    /** Add chunk information (setting this to `false` allows for a less verbose output) */
    chunks?: boolean;
    /** Sort the chunks by a field */
    chunksSort?: string;
    /** Context directory for request shortening */
    context?: string;
    /** Add details to errors (like resolving log) */
    errorDetails?: boolean;
    /** Add errors */
    errors?: boolean;
    /** Add the hash of the compilation */
    hash?: boolean;
    /** Add built modules information */
    modules?: boolean;
    /** Sort the modules by a field */
    modulesSort?: string;
    /** Add public path information */
    publicPath?: boolean;
    /** Add information about the reasons why modules are included */
    reasons?: boolean;
    /** Add the source code of modules */
    source?: boolean;
    /** Add timing information */
    timings?: boolean;
    /** Add webpack version information */
    version?: boolean;
    /** Add warnings */
    warnings?: boolean;
}

/**
 * Webpack Stats toString options
 */
export interface WebpackStatsToStringOptions extends WebpackStatsToJsonOptions {
    /** `webpack --colors` equivalent */
    colors?: boolean;
}

/**
 * Webpack bundle analyzer options
 * @additionalProperties false
 */
export interface BundleAnalyzerOptions {
    /**
     * If true, generate analyzer report.
     * @default false
     */
    generateAnalyzerReport?: boolean;
    /**
     * Path to bundle report file that will be generated in `static` mode.
     * Relative to bundles output directory.
     * @default stats-report.html
     */
    reportFilename?: string;
    /**
     * If true, automatically open report in default browser.
     * @default true
     */
    openAnalyzer?: boolean;
    /**
     * If `true`, Webpack Stats JSON file will be generated in bundles output directory.
     * @default false
     */
    generateStatsFile?: boolean;
    /**
     * Name of Webpack Stats JSON file that will be generated if `generateStatsFile` is `true`.
     * Relative to bundles output directory.
     *  @default stats.json
     */
    statsFilename?: string;
    /**
     * The stats option lets you precisely control what bundle information gets displayed by the analyzer.
     */
    statsOptions?: WebpackStatsToJsonOptions;
}

/**
 * The asset entry
 * @additionalProperties false
 */
export type AssetEntry = {
    /**
     * The source file, it can be absolute or relative path or glob pattern.
     */
    from: string;
    /**
     * The output root.
     */
    to?: string;
};

/**
 * Global style entry
 * @additionalProperties false
 */
export type StyleEntry = {
    /**
     * The source style file, it can be .scss/.sass, .less or .css
     */
    from: string;
    /**
     * The output style file name.
     */
    to?: string;
};

/**
 * Global script entry
 * @additionalProperties false
 */
export type ScriptEntry = {
    /**
     * The source Javascript file
     */
    from: string;
    /**
     * The output script file name.
     */
    to?: string;
    /**
     * If true, it will be lazy loaded, and will not be injected to target html.
     */
    lazy?: boolean;
};

/**
 * Dll entry
 * @additionalProperties false
 */
export type DllEntry = {
    entry: string | string[];
    importToMain?: boolean;
    excludes?: string[];
};

/**
 * Html injection options
 * @additionalProperties false
 */
export interface HtmlInjectOptions {
    /**
     * The index html template file.
     */
    index?: string;
    indexOut?: string;
    scriptsOut?: string;
    stylesOut?: string;
    iconsOut?: string;
    customTagAttributes?: {
        tagName: string;
        attribute: { [key: string]: string | boolean };
        skipOutFilters?: string[];
    }[];
}

/**
 * Webpack performance options
 * @additionalProperties false
 */
export interface PerformanceOptions {
    /**
     * Turns hints on/off. In addition, tells webpack to throw either an error or a warning when hints are
     * found. This property is set to "warning" by default.
     */
    hints?: 'warning' | 'error' | boolean;
    /**
     * An asset is any emitted file from webpack. This option controls when webpack emits a performance hint
     * based on individual asset size. The default value is 250000 (bytes).
     */
    maxAssetSize?: number;
    /**
     * An entrypoint represents all assets that would be utilized during initial load time for a specific entry.
     * This option controls when webpack should emit performance hints based on the maximum entrypoint size.
     * The default value is 250000 (bytes).
     */
    maxEntrypointSize?: number;
}

/**
 * Webpack watch options
 * @additionalProperties false
 */
export interface WebpackWatchOptions {
    /**
     * Add a delay before rebuilding once the first file changed. This allows webpack to aggregate any other
     * changes made during this time period into one rebuild.
     * Pass a value in milliseconds. Default: 300.
     */
    aggregateTimeout?: number;
    /**
     * For some systems, watching many file systems can result in a lot of CPU or memory usage.
     * It is possible to exclude a huge folder like node_modules.
     * It is also possible to use anymatch patterns.
     */
    ignored?: string;
    /** Turn on polling by passing true, or specifying a poll interval in milliseconds. */
    poll?: boolean | number;
}

/**
 * Build options
 * @additionalProperties true
 */
export interface BuildOptions {
    /**
     * Project filter to build only specific app(s) or lib(s). Specifies target app or lib project name(s).
     */
    filter?: string | string[];
    /**
     * If true, the console displays detailed diagnostic information.
     * @default false
     */
    verbose?: boolean;
    /**
     * Set true for production build target.
     */
    production?: boolean;
    /**
     * Build target environments.
     */
    environment?: {
        aot?: boolean;
        dev?: boolean;
        dll?: boolean;
        prod?: boolean;
        test?: boolean;
    } & { [key: string]: string | boolean; };
}

/**
 * Angular build config schema
 * @additionalProperties true
 */
export interface AngularBuildConfig {
    /**
     * The library project configs.
     */
    libs?: LibProjectConfig[];
    /**
     * The application project configs.
     */
    apps?: AppProjectConfig[];
    /**
     * Build options.
     */
    buildOptions?: BuildOptions;
    /**
     * Webpack watch options.
     */
    webpackWatchOptions?: WebpackWatchOptions;
}
