import { ExternalsEntry, ProjectConfig, ProjectConfigBase } from './project-config';

/**
 * @additionalProperties false
 */
export interface TsTranspilationOptions {
    /**
     * Typescript configuration file for this transpilation.
     */
    tsConfig?: string;
    /**
     * If true, use tsc instead of ngc.
     */
    useTsc?: boolean;
    /**
     * Custom output directory for this transpilation.
     */
    outDir?: string;
    /**
     * Override script target for this transpilation.
     */
    target?: 'es5' | 'es2015' | 'es2016' | 'es2017' | 'es2018' | 'esnext';
    /**
     * Override declaration option for this transpilation.
     */
    declaration?: boolean;
    /**
     * If true, templateUrl and styleUrls resources are inlined.
     */
    inlineAssets?: boolean;
    /**
     * If true, replaces version placeholder with package version.
     */
    replaceVersionPlaceholder?: boolean;
    /**
     * Move typing and metadata files to package.json output directory root.
     */
    moveTypingFilesToPackageRoot?: boolean;
    /**
     * If true, re-export secondary entry point typing and metadata file at output root.
     */
    reExportTypingEntryToOutputRoot?: boolean;
}

/**
 * @additionalProperties false
 */
export interface LibBundleOptions {
    /**
     * Bundle module format.
     */
    libraryTarget?: 'cjs' | 'umd' | 'esm';
    /**
     * Bundle tool to be used.
     */
    bundleTool?: 'rollup' | 'webpack';
    /**
     * Custom webpack config file to be merged.
     */
    webpackConfig?: string;
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
    entryRoot?: 'root' | 'outputPath' | 'tsTranspilationOutDir' | 'prevBundleOutDir';
    /**
     * Array index for entry root tsTranspilationResult.
     */
    tsTranspilationIndex?: number;
    /**
     * Custom bundle output file path.
     */
    outputFilePath?: string;
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
export interface LibProjectConfigBase extends ProjectConfigBase {
    /**
     * Typescript transpilation options.
     */
    tsTranspilations?: TsTranspilationOptions[] | boolean;
    /**
     * The main entry point file for package.json.
     */
    packageEntryFileForTsTranspilation?: string;
    /**
     * Represents your umd bundle name, by which other scripts on the same page can access it.
     */
    libraryName?: string;
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
     * Bundle target options.
     */
    bundles?: LibBundleOptions[] | boolean;
    /**
     * The output root directory for package.json file.
     */
    packageJsonOutDir?: string;
    /**
     * Copy package.json file to output path.
     */
    packageJsonCopy?: boolean;
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
