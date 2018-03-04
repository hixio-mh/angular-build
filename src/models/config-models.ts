
import { FaviconsConfig } from './favicons-config-models';

/**
 * @additionalProperties false
 */
export interface ProjectConfigBase {
    /**
     * The output directory for build results.
     * @example
     * 'dist', 'wwwroot'.
     */
    outDir: string;
    /**
     * Tells the build system which platform environment the application is targeting.
     * Also check out {@link https://webpack.js.org/concepts/targets Webpack}.
     */
    platformTarget?: 'web' | 'node';
    /**
     * Clean options.
     */
    clean?: CleanOptions | boolean;
    /**
     * Copy options.
     */
    copy?: (string | AssetEntry)[];
    /**
     * If true, sourcemaps will be generated.
     */
    sourceMap?: boolean;
    /**
     * Banner text to add at the top of each generated bundle files. It can be text file name or raw text.
     * @example
     * 'banner.txt'.
     */
    banner?: string;
    /**
     * If true, this project config will be skipped by the build process.
     */
    skip?: boolean;
}

/**
 * @additionalProperties false
 */
export interface ProjectConfig extends ProjectConfigBase {
    /**
     * The config name.
     */
    name?: string;
    /**
     * Extends from another project config by using the 'name' property.
     */
    extends?: string;
    /**
     * The root folder containing your typescript source files.
     * @example
     * 'src', 'ClientApp', 'modules/core'.
     */
    srcDir?: string;
}

/**
 * @additionalProperties false
 */
export interface LibProjectConfigBase extends ProjectConfigBase {
    /**
     * List of global style entries.
     * Default supported styles are .css and .scss/.sass.
     * @additionalProperties false
     */
    styles?: (string | {
        /**
         * The source style file, it can be .scss/.sass, .less or .css
         */
        input: string;
        /**
         * The output style file name.
         */
        to?: string;
    })[];
    /**
     * Options to pass to style preprocessors.
     */
    stylePreprocessorOptions?: StylePreprocessorOptions;
    /**
     * Typescript transpilation options.
     */
    tsTranspilation?: TsTranspilationOptions;
    /**
     * Bundle target options.
     */
    bundles?: BundleOptions[];
    /**
     * The externals configuration option provides a way of excluding dependencies from the output bundle.
     */
    externals?: ExternalsEntry | ExternalsEntry[];
    /**
     * Packaging options.
     */
    packageOptions?: PackageOptions;
}

/**
 * @additionalProperties false
 */
export interface LibProjectConfig extends LibProjectConfigBase, ProjectConfig {
    /**
     * The library name.
     */
    libraryName?: string;
    /**
     * To override properties based on build target environments.
     */
    envOverrides?: { [name: string]: LibProjectConfigBase };
}

/**
 * @additionalProperties false
 */
