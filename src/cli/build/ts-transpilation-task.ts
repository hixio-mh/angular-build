import * as fs from 'fs-extra';
import * as path from 'path';

import { getTsTranspileInfo, processNgResources, tsTranspile, TsTranspiledInfo } from '../../helpers';
import { BundleTarget, TsTranspilation } from '../../models';
import { clean, isSamePaths, normalizeRelativePath } from '../../utils';

import { LibBuildPipeInfo } from './lib-build-pipe-info';

export async function tsTranspilationTask(libBuildPipeInfo: LibBuildPipeInfo): Promise<void> {
    const projectRoot = libBuildPipeInfo.projectRoot;
    const libConfig = libBuildPipeInfo.libConfig;
    const logger = libBuildPipeInfo.logger;

    let tsTranspilations: TsTranspilation[] = [];
    if (libConfig.tsTranspilations) {
        tsTranspilations = (Array.isArray(libConfig.tsTranspilations)
            ? libConfig.tsTranspilations
            : [libConfig.tsTranspilations]).filter(
            (tsTranspilation: TsTranspilation) => tsTranspilation && Object.keys(tsTranspilation).length > 0);
    }

    if (!tsTranspilations.length) {
        return;
    }

    libBuildPipeInfo.mainFields = libBuildPipeInfo.mainFields || {};

    const srcDir = path.resolve(projectRoot, libConfig.srcDir);
    const processedTsTanspileInfoes: TsTranspiledInfo[] = [];

    for (let tsTranspilation of tsTranspilations) {
        const tsTanspileInfo = await getTsTranspileInfo(projectRoot, libConfig, tsTranspilation);
        const foundItem = processedTsTanspileInfoes.find(info => info.outDir === tsTanspileInfo.outDir);
        if (foundItem) {
            logger.warnLine(`The same 'outDir' is used at tsTranspilations and skipping.`);
            continue;
        }

        let pathToWriteFile: string | null = null;
        if (tsTanspileInfo.shouldCreateTempTsConfig) {
            const dirToCreate = path.dirname(tsTanspileInfo.sourceTsConfigPath);
            await fs.ensureDir(dirToCreate);
            pathToWriteFile =
                tsTanspileInfo.sourceTsConfigPath.replace(/\.json$/ig,
                    `.${tsTanspileInfo.module}-${tsTanspileInfo.target}.json`) as string;
            let configExists = await fs.exists(pathToWriteFile);
            let i = 0;
            while (configExists) {
                i++;
                pathToWriteFile = tsTanspileInfo.sourceTsConfigPath.replace(/\.json$/ig,
                    `.${tsTanspileInfo.module}-${tsTanspileInfo.target}-${i}.json`) as string;
                configExists = await fs.exists(pathToWriteFile);
            }
            await fs.writeJson(pathToWriteFile, tsTanspileInfo.tsConfigJson);
        }

        logger.logLine(
            `Typescript compiling with ngc, ${tsTanspileInfo.name ? `name: ${tsTanspileInfo.name}, ` : ''
            }tsconfig: ${path.relative(projectRoot,
                tsTanspileInfo.sourceTsConfigPath
            )}, target: ${
            tsTanspileInfo.target}, module: ${tsTanspileInfo.module}`);

        await tsTranspile(pathToWriteFile || tsTanspileInfo.sourceTsConfigPath);
        processedTsTanspileInfoes.push(tsTanspileInfo);

        let packageConfigOutDir = '';
        if (libConfig.outDir) {
            packageConfigOutDir = path.resolve(projectRoot,
                libConfig.outDir,
                libConfig.packageOptions && libConfig.packageOptions.outDir ? libConfig.packageOptions.outDir : '');
        }

        // add to main fields
        if (packageConfigOutDir) {
            let expectedTypingEntryFile = '';
            let expectedMainEntryFile = '';

            let foundBundleTarget: BundleTarget | undefined = undefined;
            if (libConfig.bundleTargets && Array.isArray(libConfig.bundleTargets)) {
                foundBundleTarget = (libConfig.bundleTargets as BundleTarget[]).find(
                    (bundleTarget: BundleTarget) => !!bundleTarget &&
                        !!bundleTarget.entryResolution &&
                        bundleTarget.entryResolution.entryRoot === 'tsTranspilationOutDir');
            } else if (libConfig.bundleTargets) {
                const tempBundleTarget = libConfig.bundleTargets as BundleTarget;
                if (tempBundleTarget &&
                    tempBundleTarget.entryResolution &&
                    tempBundleTarget.entryResolution.entryRoot === 'tsTranspilationOutDir') {
                    foundBundleTarget = tempBundleTarget;
                }
            }

            if (libConfig.entry &&
                await fs.exists(path.resolve(tsTanspileInfo.outDir,
                    libConfig.entry.replace(/\.ts$/i, '.js')))) {
                expectedMainEntryFile = libConfig.entry.replace(/\.ts$/i, '.js');
            } else if (libConfig.packageOptions &&
                libConfig.packageOptions.typingsAndMetaData &&
                libConfig.packageOptions.typingsAndMetaData.entry &&
                await fs.exists(path.resolve(tsTanspileInfo.outDir,
                    libConfig.packageOptions.typingsAndMetaData.entry.replace(/\.d\.ts$/i, '.js')
                        .replace(/\.ts$/i, '.js')))) {
                expectedMainEntryFile = libConfig.packageOptions.typingsAndMetaData.entry.replace(/\.d\.ts$/i, '.js')
                    .replace(/\.ts$/i, '.js');
            } else if (foundBundleTarget &&
                foundBundleTarget.entry &&
                await fs.exists(path.resolve(tsTanspileInfo.outDir,
                    foundBundleTarget.entry.replace(/\.ts$/i, '.js')))) {
                expectedMainEntryFile = foundBundleTarget.entry.replace(/\.ts$/i, '.js');
            } else if (tsTanspileInfo.tsConfigJson.files &&
                tsTanspileInfo.tsConfigJson.files.length &&
                tsTanspileInfo.tsConfigJson.files.length <= 2 &&
                !/\.d\.ts$/i.test(tsTanspileInfo.tsConfigJson.files[0]) &&
                await fs.exists(path.resolve(tsTanspileInfo.outDir, tsTanspileInfo.tsConfigJson.files[0]))) {
                expectedMainEntryFile = (tsTanspileInfo.tsConfigJson.files[0] as string).replace(/\.ts$/i, '.js');
            } else if (await fs.exists(path.resolve(tsTanspileInfo.outDir, 'index.js'))) {
                expectedMainEntryFile = 'index.js';
            }

            expectedTypingEntryFile = expectedMainEntryFile.replace(/\.js$/i, '.d.ts');

            if (expectedMainEntryFile && tsTanspileInfo.module === 'es2015' && tsTanspileInfo.target === 'es2015') {
                libBuildPipeInfo.mainFields.es2015 = normalizeRelativePath(path.relative(packageConfigOutDir,
                    path.join(tsTanspileInfo.outDir, expectedMainEntryFile)));
            } else if (expectedMainEntryFile &&
                (tsTanspileInfo.module === 'es2015') &&
                tsTanspileInfo.target === 'es5') {
                libBuildPipeInfo.mainFields.module = normalizeRelativePath(path.relative(packageConfigOutDir,
                    path.join(tsTanspileInfo.outDir, expectedMainEntryFile)));
            } else if (expectedMainEntryFile &&
                (tsTanspileInfo.module === 'umd' ||
                    tsTanspileInfo.module === 'commonjs' ||
                    tsTanspileInfo.module === 'es6') &&
                (tsTanspileInfo.target === 'es6' || tsTanspileInfo.target === 'es5')) {
                libBuildPipeInfo.mainFields.main = normalizeRelativePath(path.relative(packageConfigOutDir,
                    path.join(tsTanspileInfo.outDir, expectedMainEntryFile)));
            }

            if (expectedMainEntryFile &&
                expectedTypingEntryFile &&
                tsTanspileInfo.declaration &&
                await fs.exists(path.resolve(tsTanspileInfo.outDir, expectedTypingEntryFile)) &&
                (!libBuildPipeInfo.mainFields.typings ||
                    !await fs.exists(path.resolve(tsTanspileInfo.outDir, libBuildPipeInfo.mainFields.typings)) ||
                    !libConfig.outDir ||
                    !isSamePaths(path.resolve(projectRoot, libConfig.outDir), tsTanspileInfo.outDir))) {
                libBuildPipeInfo.mainFields.typings = normalizeRelativePath(path.relative(packageConfigOutDir,
                    path.join(tsTanspileInfo.outDir, expectedTypingEntryFile)));
            }
        }

        if (pathToWriteFile && !isSamePaths(pathToWriteFile, tsTanspileInfo.sourceTsConfigPath)) {
            await clean(pathToWriteFile);
        }

        if (tsTranspilation.copyTemplateAndStyleUrls !== false || tsTranspilation.inlineMetaDataResources) {
            logger.logLine(`Copying/inlining angular template and styles`);

            let stylePreprocessorIncludePaths: string[] = [];
            if (libConfig.stylePreprocessorOptions && libConfig.stylePreprocessorOptions.includePaths) {
                stylePreprocessorIncludePaths =
                    libConfig.stylePreprocessorOptions.includePaths.map(p => path.resolve(srcDir, p));
            }
            await processNgResources(
                srcDir,
                tsTanspileInfo.outDir,
                `${path.join(tsTanspileInfo.outDir, '**/*.js')}`,
                stylePreprocessorIncludePaths,
                tsTanspileInfo.aotGenDir,
                tsTranspilation.copyTemplateAndStyleUrls !== false,
                tsTranspilation.inlineMetaDataResources,
                tsTanspileInfo.flatModuleOutFile
                    ? tsTanspileInfo.flatModuleOutFile.replace(/\.js$/i, '.metadata.json')
                    : '');
        }
    }

    libBuildPipeInfo.tsTranspiledInfoes = processedTsTanspileInfoes;
}
