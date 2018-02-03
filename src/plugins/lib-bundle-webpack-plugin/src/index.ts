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

const loadedModules: { [key: string]: any } = {};
//import { performLibBundles } from '../../../helpers/perform-lib-bundles';
//import { performPackageJsonCopy } from '../../../helpers/perform-package-json-copy';
//import { processStyles } from '../../../helpers/process-styles';

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
            if (!loadedModules.processStyles) {
                const processStylesModule = await import('../../../helpers/process-styles');
                loadedModules.processStyles = processStylesModule.processStyles;
            }
            const processStyles = loadedModules.processStyles;

            await processStyles(angularBuildContext);
        }
        if (libConfig.bundles && libConfig.bundles.length > 0) {
            // Dynamic require
            if (!loadedModules.performLibBundles) {
                const performLibBundlesModule = await import('../../../helpers/perform-lib-bundles');
                loadedModules.performLibBundles = performLibBundlesModule.performLibBundles;
            }
            const performLibBundles = loadedModules.performLibBundles;

            await performLibBundles(angularBuildContext);
        }
        if (libConfig.packageOptions) {
            // Dynamic require
            if (!loadedModules.performPackageJsonCopy) {
                const performPackageJsonCopyModule =
                    await import('../../../helpers/perform-package-json-copy');
                loadedModules.performPackageJsonCopy = performPackageJsonCopyModule.performPackageJsonCopy;
            }
            const performPackageJsonCopy = loadedModules.performPackageJsonCopy;

            await performPackageJsonCopy(angularBuildContext);
        }
    }
}