export interface AppProjectConfigBase extends ProjectConfigBase {
    /**
     * List of global style entries.
     * Default supported styles are .css and .scss/.sass.
     */
    styles?: (string | GlobalEntry)[];
    /**
     * Options to pass to style preprocessors.
     */
    stylePreprocessorOptions?: StylePreprocessorOptions;
    /**
     * Global script entries.
     * @default []
     */
    scripts?: (string | GlobalEntry)[];
    /**
     * Polyfill entries.
     */
    polyfills?: string[] | string;
    /**
     * The vendor module entries for dll bundle.
     */
    dlls?: string[] | DllOptions;
    /**
     * Module format for bundling.
     */
    libraryTarget?: 'var' | 'iife' | 'cjs' | 'commonjs' | 'commonjs2' | 'amd' | 'umd';
    /**
     * The main typescript entry file to be bundled.
     */
    entry?: string;
    /**
     * If true, the build process will use awesome-typescript-loader.
     */
    useLegacyTsLoader?: boolean;
    /**
     * The typescript configuration file to be used.
     * @default tsconfig.json
     */
    tsconfig?: string;
    /**
     * If true, requested modules started with node_modules path are chunk into [vendorChunkName].js.
     */
    vendorChunk?: boolean;
    /**
     * If true, chunk a separate bundle containing common code used across multiple bundles.
     */
    commonChunk?: boolean;
    /**
     * The output chunk name for main entry.
     * @default main
     */
    mainChunkName?: string;
    /**
     * The output chunk name for polyfills.
     * @default polyfills
     */
    polyfillsChunkName?: string;
    /**
     * The output chunk name for vendor or dll chunk.
     * @default vendor
     */
    vendorChunkName?: string;
    /**
     *  To load global modules automatically  with alias key.
     */
    provides?: { [key: string]: any };
    /**
     * The html injection options.
     */
    htmlInject?: HtmlInjectOptions;
    /**
     * The favicons configuration file or object.
     */
    favicons?: string | FaviconsConfig;
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
     * To consume dll bundle created by the dll build.
     */
    referenceDll?: boolean;
    /**
     * Appends version hash to output bundles.
     */
    bundlesHash?: boolean;
    /**
     * Appends version hash to output chunks.
     */
    chunksHash?: boolean;
    /**
     * Appends version hash to output resources extracted by file-loader and url-loader.
     */
    extractedAssetsHash?: boolean;
    /**
     * If true, build process will extracts css specified in styles entry as styles.css.
     */
    extractCss?: boolean;
    /**
     *  Custom environment variables to be included in bundle.
     */
    environmentVariables?: boolean | { [key: string]: boolean | string };
    /**
     * Performance options.
     */
    performance?: PerformanceOptions;
    /**
     * List of additional NgModule files that will be lazy loaded (lazy router modules will be discovered automatically).
     */
    lazyModules?: string[];
    /**
     * Use file name for lazy loaded chunks.
     */
    nameLazyFiles?: boolean;
    /**
     * This option controls if and how source maps are generated.
     * Also check out {@link https://webpack.js.org/configuration/devtool Webpack}.
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
     * Customize the names used in each source map.
     * Also check out {@link https://webpack.js.org/configuration/output/#output-devtoolmodulefilenametemplate Webpack}.
     */
    sourceMapDevToolModuleFilenameTemplate?: '[absolute-resource-path]' | '[resource]' | '[resource-path]' | string;
    /**
     * A fallback used when the template string of 'sourceMapFilenameTemplate' yields duplicates.
     * Also check out {@link https://webpack.js.org/configuration/output/#output-devtoolfallbackmodulefilenametemplate Webpack}.
     */
    sourceMapDevToolFallbackModuleFilenameTemplate?: '[absolute-resource-path]' | '[resource]' | '[resource-path]' | string;
    /**
     * Custom webpack config file to be merged. Path will be resolved to angular-build.json file.
     */
    webpackConfig?: string;
    /**
     * Replaces resources with new resources.
     */
    moduleReplacements?: ModuleReplacementEntry[];
    /**
     * Webpack Bundle analyzer options.
     */
    bundleAnalyzer?: BundleAnalyzerOptions | boolean;
    /**
     * The webpack stats option - lets you precisely control what bundle information gets displayed.
     */
    stats?: WebpackStatsPreset | WebpackStatsToStringOptions;
    /**
     * The externals configuration option provides a way of excluding dependencies from the output bundle.
     */
    externals?: ExternalsEntry | ExternalsEntry[];
    /**
     * Custom Node.js resolution main fields.
     */
    nodeResolveFields?: string[];
    /**
     * Path to the translation file.
     */
    i18nFile?: string;
    /**
     * Import format if different from `i18nFormat`.
     */
    i18nFormat?: string;
    /**
     * Locale of the imported translations.
     */
    locale?: string;
    /**
     * How to handle missing messages.
     */
    missingTranslation?: 'error' | 'warning' | 'ignore';

    /**
     *  Path to the extracted message file.
     */
    i18nOutFile?: string;
    /**
     * Export format (xlf, xlf2 or xmb).
     */
    i18nOutFormat?: string;
    /**
     * Set true to enable scope hoisting.
     * Default true for production.
     */
    concatenateModules?: boolean;
    /**
     * Tell webpack what directories should be searched when resolving modules.
     */
    moduleRoots?: string[];
}

/**
 * @additionalProperties false
 */
export interface AppProjectConfig extends AppProjectConfigBase, ProjectConfig {
    /**
     * To override properties based on build targets.
     */
    envOverrides?: { [name: string]: AppProjectConfigBase };
}

