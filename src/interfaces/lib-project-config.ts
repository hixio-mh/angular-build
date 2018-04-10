import { ExternalsEntry, ProjectConfig, ProjectConfigBase } from './project-config';

/**
 * @additionalProperties false
 */
export interface TsTranspilationOptions {
    /**
     * The typescript configuration file to be used.
     */
    tsConfig: string;
    /**
     * If true, templateUrl and styleUrls resources are copy into output locations.
     */
    copyTemplateAndStyleUrls?: boolean;
    /**
     * If true, templateUrl and styleUrls resources of .metadata.json are inlined.
     */
    inlineMetaDataResources?: boolean;
    /**
     * If true, replaces version placeholder with package version.
     */
    replaceVersionPlaceholder?: boolean;
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
}

/**
 * @additionalProperties false
 */
export interface LibBundleOptions {
    /**
     * Bundle tool to be used.
     * @default rollup
     */
    bundleTool?: 'rollup' | 'webpack';
    /**
     * Custom webpack config file to be merged.
     */
    webpackConfig?: string;
    /**
     * Bundle module format.
     */
    libraryTarget: 'var' | 'iife' | 'cjs' | 'commonjs' | 'commonjs2' | 'amd' | 'umd' | 'es';
    /**
     * The entry file to be bundled.
     */
    entry?: string;
    /**
     * The typescript configuration file to be used.
     */
    tsConfig?: string;
    /**
     * Entry root directory resolution.
     */
    entryRoot?: 'root' | 'outputPath' | 'tsOutDir' | 'prevBundleOutDir';
    /**
     * Custom bundle output file name.
     */
    outFileName?: string;
    /**
     * Custom output directory for bundled results.
     */
    outputPath?: string;
    /**
     * Transforms entry file or bundled result to specific ECMA script target.
     */
    scriptTarget?: 'es5' | 'es2015' | 'es2016' | 'es2017';
    /**
     * If true, the process will perform script target transformation only.
     */
    transformScriptTargetOnly?: boolean;
    /**
     * The externals configuration option provides a way of excluding dependencies from the output bundle.
     */
    externals?: ExternalsEntry | ExternalsEntry[];
    /**
     * If true, node_modules packages are not included in bundle.
     */
    nodeModulesAsExternals?: boolean;
    /**
     * If true, predefined Angular and rxjs globals are added.
     */
    includeDefaultAngularAndRxJsGlobals?: boolean;
    /**
     * If true, minify file will be generated.
     */
    minify?: boolean;
}

/**
 * @additionalProperties false
 */
export interface PackageOptions {
    /**
     * The source package.json file to be updated and copied.
     */
    packageJsonFile: string;
    /**
     * Custom destination directory for 'package.json'.
     */
    packageJsonFileOutputPath?: string;
    /**
     * Re-export file name for typing and metadata.
     */
    reExportTypingsAndMetaDataAs?: string;
}

/**
 * @additionalProperties false
 */
export interface LibProjectConfigBase extends ProjectConfigBase {
    /**
     * Typescript transpilation options.
     */
    tsTranspilation?: TsTranspilationOptions;
    /**
     * The library name.
     */
    libraryName?: string;
    /**
     * Bundle target options.
     */
    bundles?: LibBundleOptions[] | boolean;
    /**
     * The externals configuration option provides a way of excluding dependencies from the output bundle.
     */
    externals?: ExternalsEntry | ExternalsEntry[];
    /**
     * If true, node_modules packages are not included in bundle.
     */
    nodeModulesAsExternals?: boolean;
    /**
     * If true, predefined Angular and rxjs globals are added.
     */
    includeDefaultAngularAndRxJsGlobals?: boolean;
    /**
     * Packaging options.
     */
    packageOptions?: PackageOptions;
}

export interface LibEnvOverridesOptions {
    [name: string]: LibProjectConfigBase;
}

/**
 * @additionalProperties false
 */
export interface LibProjectConfig extends LibProjectConfigBase, ProjectConfig<LibProjectConfigBase> {
    /**
     * To override properties based on build environment.
     */
    envOverrides?: LibEnvOverridesOptions;
}
