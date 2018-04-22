/**
 * @additionalProperties false
 */
export interface BeforeBuildCleanOptions {
    /**
     * If true, delete output directory before build.
     */
    cleanOutDir?: boolean;
    /**
     * Paths to be deleted.
     */
    paths?: string[];
    /**
     * Path array to exclude from deleting.
     */
    exclude?: string[];
}

/**
 * @additionalProperties false
 */
export interface AfterEmitCleanOptions {
    /**
     * Paths to be deleted.
     */
    paths?: string[];
    /**
     * Path array to exclude from deleting.
     */
    exclude?: string[];
}

/**
 * @additionalProperties false
 */
export interface CleanOptions {
    /**
     * Before build clean option.
     */
    beforeBuild?: BeforeBuildCleanOptions;
    /**
     * After emit clean option.
     */
    afterEmit?: AfterEmitCleanOptions;
    /**
     * Allows cleaning outside of output directory.
     * @default false
     */
    allowOutsideOutDir?: boolean;
    /**
     * Allows cleaning outside of workspace root.
     * @default false
     */
    allowOutsideWorkspaceRoot?: boolean;
}

/**
 * @additionalProperties false
 */
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

/**
 * @additionalProperties false
 */
export interface GlobalEntry {
    /**
     * The file to include.
     */
    input: string | string[];
    /**
     * The bundle name for this extra entry point.
     */
    bundleName?: string;
    /**
     * If the bundle will be lazy loaded.
     */
    lazy?: boolean;
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

/**
 * @additionalProperties false
 */
export interface StylePreprocessorOptions {
    /**
     * An array of paths that LibSass can look in to attempt to resolve your @import declarations.
     */
    includePaths: string[];
}

export interface EnvOverridesOptions<TConfig extends ProjectConfigBase> {
    [name: string]: TConfig;
}

/**
 * @additionalProperties false
 */
export interface ProjectConfigBase {
    /**
     * The output directory for build results.
     */
    outputPath?: string;
    /**
     * Tell the build system which platform environment the application is targeting.
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
     * List of global style entries.
     */
    styles?: (string | GlobalEntry)[];
    /**
     * Options to pass to style preprocessors.
     */
    stylePreprocessorOptions?: StylePreprocessorOptions;
    /**
     * Banner text to add at the top of each generated files. It can be text file name or raw text.
     */
    banner?: string;
    /**
     * If true, sourcemaps will be generated.
     */
    sourceMap?: boolean;
    /**
     * If true, this project config will be skipped by the build process.
     */
    skip?: boolean;
}

/**
 * @additionalProperties false
 */
export interface ProjectConfig<TConfig extends ProjectConfigBase> extends ProjectConfigBase {
    /**
     * Link to schema.
     */
    $schema?: string;
    /**
     * The name of this configuration.
     */
    name?: string;
    /**
     * The name of build-in configuration preset, or path(s) to other configuration files which are extended by this configuration.
     */
    extends?: string | string[];
    /**
     * The project root folder.
     */
    root?: string;
    /**
     * To override properties based on build environment.
     */
    envOverrides?: EnvOverridesOptions<TConfig>;
}
