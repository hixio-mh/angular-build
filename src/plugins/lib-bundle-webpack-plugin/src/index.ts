import { AngularBuildContext, LibProjectConfigInternal, } from '../../../models';

import { performNgc } from '../../../helpers/perform-ngc';

import { performLibBundles } from '../../../helpers/perform-lib-bundles';
import { performPackageJsonCopy } from '../../../helpers/perform-package-json-copy';
import { processStyles } from '../../../helpers/process-styles';

export interface LibBundleWebpackPluginOptions {
    angularBuildContext: AngularBuildContext;
}

export class LibBundleWebpackPlugin {
    get name(): string {
        return 'lib-bundle-webpack-plugin';
    }

    constructor(private readonly _options: LibBundleWebpackPluginOptions) { }

    apply(compiler: any): void {
        compiler.hooks.emit.tapPromise(this.name, () => {
            return this.performBundleTask(this._options.angularBuildContext);
        });
    }

    private async performBundleTask(angularBuildContext: AngularBuildContext): Promise<void> {
        const libConfig = angularBuildContext.projectConfig as LibProjectConfigInternal;
        if (libConfig.tsTranspilation) {
            await performNgc(angularBuildContext);
        }
        if (libConfig.styles && libConfig.styles.length) {
            await processStyles(angularBuildContext);
        }
        if (libConfig.bundles && libConfig.bundles.length > 0) {
            await performLibBundles(angularBuildContext);
        }
        if (libConfig.packageOptions) {
            await performPackageJsonCopy(angularBuildContext);
        }
    }
}
