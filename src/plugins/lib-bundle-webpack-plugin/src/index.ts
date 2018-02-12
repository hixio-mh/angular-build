import * as webpack from 'webpack';

import {
    AngularBuildContext,
    InvalidConfigError,
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
    angularBuildContext: AngularBuildContext;
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
