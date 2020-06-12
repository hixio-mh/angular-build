// tslint:disable:no-reserved-keywords

import { ExternalsEntry, GlobalEntry, ProjectConfig, ProjectConfigBase } from './project-config';

/**
 * @additionalProperties false
 */
export interface HtmlInjectOptions {
    runtimeChunkInline?: boolean;
    dlls?: boolean;
    resourceHints?: boolean;

    index?: string;
    indexOut?: string;
    baseHrefOut?: string;
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

    minify?: boolean;
}

/**
 * @additionalProperties false
 */
export interface OutputHashingOptions {
    bundles?: boolean;
    chunks?: boolean;
    extractedAssets?: boolean;
}

export enum OutputHashingCompat {
    All = 'all',
    Bundles = 'bundles',
    Media = 'media',
    None = 'none',
}

/**
 * @additionalProperties false
 */
export interface PerformanceOptions {
    hints?: 'warning' | 'error' | boolean;
    maxAssetSize?: number;
    maxEntrypointSize?: number;
}

/**
 * @additionalProperties false
 */
export interface FileReplacementEntry {
    replace: string;
    with: string;
}

/**
 * @additionalProperties false
 */
export interface BundleAnalyzerOptions {
    /**
     * Path to bundle report file that will be generated in `static` mode.
     */
    reportFilename?: string;

    /**
     * If `true`, Webpack Stats JSON file will be generated in bundles output directory.
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

export type WebpackStatsPreset
    = boolean
    | 'errors-only'
    | 'minimal'
    | 'none'
    | 'normal'
    | 'verbose';

export interface WebpackStatsToJsonOptions {
    assets?: boolean;
    assetsSort?: string;
    cached?: boolean;
    cachedAssets?: boolean;
    children?: boolean;
    chunkModules?: boolean;
    chunkOrigins?: boolean;
    chunks?: boolean;
    chunksSort?: string;
    context?: string;
    depth?: boolean;
    entrypoints?: boolean;
    env?: boolean;
    errors?: boolean;
    errorDetails?: boolean;
    excludeAssets?: string | string[];
    excludeModules?: string | string[];
    exclude?: string | string[];
    hash?: boolean;
    maxModules?: number;
    modules?: boolean;
    modulesSort?: string;
    moduleTrace?: boolean;
    publicPath?: boolean;
    reasons?: boolean;
    source?: boolean;
    timings?: boolean;
    version?: boolean;
    warnings?: boolean;
    usedExports?: boolean;
    warningsFilter?: string | string[];
    performance?: boolean;
    providedExports?: boolean;
}

export interface WebpackStatsToStringOptions extends WebpackStatsToJsonOptions {
    colors?: boolean;
}

/**
 * @additionalProperties false
 */
export interface AppProjectConfigBase extends ProjectConfigBase {
    /**
     * Global script entries.
     */
    scripts?: (string | GlobalEntry)[];
    /**
     * Polyfill entries.
     */
    polyfills?: string[] | string;
    /**
     * The vendor module entries for dll bundle.
     */
    vendors?: string[];
    /**
     * Module format for bundling.
     */
    libraryTarget?: 'var' | 'commonjs' | 'commonjs2' | 'umd';
    /**
     * The main typescript entry file to be bundled.
     */
    entry?: string;
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
     */
    mainChunkName?: string;
    /**
     * The output chunk name for polyfills.
     */
    polyfillsChunkName?: string;
    /**
     * The output chunk name for vendor or dll chunk.
     */
    vendorChunkName?: string;
    /**
     * The html injection options.
     */
    htmlInject?: HtmlInjectOptions;
    /**
     * The url where files will be deployed.
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
     * Build using Ahead of Time compilation.
     */
    aot?: boolean;
    /**
     * Define the output filename cache-busting hashing mode.
     */
    outputHashing?: OutputHashingOptions | OutputHashingCompat;
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
    namedChunks?: boolean;
    /**
     * This option controls if and how source maps are generated.
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
     */
    sourceMapDevToolModuleFilenameTemplate?: '[absolute-resource-path]' | '[resource]' | '[resource-path]' | string;
    /**
     * A fallback used when the template string of 'sourceMapFilenameTemplate' yields duplicates.
     */
    sourceMapDevToolFallbackModuleFilenameTemplate?: '[absolute-resource-path]' | '[resource]' | '[resource-path]' | string;
    /**
     * Custom webpack config file to be merged.
     */
    webpackConfig?: string;
    /**
     * Replaces resources with new resources.
     */
    fileReplacements?: FileReplacementEntry[];
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
    i18nLocale?: string;
    /**
     * How to handle missing messages.
     */
    i18nMissingTranslation?: 'error' | 'warning' | 'ignore';

    /**
     *  Path to the extracted message file.
     */
    i18nOutFile?: string;
    /**
     * Export format (xlf, xlf2 or xmb).
     */
    i18nOutFormat?: string;
    /**
     * Defines the optimization level of the build.
     */
    optimization?: boolean;
    /**
     * Set true to enable build optimizer.
     */
    buildOptimizer?: boolean;
    /**
     * Run the TypeScript type checker in a forked process.
     */
    forkTypeChecker?: boolean;
    /**
     * Set true to enable scope hoisting.
     */
    concatenateModules?: boolean;
    /**
     * If 'true' or 'all', node_modules packages dependencies are included in the bundle.
     */
    bundleDependencies?: 'none' | 'all' | boolean;
    /**
     * Extract all licenses in a separate file.
     */
    extractLicenses?: boolean;
    /**
     * Output file name for extracted licenses.
     */
    extractLicenseOutputFilename?: string;
    /**
     * Generates a service worker config for production builds.
     */
    serviceWorker?: boolean;
    /**
     * Path to ngsw-config.json.
     */
    ngswConfigPath?: string;
    /**
     * The path where style resources will be placed, relative to outputPath.
     */
    resourcesOutputPath?: string;
}

export interface AppEnvOverridesOptions {
    [name: string]: AppProjectConfigBase;
}

/**
 * @additionalProperties false
 */
export interface AppProjectConfig extends AppProjectConfigBase, ProjectConfig<AppProjectConfigBase> {
    /**
     * To override properties based on build environment.
     */
    envOverrides?: AppEnvOverridesOptions;
}
