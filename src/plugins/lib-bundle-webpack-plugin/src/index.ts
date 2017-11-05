import * as webpack from 'webpack';

import {
    InternalError,
    InvalidConfigError,
    LibBuildContext,
    LibProjectConfigInternal,
    RollupError,
    SorceryError,
    TypescriptCompileError,
    UglifyError,
    UnSupportedStyleExtError,
    WebpackError
} from '../../../models';
import { performLibBundles, performNgc, performPackageJsonCopy, processStyles } from '../../../helpers';

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

                    // TODO: to review
                    if (compilation.errors &&
                    (err instanceof InternalError ||
                        err instanceof InvalidConfigError ||
                        err instanceof RollupError ||
                        err instanceof SorceryError ||
                        err instanceof TypescriptCompileError ||
                        err instanceof UglifyError ||
                        err instanceof UnSupportedStyleExtError ||
                        err instanceof WebpackError)) {
                        compilation.errors.push(err);
                        return cb();
                    }

                    return cb(err);
                });
        });
    }

    private async performBundleTask(angularBuildContext: LibBuildContext): Promise<void> {
        const libConfig = angularBuildContext.projectConfig as LibProjectConfigInternal;
        if (libConfig.styles && libConfig.styles.length) {
            await processStyles(angularBuildContext);
        }
        if (libConfig.tsTranspilation) {
            await performNgc(angularBuildContext);
        }
        if (libConfig.bundles && libConfig.bundles.length > 0) {
            await performLibBundles(angularBuildContext);
        }
        if (libConfig.packageOptions) {
            await performPackageJsonCopy(angularBuildContext);
        }
    }
}
