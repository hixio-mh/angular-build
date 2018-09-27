// tslint:disable:no-any
// tslint:disable:no-unsafe-any
// tslint:disable:no-var-requires
// tslint:disable:no-require-imports

import * as path from 'path';

import { pathExists } from 'fs-extra';
import * as rollup from 'rollup';

import { AngularBuildContext } from '../../../build-context';
import { InvalidConfigError } from '../../../models/errors';
import { LibProjectConfigInternal } from '../../../models/internals';

import { getRollupConfig } from './get-rollup-config';
import { minifyFile } from './minify-file';

const sorcery = require('sorcery');

export async function performLibBundles(angularBuildContext: AngularBuildContext<LibProjectConfigInternal>): Promise<void> {
    const libConfig = angularBuildContext.projectConfig;
    if (!libConfig._bundles || !libConfig._bundles.length) {
        return;
    }

    const bundles = libConfig._bundles;
    const logger = AngularBuildContext.logger;
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
        const rollupOptions = getRollupConfig(angularBuildContext, currentBundle);
        logger.info(
            `Bundling to ${currentBundle.libraryTarget} format with rollup`);

        const bundle = await rollup.rollup(rollupOptions.inputOptions as any);
        await bundle.write(rollupOptions.outputOptions);

        // Remapping sourcemaps
        if (shouldReMapSourceMap) {
            const chain: any = await sorcery.load(currentBundle._outputFilePath);
            await chain.write();
        }

        // minify umd files
        if (currentBundle.minify || (currentBundle.minify !== false && currentBundle.libraryTarget === 'umd')) {
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
