// tslint:disable:no-reserved-keywords

/**
 * @additionalProperties false
 */
export interface AssetPatternObjectCompat {
    glob?: string;
    input: string;
    output: string;
    ignore?: string[];
}

export interface ProjectConfigCompat {
    /**
     * Compatibility only, use 'outputPath' instead.
     */
    outDir?: string;
    /**
     * webpack-cli compatibility, use 'platformTarget' instead.
     */
    target?: 'web' | 'webworker' | 'node' | 'async-node' | 'node-webkit' | 'atom' | 'electron' | 'electron-renderer' | 'electron-main';
    /**
     * @angular-devkit/build_angular compatibility, use 'platformTarget' instead.
     */
    platform?: 'browser' | 'server';
    /**
     * @angular-devkit/build_angular compatibility, use 'copy' instead.
     */
    assets?: (AssetPatternObjectCompat | string)[] | boolean;
    /**
     * @angular-devkit/build_angular compatibility, use 'cleanOutDirs' instead.
     */
    deleteOutputPath?: boolean;
    /**
     * @angular-devkit/build_angular compatibility, use 'nodeModulesAsExternals' instead.
     */
    bundleDependencies?: 'none' | 'all';
    /**
     * @angular-devkit/build_angular compatibility, not supported.
     */
    preserveSymlinks?: boolean;
}
