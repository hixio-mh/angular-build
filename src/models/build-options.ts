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
     * Filter config by name(s).
     */
    filter?: string | string[];
    /**
     * Logging level for output logging.
     */
    logLevel?: 'debug' | 'info' | 'warn' | 'none';
    /**
     * Display compilation progress in percentage.
     */
    progress?: boolean;
    /**
     * Clean output directory before build.
     */
    cleanOutDir?: boolean;
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
