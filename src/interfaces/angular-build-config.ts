import { AppProjectConfig } from './app-project-config';
import { LibProjectConfig } from './lib-project-config';

/**
 * @additionalProperties true
 */
export interface AngularBuildConfig {
  /**
   * Link to schema.
   */
  $schema?: string;
  /**
   * The library project configurations.
   */
  libs: LibProjectConfig[];
  /**
   * The application project configurations.
   */
  apps: AppProjectConfig[];
}