export interface CleanOptions {
    /**
     * Before run clean option.
     */
    beforeRun?: BeforeRunCleanOptions;
    /**
     * After emit clean option.
     */
    afterEmit?: AfterEmitCleanOptions;
    /**
     * Allows cleaning outside of output directory.
     * @default false
     */
    allowOutsideOutputDir?: boolean;
    /**
     * Allows cleaning outside of output directory.
     */
    allowOutsideWorkingDir?: boolean;
}

export interface BeforeRunCleanOptions {
    cleanOutDir?: boolean;
    paths?: string[];
    exclude?: string[];
}

export interface AfterEmitCleanOptions {
    paths?: string[];
    exclude?: string[];
}

export interface ExternalsObjectElement {
    [key: string]: boolean |
    string |
    {
        commonjs: string;
        amd: string;
        root: string;
        [key: string]: string | boolean;
    };
}

export type ExternalsEntry = string | ExternalsObjectElement;

export interface StylePreprocessorOptions {
    /**
     * An array of paths that LibSass can look in to attempt to resolve your @import declarations.
     * @default []
     */
    includePaths: string[];
}

export interface AssetEntry {
    /**
     * The source file, it can be absolute or relative path or glob pattern.
     */
    from: string;
    /**
     * The output file name.
     */
    to?: string;
    /**
     * The ignore list.
     */
    exclude?: string[];
}

export interface TsTranspilationOptions {
    /**
     * The typescript configuration file to be used.
     * @default tsconfig.json
     */
    tsconfig: string;
    /**
     * If true, templateUrl and styleUrls resources are copy into output locations.
     */
    copyTemplateAndStyleUrls?: boolean;
    /**
     * If true, templateUrl and styleUrls resources of .metadata.json are inlined.
     */
    inlineMetaDataResources?: boolean;
    /**
     * Path to the translation file.
     */
    i18nFile?: string;
    /**
     * Import format if different from `i18nFormat`.
     */
    i18nFormat?: string;
    /**
     * Locale of the imported translations.
     */
    locale?: string;
    /**
     * How to handle missing messages.
     */
    missingTranslation?: 'error' | 'warning' | 'ignore';

    /**
     *  Path to the extracted message file.
     */
    i18nOutFile?: string;
    /**
     * Export format (xlf, xlf2 or xmb).
     */
    i18nOutFormat?: string;
}

export interface BundleOptions {
    /**
     * Bundle tool to be used.
     * @default rollup
     */
    bundleTool?: 'rollup' | 'webpack';
    /**
     * Custom webpack config file to be merged. Path will be resolved to angular-build.json file.
     */
    webpackConfig?: string;
    /**
     * Bundle module format.
     */
    libraryTarget: 'var' | 'iife' | 'cjs' | 'commonjs' | 'commonjs2' | 'amd' | 'umd' | 'es';
    /**
     * Set true if you're exporting more than one thing.
     */
    namedExports?: boolean;
    /**
     * The entry file to be bundled.
     */
    entry?: string;
    /**
     * The typescript configuration file to be used.
     * @default tsconfig.json
     */
    tsconfig?: string;
    /**
     * Entry root directory.
     * @default srcDir
     */
    entryRoot?: 'srcDir' | 'outDir' | 'tsOutDir' | 'prevBundleOutDir';
    /**
     * Custom bundle output file name.
     */
    outFileName?: string;
    /**
     * Custom output directory for bundled results.
     */
    outDir?: string;
    /**
     * Transforms entry file or bundled result to specific ECMA script target.
     */
    scriptTarget?: 'es5' | 'es2015' | 'es2016' | 'es2017';
    /**
     * If true, the process will perform script target transformation only.
     * @default false
     */
    transformScriptTargetOnly?: boolean;
    /**
     * The externals configuration option provides a way of excluding dependencies from the output bundle.
     */
    externals?: ExternalsEntry | ExternalsEntry[];
    /**
     * If true, default Angular and RxJs global module names are added as externals.
     * @default  true
     */
    nodeModulesAsExternals?: boolean;
    /**
     * If true, default Angular and RxJs global module names are added as externals.
     * @default  true
     */
    angularAndRxJsAsExternals?: boolean;
    /**
     * If true, minify file will be generated.
     */
    minify?: boolean;
}

export interface PackageOptions {
    /**
     * The source package.json file to be updated and copied.
     */
    packageJsonFile: string;
    /**
     * Custom destination directory for 'package.json'.
     */
    packageJsonFileOutDir?: string;
    /**
     * Re-export file name for typing and metadata.
     */
    reExportTypingsAndMetaDataAs?: string;
}

