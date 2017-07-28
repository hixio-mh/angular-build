import * as path from 'path';
const fs = require('fs-extra');

import { copyAssets, copyStyles } from '../../helpers';
import { AngularBuildConfig, BundleTarget, BuildOptions, LibProjectConfig, TsTranspilation } from '../../models';
import { clean, Logger, readJson } from '../../utils';

import { bundleTask } from './bundle-task';
import { packagingTask } from './packaging-task';
import { tsTranspilationTask } from './ts-transpilation-task';
import { LibBuildPipeInfo } from './lib-build-pipe-info';

export async function buildLib(projectRoot: string,
    libConfigMaster: LibProjectConfig,
    libConfig: LibProjectConfig,
    buildOptions: BuildOptions,
    angularBuildConfig: AngularBuildConfig,
    logger: Logger = new Logger()): Promise<any> {
    if (!projectRoot) {
        throw new Error(`The 'projectRoot' is required.`);
    }
    if (!libConfig) {
        throw new Error(`The 'libConfig' is required.`);
    }
    if (!buildOptions) {
        throw new Error(`The 'buildOptions' is required.`);
    }
    if (libConfig.projectType !== 'lib') {
        throw new Error(`The 'libConfig.projectType' must be 'lib'.`);
    }

    let tsTranspilations: TsTranspilation[] = [];
    if (libConfig.tsTranspilations) {
        tsTranspilations = (Array.isArray(libConfig.tsTranspilations)
            ? libConfig.tsTranspilations
            : [libConfig.tsTranspilations]).filter(
            (tsTranspilation: TsTranspilation) => tsTranspilation && Object.keys(tsTranspilation).length > 0);
    }

    let bundleTargets: BundleTarget[] = [];
    if (libConfig.bundleTargets) {
        bundleTargets = (Array.isArray(libConfig.bundleTargets)
            ? libConfig.bundleTargets
            : [libConfig.bundleTargets]).filter(
            (bundleTarget: BundleTarget) => bundleTarget && Object.keys(bundleTarget).length > 0);
    }
    if (bundleTargets.length === 0 && libConfig.libraryTarget) {
        // create default bundle target
        const defaultBundleTarget: BundleTarget = {
            libraryTarget: libConfig.libraryTarget
        };
        bundleTargets.push(defaultBundleTarget);
    }

    const srcDir = path.resolve(projectRoot, libConfig.srcDir || '');
    let outDir: string | null = null;

    if (!libConfig.outDir &&
        ((libConfig.assets && libConfig.assets.length) ||
            (libConfig.styles && libConfig.styles.length) ||
            bundleTargets.length ||
            libConfig.entry ||
            libConfig.libraryTarget ||
            (libConfig.packageOptions && libConfig.packageOptions.packageConfigFile))) {
        throw new Error(`The 'outDir' property is required in lib config.`);
    }

    if (libConfig.outDir) {
        outDir = path.resolve(projectRoot, libConfig.outDir);
    }

    let stylePreprocessorIncludePaths: string[] = [];
    if (libConfig.stylePreprocessorOptions && libConfig.stylePreprocessorOptions.includePaths) {
        stylePreprocessorIncludePaths =
            libConfig.stylePreprocessorOptions.includePaths.map(p => path.resolve(srcDir, p));
    }

    // read package info
    let pkgConfig: any | undefined;
    if (libConfig.packageOptions && libConfig.packageOptions.packageConfigFile) {
        if (await fs.exists(path.resolve(srcDir, libConfig.packageOptions.packageConfigFile))) {
            pkgConfig = await readJson(path.resolve(srcDir, libConfig.packageOptions.packageConfigFile));
        }
    }
    if (!pkgConfig && srcDir && await fs.exists(path.resolve(srcDir, 'package.json'))) {
        pkgConfig = await readJson(path.resolve(srcDir, 'package.json'));
    }
    if (!pkgConfig && await fs.exists(path.resolve(projectRoot, 'package.json'))) {
        pkgConfig = await readJson(path.resolve(projectRoot, 'package.json'));
    }
    const packageName = pkgConfig && pkgConfig.name ? pkgConfig.name : undefined;
    let packageNameWithoutScope = packageName;
    if (packageNameWithoutScope && packageNameWithoutScope.indexOf('/') > -1) {
        packageNameWithoutScope = packageNameWithoutScope.split('/')[1];
    }

    const buildPipeInfo: LibBuildPipeInfo = {
        projectRoot: projectRoot,
        libConfigMaster: libConfigMaster,
        libConfig: libConfig,
        buildOptions: buildOptions,
        angularBuildConfig: angularBuildConfig,
        packageName: packageNameWithoutScope,
        logger: logger
    };

    // copy assets
    if (libConfig.assets && libConfig.assets.length) {
        if (!outDir) {
            throw new Error(`The 'outDir' property is required in lib config.`);
        }
        logger.logLine(`Copying assets to ${path.relative(projectRoot, outDir as string)}`);
        await copyAssets(srcDir, outDir as string, libConfig.assets);
    }

    // process global styles
    if (libConfig.styles && libConfig.styles.length) {
        if (!outDir) {
            throw new Error(`The 'outDir' property is required in lib config.`);
        }

        logger.logLine(`Copying global styles to ${path.relative(projectRoot, outDir as string)}`);
        await copyStyles(srcDir,
            outDir as string,
            libConfig.styles,
            stylePreprocessorIncludePaths,
            libConfig.sourceMap);
    }

    // typescript transpilations
    await tsTranspilationTask(buildPipeInfo);

    // bundling
    await bundleTask(buildPipeInfo);

    // packaging
    await packagingTask(buildPipeInfo);

    // clean
    if (libConfig.cleanFiles && libConfig.cleanFiles.length && outDir) {
        logger.logLine(`Cleaning`);
        await Promise.all(libConfig.cleanFiles.map(async (fileToClean: string) => {
            await clean(path.join(outDir as string, fileToClean));
        }));
    }

    logger.logLine(`Build completed.\n`);
}
