/**
 * @additionalProperties true
 */
export interface WebpackWatchOptions {
  /**
   * Add a delay in milliseconds before rebuilding once the first file changed.
   */
  aggregateTimeout?: number;
  /**
   * Ignore pattern to exclude a huge folder like node_modules.
   */
  ignored?: string;
  /**
   * Turn on polling by passing true, or specifying a poll interval in milliseconds.
   */
  poll?: boolean | number;
}
