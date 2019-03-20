
/**
 * @additionalProperties true
 */
export interface BuildOptionsCompat {
    /**
     * @angular-devkit/build_angular compatibility, use 'logLevel' instead.
     */
    verbose?: boolean;
    /**
     * @angular-devkit/build_angular compatibility, use 'watchOptions.poll' instead.
     */
    poll?: number;
}
