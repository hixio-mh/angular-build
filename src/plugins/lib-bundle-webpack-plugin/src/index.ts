import * as webpack from 'webpack';

import { AngularBuildContext, LibProjectConfigInternal, } from '../../../build-context';

import { performNgc } from './perform-ngc';
import { performLibBundles } from './perform-lib-bundles';
import { performPackageJsonCopy } from './perform-package-json-copy';
import { processStyles } from './process-styles';

export interface LibBundleWebpackPluginOptions {
    angularBuildContext: AngularBuildContext<LibProjectConfigInternal>;
}

export class LibBundleWebpackPlugin {
    get name(): string {
        return 'lib-bundle-webpack-plugin';
    }

    constructor(private readonly _options: LibBundleWebpackPluginOptions) { }

    apply(compiler: webpack.Compiler): void {
        compiler.hooks.emit.tapPromise(this.name, () => {
            return this.performBundleTask(this._options.angularBuildContext);
        });
    }

    private async performBundleTask(angularBuildContext: AngularBuildContext<LibProjectConfigInternal>): Promise<void> {
        const libConfig = angularBuildContext.projectConfig as LibProjectConfigInternal;
        if (libConfig.tsTranspilation) {
            await performNgc(angularBuildContext);
        }
        if (libConfig.styles && Array.isArray(libConfig.styles) && libConfig.styles.length) {
            await processStyles(angularBuildContext);
        }
        if (libConfig.bundles && Array.isArray(libConfig.bundles) && libConfig.bundles.length > 0) {
            await performLibBundles(angularBuildContext);
        }
        if (libConfig.packageOptions) {
            await performPackageJsonCopy(angularBuildContext);
        }
    }
}
