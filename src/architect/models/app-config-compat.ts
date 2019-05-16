// tslint:disable: no-reserved-keywords

/**
 * @additionalProperties false
 */
export interface AssetPatternObjectCompat {
    glob?: string;
    input: string;
    output: string;
    ignore?: string[];
}

/**
 * @additionalProperties false
 */
export interface Budget {
    /**
     * The type of budget
     */
    type: 'all' | 'allScript' | 'any' | 'anyScript' | 'bundle' | 'initial';
    /**
     * The name of the bundle
     */
    name?: string;
    /**
     * The baseline size for comparison.
     */
    baseline?: string;
    /**
     * The maximum threshold for warning relative to the baseline.
     */
    maximumWarning?: string;
    /**
     * The maximum threshold for error relative to the baseline.
     */
    maximumError?: string;
    /**
     * The minimum threshold for warning relative to the baseline.
     */
    minimumWarning?: string;
    /**
     * The minimum threshold for error relative to the baseline.
     */
    minimumError?: string;
    /**
     * The threshold for warning relative to the baseline (min & max).
     */
    warning?: string;
    /**
     * The threshold for error relative to the baseline (min & max).
     */
    error?: string;
}

export interface AppConfigCompat {
    /**
     * @angular-devkit/build_angular compatibility, use 'entry' instead.
     */
    main?: string;
    /**
     * @angular-devkit/build_angular compatibility, use 'htmlInject.index' instead.
     */
    index?: string;
    /**
     * @angular-devkit/build_angular compatibility, use 'publicPath' instead.
     */
    deployUrl?: string;
    /**
     * @angular-devkit/build_angular compatibility, use 'copy' instead.
     */
    assets?: (AssetPatternObjectCompat | string)[] | boolean;
    /**
     * @angular-devkit/build_angular compatibility, use clean options instead.
     */
    deleteOutputPath?: boolean;
    /**
     * @angular-devkit/build_angular compatibility, use 'sourceMapDevTool' instead.
     */
    evalSourceMap?: boolean;
    /**
     * @angular-devkit/build_angular compatibility, use 'bundleAnalyzer.generateStatsFile' instead.
     */
    statsJson?: boolean;
    /**
     * @angular-devkit/build_angular compatibility, use 'watchOptions.poll' instead.
     */
    poll?: number;
    /**
     * @angular-devkit/build_angular compatibility, use 'platformTarget' instead.
     */
    platform?: 'browser' | 'server';
    /**
     * @angular-devkit/build_angular compatibility, use 'nodeModulesAsExternals' instead.
     */
    bundleDependencies?: 'none' | 'all';
    /**
     * @angular-devkit/build_angular compatibility, not supported.
     */
    preserveSymlinks?: boolean;
    /**
     * @angular-devkit/build_angular compatibility, not supported.
     */
    budgets?: Budget[] | boolean;
    /**
     * @angular-devkit/build_angular compatibility, not supported.
     */
    showCircularDependencies?: boolean;
    /**
     * @angular-devkit/build_angular compatibility, not supported.
     */
    subresourceIntegrity?: boolean;
    /**
     * @angular-devkit/build_angular compatibility, not supported.
     */
    skipAppShell?: boolean;
    /**
     * @angular-devkit/build_angular compatibility, not supported.
     */
    vendorSourceMap?: boolean;
    /**
     * @angular-devkit/build_angular compatibility, not supported.
     */
    profile?: boolean;
    /**
     * @angular-devkit/build_angular compatibility, not supported.
     */
    es5BrowserSupport?: boolean;
    /**
     * @angular-devkit/build_angular compatibility, not supported.
     */
    rebaseRootRelativeCssUrls?: boolean;
    /**
     * @angular-devkit/build_angular compatibility, not supported.
     */
    webWorkerTsConfig?: boolean;
}