export interface ModuleReplacementEntry {
    resourcePath: string;
    newResourcePath: string;
}

export type WebpackStatsPreset
    = boolean
    | 'errors-only'
    | 'minimal'
    | 'none'
    | 'normal'
    | 'verbose';

export interface WebpackStatsToJsonOptions {
    /** Add asset Information */
    assets?: boolean;
    /** Sort assets by a field */
    assetsSort?: string;
    /** Add information about cached (not built) modules */
    cached?: boolean;
    /** Show cached assets (setting this to `false` only shows emitted files) */
    cachedAssets?: boolean;
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
    /** Display the distance from the entry point for each module */
    depth?: boolean;
    /** Display the entry points with the corresponding bundles */
    entrypoints?: boolean;
    /** Add --env information */
    env?: boolean;
    /** Add errors */
    errors?: boolean;
    /** Add details to errors (like resolving log) */
    errorDetails?: boolean;
    /** Exclude assets from being displayed in stats */
    excludeAssets?: string | string[];
    /** Exclude modules from being displayed in stats */
    excludeModules?: string | string[];
    /** See excludeModules */
    exclude?: string | string[];
    /** Add the hash of the compilation */
    hash?: boolean;
    /** Set the maximum number of modules to be shown */
    maxModules?: number;
    /** Add built modules information */
    modules?: boolean;
    /** Sort the modules by a field */
    modulesSort?: string;
    /** Show dependencies and origin of warnings/errors */
    moduleTrace?: boolean;
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
    /** Show which exports of a module are used */
    usedExports?: boolean;
    /** Filter warnings to be shown */
    warningsFilter?: string | string[];
    /** Show performance hint when file size exceeds `performance.maxAssetSize` */
    performance?: boolean;
    /** Show the exports of the modules */
    providedExports?: boolean;
}

export interface WebpackStatsToStringOptions extends WebpackStatsToJsonOptions {
    /** `webpack --colors` equivalent */
    colors?: boolean;
}

export interface BundleAnalyzerOptions {
    /**
     * Path to bundle report file that will be generated in `static` mode.
     */
    reportFilename?: string;

    /**
     * If `true`, Webpack Stats JSON file will be generated in bundles output directory.
     * @default false
     */
    generateStatsFile?: boolean;
    /**
     * Name of Webpack Stats JSON file that will be generated if `generateStatsFile` is `true`.
     */
    statsFilename?: string;
    /**
     * If true, automatically open report in default browser.
     */
    openAnalyzer?: boolean;
}

export interface GlobalEntry {
    /**
     * The source style file, it can be .scss/.sass, .less or .css
     */
    input: string | string[];
    /**
     * The output style file name.
     */
    to?: string;
    /**
     * If true, it will not be injected to target html.
     */
    lazy?: boolean;
}

export interface DllOptions {
    entry: string | string[];
    exclude?: string[];
}

export interface HtmlInjectOptions {
    runtimeChunkInline?: boolean;
    dlls?: boolean;
    icons?: boolean;
    resourceHints?: boolean;

    index?: string;
    indexOut?: string;
    baseHrefOut?: string;
    iconsOut?: string;
    resourceHintsOut?: string;
    stylesOut?: string;
    runtimeInlineOut?: string;
    scriptsOut?: string;

    preloads?: string[];
    prefetches?: string[];

    customAttributes?: { [key: string]: string };
    customScriptAttributes?: { [key: string]: string };
    customLinkAttributes?: { [key: string]: string };
    customResourceHintAttributes?: { [key: string]: string };
}

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

export interface PreDefinedEnvironment {
    aot?: boolean;
    dev?: boolean;
    prod?: boolean;
    hot?: boolean;
    dll?: boolean;
}

/**
 * @additionalProperties true
 */
export interface AngularBuildConfig {
    /**
     * The library project configs.
     */
    libs: LibProjectConfig[];
    /**
     * The application project configs.
     */
    apps: AppProjectConfig[];
    /**
     * Log level.
     */
    logLevel?: 'debug' | 'info' | 'warn' | 'none';
    /**
     * Watch options.
     */
    watchOptions?: WebpackWatchOptions;
}
