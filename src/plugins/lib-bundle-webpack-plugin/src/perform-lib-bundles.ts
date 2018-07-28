import * as path from 'path';

import { pathExists } from 'fs-extra';
import * as rollup from 'rollup';

import { AngularBuildContext, LibProjectConfigInternal } from '../../../build-context';
import { InvalidConfigError } from '../../../error-models';
import { runWebpack } from '../../../helpers/run-webpack';
import { Logger } from '../../../utils';

import { getBundleTargetWebpackConfig } from './bundle-target-webpack-config';
import { getRollupConfig } from './get-rollup-config';
import { minifyFile } from './minify-file';

const sorcery = require('sorcery');

export async function performLibBundles<TConfig extends LibProjectConfigInternal>(angularBuildContext:
    AngularBuildContext<TConfig>,
    customLogger?: Logger): Promise<void> {
    const libConfig = angularBuildContext.projectConfig;
    if (!libConfig._bundles || !libConfig._bundles.length) {
        return;
    }

    const bundles = libConfig._bundles;
    const logger = customLogger || AngularBuildContext.logger;
    const verbose = angularBuildContext.buildOptions.logLevel === 'debug';

    for (const currentBundle of bundles) {
        const entryFilePath = currentBundle._entryFilePath;
        const entryFileExists = await pathExists(entryFilePath);

        if (!entryFileExists) {
            throw new InvalidConfigError(
                `The entry file path: ${entryFilePath} doesn't exist. Please correct value in 'projects[${libConfig
                ._index
                }].bundles[${currentBundle._index}].entry'.`);
        }

        // path.dirname(entryFilePath) !== srcDir
        const shouldReMapSourceMap = libConfig.sourceMap &&
            !/\.ts$/i.test(entryFilePath);

        // main bundling
        if (currentBundle.bundleTool === 'webpack') {
            const wpOptions =
                getBundleTargetWebpackConfig(angularBuildContext, currentBundle);
            logger.info(
                `Bundling ${currentBundle.libraryTarget} module with webpack`);
            try {
                await runWebpack(wpOptions, false, logger);
            } catch (err) {
                if (err) {
                    let errMsg = '\n';
                    if (err.message && err.message.length && err.message !== err.stack) {
                        errMsg += err.message;
                    }
                    if ((err as any).details &&
                        (err as any).details.length &&
                        (err as any).details !== err.stack &&
                        (err as any).details !== err.message) {
                        if (errMsg.trim()) {
                            errMsg += '\nError Details:\n';
                        }
                        errMsg += (err as any).details;
                    }
                    if (err.stack && err.stack.length && err.stack !== err.message) {
                        if (errMsg.trim()) {
                            errMsg += '\nCall Stack:\n';
                        }
                        errMsg += err.stack;
                    }
                    logger.error(errMsg);
                }
            }
        } else {
            const rollupOptions = getRollupConfig(angularBuildContext, currentBundle);
            logger.info(
                `Bundling ${currentBundle.libraryTarget} module with rollup`);

            const bundle = await rollup.rollup(rollupOptions.inputOptions as any);
            await bundle.write(rollupOptions.outputOptions);
        }

        // Remapping sourcemaps
        if (shouldReMapSourceMap && currentBundle.bundleTool !== 'webpack') {
            const chain: any = await sorcery.load(currentBundle._outputFilePath);
            await chain.write();
        }

        // minify umd files
        if (currentBundle.bundleTool !== 'webpack' &&
        (currentBundle.minify ||
        (currentBundle.minify !== false &&
            currentBundle.libraryTarget === 'umd'))) {
            const minFilePath = currentBundle._outputFilePath.replace(/\.js$/i, '.min.js');
            logger.debug(`Minifying ${path.basename(currentBundle._outputFilePath)}`);

            await minifyFile(currentBundle._outputFilePath,
                minFilePath,
                libConfig.sourceMap as boolean,
                verbose,
                logger);

            // Remapping sourcemaps
            if (libConfig.sourceMap) {
                const chain: any = await sorcery.load(currentBundle._outputFilePath);
                await chain.write();
            }
        }
    }
}
