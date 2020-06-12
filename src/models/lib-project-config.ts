import { ExternalsEntry, ProjectConfig, ProjectConfigBase } from './project-config';

/**
 * @additionalProperties false
 */
export interface CommonJsOptions {
    /**
     * Some modules contain dynamic require calls, or require modules that contain circular dependencies, which are not handled well by static imports. Including those modules as dynamicRequireTargets will simulate a CommonJS (NodeJS-like) environment for them with support for dynamic and circular dependencies.
     */
    dynamicRequireTargets?: string[];
    /**
     * A minimatch pattern, or array of patterns, which specifies the files in the build the plugin should ignore. By default non-CommonJS modules are ignored.
     */
    exclude?: string[];
    /**
     * A minimatch pattern, or array of patterns, which specifies the files in the build the plugin should operate on. By default CommonJS modules are targeted.
     */
    include?: string[];
    /**
     * If true, uses of global won't be dealt with by this plugin.
     */
    ignoreGlobal?: boolean;
}

/**
 * @additionalProperties false
 */
export interface TsTranspilationOptions {
    /**
     * Typescript configuration file for this transpilation.
     */
    tsConfig?: string;
    /**
     * Custom output directory for this transpilation.
     */
    outDir?: string;
    /**
     * Override script target for this transpilation.
     */
    target?: 'es5' | 'es2015' | 'es2016' | 'es2017' | 'es2018' | 'es2019' | 'es2020' | 'esnext';
    /**
     * Override declaration option for this transpilation.
     */
    declaration?: boolean;
    /**
     * If true, templateUrl and styleUrls resources are inlined.
     */
    enableResourceInlining?: boolean;
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
    entryRoot?: 'root' | 'tsTranspilationOutput' | 'prevBundleOutput';
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
     * If true or options object, commonjs modules are converted to ES6 and included in bundle.
     */
    includeCommonJs?: boolean | CommonJsOptions;
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
    main?: string;
    /**
     * Represents your umd module id.
     */
    libraryName?: string;
    /**
     * The externals configuration option provides a way of excluding dependencies from the output bundle.
     */
    externals?: ExternalsEntry | ExternalsEntry[];
    /**
     * If true or options object, commonjs modules are converted to ES6 and included in bundle.
     */
    includeCommonJs?: boolean | CommonJsOptions;
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
    /**
     * If true, replaces version placeholder with package version.
     */
    replaceVersionPlaceholder?: boolean;
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
