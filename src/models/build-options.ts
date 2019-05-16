import { WebpackWatchOptions } from './watch-options';

/**
 * @additionalProperties true
 */
export interface BuildOptions {
    /**
     * Define the build environment.
     */
    environment?: { [key: string]: boolean | string } | string;
    /**
     * Flag to set build environment to 'production'.
     */
    prod?: boolean;
    /**
     * Filter config by name(s).
     */
    filter?: string | string[];
    /**
     * Clean output directory before build.
     */
    clean?: boolean;
    /**
     * Display compilation progress in percentage.
     */
    progress?: boolean;
    /**
     * Flag to set logLevel to 'debug'.
     */
    verbose?: boolean;
    /**
     * Logging level for output logging.
     */
    logLevel?: 'debug' | 'info' | 'warn' | 'none';
    /**
     * Build with watch mode.
     */
    watch?: boolean;
    /**
     * Watch options.
     */
    watchOptions?: WebpackWatchOptions;
    /**
     * Beep when build completed.
     */
    beep?: boolean;
}
