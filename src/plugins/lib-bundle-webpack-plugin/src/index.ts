import * as webpack from 'webpack';

import {
    InvalidConfigError,
    LibBuildContext,
    LibProjectConfigInternal,
    TypescriptCompileError,
    UglifyError,
    UnSupportedStyleExtError
} from '../../../models';

import { performNgc } from '../../../helpers/perform-ngc';

import { performLibBundles } from '../../../helpers/perform-lib-bundles';
import { performPackageJsonCopy } from '../../../helpers/perform-package-json-copy';
import { processStyles } from '../../../helpers/process-styles';

export interface LibBundleWebpackPluginOptions {
    angularBuildContext: LibBuildContext;
}

export class LibBundleWebpackPlugin {
    get name(): string {
        return 'LibBundleWebpackPlugin';
    }

    constructor(private readonly options: LibBundleWebpackPluginOptions) { }

    apply(compiler: webpack.Compiler): void {
        compiler.plugin('emit', (compilation: any, cb: (err?: Error) => void) => {
            this.performBundleTask(this.options.angularBuildContext)
                .then(() => cb())
                .catch(err => {
                    // TODO: to review for
                    // SassError
                    // RenderError
                    // CssSyntaxError

                    if (compilation.errors &&
                        (err instanceof InvalidConfigError ||
                            err instanceof TypescriptCompileError ||
                            err instanceof UglifyError ||
                            err instanceof UnSupportedStyleExtError)) {
                        compilation.errors.push(err);
                        return cb();
                    }

                    return cb(err);
                });
        });
    }

    private async performBundleTask(angularBuildContext: LibBuildContext): Promise<void> {
        const libConfig = angularBuildContext.projectConfig as LibProjectConfigInternal;
        if (libConfig.tsTranspilation) {
            await performNgc(angularBuildContext);
        }
        if (libConfig.styles && libConfig.styles.length) {
            // Dynamic require
            // const processStylesModule = await import('../../../helpers/process-styles');
            // const processStyles = processStylesModule.processStyles;

            await processStyles(angularBuildContext);
        }
        if (libConfig.bundles && libConfig.bundles.length > 0) {
            // Dynamic require
            // const performLibBundlesModule = await import('../../../helpers/perform-lib-bundles');
            // const performLibBundles = performLibBundlesModule.performLibBundles;

            await performLibBundles(angularBuildContext);
        }
        if (libConfig.packageOptions) {
            // Dynamic require
            // const performPackageJsonCopyModule =
            //    await import('../../../helpers/perform-package-json-copy');
            // const performPackageJsonCopy = performPackageJsonCopyModule.performPackageJsonCopy;

            await performPackageJsonCopy(angularBuildContext);
        }
    }
}
