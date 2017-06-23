import * as fs from 'fs-extra';
import * as path from 'path';
import * as rollup from 'rollup';
import * as ts from 'typescript';

import { transpileFile, TsTranspiledInfo } from '../../helpers';
import { BundleTarget } from '../../models';
import { clean, isSamePaths, normalizeRelativePath, readJson, remapSourcemap } from '../../utils';
import { addPureAnnotationsToFile, writeMinifyFile } from '../../helpers';

import { getRollupConfig, RollupConfigOptions } from '../../rollup-configs';
import { getWebpackConfig, WebpackConfigOptions } from '../../webpack-configs';

import { webpackBundle } from './webpack-bundle';
import { LibBuildPipeInfo } from './lib-build-pipe-info';

export async function bundleTask(libBuildPipeInfo: LibBuildPipeInfo): Promise<void> {
    const projectRoot = libBuildPipeInfo.projectRoot;
    const libConfig = libBuildPipeInfo.libConfig;
    const buildOptions = libBuildPipeInfo.buildOptions;
    const angularBuildConfig = libBuildPipeInfo.angularBuildConfig;
    const tsTranspiledInfoes = libBuildPipeInfo.tsTranspiledInfoes || [];
    const packageName = libBuildPipeInfo.packageName;
    const logger = libBuildPipeInfo.logger;

    let bundleTargets: BundleTarget[] = [];
    if (libConfig.bundleTargets) {
        bundleTargets = (Array.isArray(libConfig.bundleTargets)
            ? libConfig.bundleTargets
            : [libConfig.bundleTargets]).filter(
            (bundleTarget: BundleTarget) => bundleTarget && Object.keys(bundleTarget).length > 0);
    }
    if (!bundleTargets.length) {
        return;
    }

    if (!libConfig.outDir) {
        throw new Error(`The 'outDir' property is required in lib config.`);
    }

    const srcDir = path.resolve(projectRoot, libConfig.srcDir || '');
    const outDir = path.resolve(projectRoot, libConfig.outDir);
    const packageConfigOutDir = path.resolve(outDir,
        libConfig.packageOptions && libConfig.packageOptions.outDir ? libConfig.packageOptions.outDir : '');
    libBuildPipeInfo.mainFields = libBuildPipeInfo.mainFields || {};

    for (let i = 0; i < bundleTargets.length; i++) {
        const target = bundleTargets[i];
        let expectedEntryScriptTarget: string | undefined = undefined;
        let expectedEntryModuleTarget: string | undefined = undefined;
        let exactEntryScriptTarget: string | undefined = undefined;
        let exactEntryModuleTarget: string | undefined = undefined;

        let bundleRootDir = srcDir || projectRoot;
        let bundleEntryFile: string | undefined = undefined;

        let formatSuffix = target.libraryTarget &&
            target.libraryTarget !== libConfig.libraryTarget
            ? `.${target.libraryTarget}`
            : '';
        if (target.scriptTarget) {
            formatSuffix = `${formatSuffix}.${target.scriptTarget}`;
        }

        // bundleDestFileName
        let bundleDestFileName = target.outFileName;
        if (!bundleDestFileName) {
            bundleDestFileName = libConfig.outFileName
                ? `${libConfig.outFileName}${formatSuffix}.js`
                : packageName
                    ? `${packageName}${formatSuffix}.js`
                    : `main${formatSuffix}.js`;
        }

        bundleDestFileName = bundleDestFileName
            .replace(/\[name\]/g, packageName || 'main')
            .replace(/\[package-name\]/g, packageName || 'main')
            .replace(/\[packagename\]/g, packageName || 'main');
        target.outFileName = bundleDestFileName;

        let shouldInlineResources = target.inlineResources !== false;
        let useNodeResolve: boolean | undefined = undefined;
        let bundleTool = target.bundleTool || libConfig.bundleTool;

        // entry resolution
        if (target.entryResolution) {
            if (!target.entryResolution.entryRoot) {
                throw new Error(
                    `Please specify 'entryResolution.entryRoot' or remove 'entryResolution' property from bundleTargets[${
                    i
                    }].`);
            }

            if (target.entryResolution.entryRoot === 'bundleTargetOutDir') {
                let foundBundleTarget: BundleTarget | undefined = undefined;
                if (typeof target.entryResolution.bundleTargetIndex === 'number') {
                    const index = target.entryResolution.bundleTargetIndex as number;
                    if (index === i) {
                        throw new Error(
                            `The 'bundleTargetIndex' must not be the same as current item index at bundleTargets[${i
                            }].`);
                    }
                    if (index < 0 || index >= bundleTargets.length) {
                        throw new Error(
                            `No bundleTarget found with bundleTargetIndex: ${index} at bundleTargets[${i}].`);
                    }
                    foundBundleTarget = bundleTargets[index];
                } else if (target.entryResolution.bundleTargetIndex &&
                    typeof target.entryResolution.bundleTargetIndex === 'string') {
                    const bundleTargetName = target.entryResolution.bundleTargetIndex as string;
                    if (bundleTargetName === target.name) {
                        throw new Error(
                            `The 'bundleTargetIndex' must not be the same as current item name at bundleTargets[${i
                            }].`);
                    }

                    foundBundleTarget = bundleTargets.find(b => b.name === bundleTargetName);
                    if (!foundBundleTarget) {
                        throw new Error(
                            `No bundleTarget found with bundleTargetIndex: ${bundleTargetName} at bundleTargets[${i}].`);
                    }
                }
                if (typeof target.entryResolution.bundleTargetIndex === 'undefined' && i !== 0) {
                    foundBundleTarget = bundleTargets[i - 1];
                }

                if (!foundBundleTarget) {
                    throw new Error(`No bundleTarget found at bundleTargets[${i}].`);
                }

                foundBundleTarget = foundBundleTarget as BundleTarget;

                bundleRootDir = foundBundleTarget.outDir
                    ? path.resolve(outDir as string, foundBundleTarget.outDir as string)
                    : outDir as string;
                bundleEntryFile = foundBundleTarget.outFileName;
                expectedEntryModuleTarget = foundBundleTarget.libraryTarget;
                exactEntryModuleTarget = foundBundleTarget.libraryTarget;
                if (foundBundleTarget.scriptTarget !== 'es5' &&
                    /\.es2015\.js$/i.test(foundBundleTarget.outFileName as string)) {
                    expectedEntryScriptTarget = 'es2015';
                } else if (foundBundleTarget.scriptTarget === 'es5' ||
                    /\.es5\.js$/i.test(foundBundleTarget.outFileName as string)) {
                    expectedEntryScriptTarget = 'es5';
                }
                if (foundBundleTarget.scriptTarget === 'es5' && expectedEntryScriptTarget) {
                    exactEntryScriptTarget = 'es5';
                }
            } else if (target.entryResolution.entryRoot === 'tsTranspilationOutDir') {
                if (!target.entry && !libConfig.entry) {
                    throw new Error(`The main entry is required for bundling.`);
                }
                if (!tsTranspiledInfoes.length) {
                    throw new Error(`No tsTranspilation is configured at lib config.`);
                }

                let foundTsTranspilationInfo: TsTranspiledInfo | undefined;
                if (typeof target.entryResolution.tsTranspilationIndex === 'number') {
                    const index = target.entryResolution.tsTranspilationIndex as number;
                    if (index < 0 || index >= tsTranspiledInfoes.length) {
                        throw new Error(
                            `No tsTranspilation found with tsTranspilationIndex: ${index} at bundleTargets[${i}].`);
                    }
                    foundTsTranspilationInfo = tsTranspiledInfoes[index];
                } else if (target.entryResolution.tsTranspilationIndex &&
                    typeof target.entryResolution.tsTranspilationIndex === 'string') {
                    const tsTransName = target.entryResolution.tsTranspilationIndex as string;
                    foundTsTranspilationInfo = tsTranspiledInfoes.find(t => t.name === tsTransName);
                    if (!foundTsTranspilationInfo) {
                        throw new Error(
                            `No tsTranspilation found with tsTranspilationIndex: ${tsTransName} at bundleTargets[${i
                            }].`);
                    }
                } else if (typeof target.entryResolution.tsTranspilationIndex === 'undefined') {
                    foundTsTranspilationInfo = tsTranspiledInfoes[0];
                }

                if (!foundTsTranspilationInfo) {
                    throw new Error(
                        `No tsTranspilation found with at bundleTargets[${i}].`);
                }

                foundTsTranspilationInfo = foundTsTranspilationInfo as TsTranspiledInfo;
                bundleRootDir = foundTsTranspilationInfo.outDir;
                bundleEntryFile = target.entry || libConfig.entry;
                bundleEntryFile = (bundleEntryFile as string).replace(/\.ts$/i, '.js');

                expectedEntryScriptTarget = foundTsTranspilationInfo.target;
                expectedEntryModuleTarget = foundTsTranspilationInfo.module;
                exactEntryScriptTarget = foundTsTranspilationInfo.target;
                exactEntryModuleTarget = foundTsTranspilationInfo.module;
            } else if (target.entryResolution.entryRoot === 'outDir') {
                if (!target.entry && !libConfig.entry) {
                    throw new Error(`The main entry is required for bundling.`);
                }
                bundleEntryFile = target.entry || libConfig.entry;
                bundleRootDir = outDir as string;
                useNodeResolve = true;
                if (/\.es2015\.js$/i.test(bundleEntryFile as string)) {
                    expectedEntryScriptTarget = 'es2015';
                } else if (/\.es5\.js$/i.test(bundleEntryFile as string)) {
                    expectedEntryScriptTarget = 'es5';
                }
            }
        } else if (!!(target.entry || libConfig.entry) &&
            /\.ts$/i.test((target.entry || libConfig.entry) as string)) {
            if (tsTranspiledInfoes.length > 0) {
                bundleRootDir = tsTranspiledInfoes[0].outDir;
                bundleEntryFile = target.entry || libConfig.entry;
                bundleEntryFile = (bundleEntryFile as string).replace(/\.ts$/i, '.js');
                expectedEntryScriptTarget = tsTranspiledInfoes[0].target;
                expectedEntryModuleTarget = tsTranspiledInfoes[0].module;
                exactEntryScriptTarget = tsTranspiledInfoes[0].target;
                exactEntryModuleTarget = tsTranspiledInfoes[0].module;

            } else {
                bundleEntryFile = target.entry || libConfig.entry;
                if (libConfig.tsconfig) {
                    const tempTsConfig =
                        await readJson(path.resolve(projectRoot, libConfig.srcDir || '', libConfig.tsconfig));
                    if (tempTsConfig.compilerOptions && tempTsConfig.compilerOptions.target) {
                        expectedEntryScriptTarget = tempTsConfig.compilerOptions.target;
                    }
                    if (tempTsConfig.compilerOptions && tempTsConfig.compilerOptions.module) {
                        expectedEntryScriptTarget = tempTsConfig.compilerOptions.module;
                    }
                }
            }
        } else {
            bundleEntryFile = target.entry || libConfig.entry;
        }

        if (!bundleEntryFile) {
            throw new Error(`The main entry is required for bundling.`);
        }

        const bundleEntryFilePath = path.resolve(bundleRootDir, bundleEntryFile);
        if (!await fs.exists(bundleEntryFilePath)) {
            throw new Error(`The entry file '${bundleEntryFile}' cound not be found at ${bundleEntryFilePath}.`);
        }

        const bundleDestFilePath = path.resolve(projectRoot,
            libConfig.outDir,
            target.outDir || '',
            bundleDestFileName);

        if (!(target.libraryTarget || libConfig.libraryTarget) && !target.transformScriptTargetOnly) {
            throw new Error(`The 'libraryTarget' is required at bundleTargets[${i}].`);
        }

        target.libraryTarget = target.libraryTarget || libConfig.libraryTarget;
        if (target.libraryTarget === 'es' &&
            (exactEntryModuleTarget === 'amd' ||
                exactEntryModuleTarget === 'commonjs' ||
                exactEntryModuleTarget === 'umd')) {
            throw new Error(
                `Transforming library target ${exactEntryModuleTarget} -> ${target.libraryTarget
                } is not allowed at bundleTarget[${i}].`);
        }

        if (target.transformScriptTargetOnly && target.scriptTarget && target.scriptTarget !== 'none') {
            let scriptTarget: ts.ScriptTarget;
            let moduleKind: ts.ModuleKind;
            if (target.scriptTarget === 'es5') {
                scriptTarget = ts.ScriptTarget.ES5;
            } else {
                scriptTarget = ts.ScriptTarget.ES5;
            }

            if (target.libraryTarget === 'amd') {
                moduleKind = ts.ModuleKind.UMD;
            } else if (target.libraryTarget === 'commonjs' || target.libraryTarget === 'commonjs2') {
                moduleKind = ts.ModuleKind.CommonJS;
            } else if (target.libraryTarget === 'umd') {
                moduleKind = ts.ModuleKind.UMD;
            } else {
                moduleKind = ts.ModuleKind.ES2015;
            }

            if (exactEntryScriptTarget === target.scriptTarget) {
                throw new Error(
                    `Transforming the same script target ${exactEntryScriptTarget} -> ${target.scriptTarget
                    } is not allowed at bundleTarget[${i}].`);
            }
            if (exactEntryScriptTarget === 'es3' || exactEntryScriptTarget === 'es4') {
                throw new Error(
                    `Transforming script target ${exactEntryScriptTarget} -> ${target.scriptTarget
                    } is not allowed at bundleTarget[${i}].`);
            }

            logger.logLine(`Transforming ${bundleEntryFile} to ${target.scriptTarget}`);

            await transpileFile(bundleEntryFilePath,
                bundleDestFilePath,
                {
                    importHelpers: true,
                    target: scriptTarget,
                    module: moduleKind,
                    allowJs: /\.ts$/i.test(bundleEntryFilePath) === false
                });

            if (moduleKind === ts.ModuleKind.ES2015 && scriptTarget === ts.ScriptTarget.ES5) {
                libBuildPipeInfo.mainFields.module =
                    normalizeRelativePath(path.relative(packageConfigOutDir, bundleDestFilePath));
            } else if ((moduleKind === ts.ModuleKind.UMD || moduleKind === ts.ModuleKind.CommonJS) &&
                scriptTarget === ts.ScriptTarget.ES5) {
                libBuildPipeInfo.mainFields.main =
                    normalizeRelativePath(path.relative(packageConfigOutDir, bundleDestFilePath));
            }

            // Remapping sourcemaps
            if (libConfig.sourceMap && bundleRootDir !== srcDir && bundleTool !== 'webpack') {
                logger.logLine(`Remapping sourcemaps`);
                await remapSourcemap(bundleDestFilePath);
            }
        } else {
            if (packageConfigOutDir &&
                target.libraryTarget === 'es' &&
                (expectedEntryScriptTarget === 'es2015') &&
                (expectedEntryScriptTarget === 'es2015' || exactEntryScriptTarget === 'es2015') &&
                target.scriptTarget !== 'es5') {
                libBuildPipeInfo.mainFields.es2015 =
                    normalizeRelativePath(path.relative(packageConfigOutDir, bundleDestFilePath));
            } else if (packageConfigOutDir &&
                target.libraryTarget === 'es' &&
                (!expectedEntryScriptTarget ||
                    expectedEntryScriptTarget === 'es5' ||
                    exactEntryScriptTarget === 'es5' ||
                    target.scriptTarget === 'es5')) {
                libBuildPipeInfo.mainFields.module =
                    normalizeRelativePath(path.relative(packageConfigOutDir, bundleDestFilePath));
            } else if (packageConfigOutDir &&
                target.libraryTarget === 'umd' &&
                (!expectedEntryScriptTarget ||
                    expectedEntryScriptTarget === 'es5' ||
                    exactEntryScriptTarget === 'es5' ||
                    target.scriptTarget === 'es5')) {
                libBuildPipeInfo.mainFields.main =
                    normalizeRelativePath(path.relative(packageConfigOutDir, bundleDestFilePath));
            }

            let reTransformScriptTarget = false;
            let tempBundleDestFileName = bundleDestFileName;

            if (!target.transformScriptTargetOnly &&
                target.scriptTarget &&
                target.scriptTarget !== 'none' &&
                exactEntryScriptTarget !== target.scriptTarget &&
                expectedEntryScriptTarget !== target.scriptTarget) {
                reTransformScriptTarget = true;
                tempBundleDestFileName = bundleDestFileName.replace(/\.js$/i, '') + '.temp.js';
            }

            const tempBundleDestFilePath = path.resolve(projectRoot,
                libConfig.outDir,
                target.outDir || '',
                tempBundleDestFileName);

            if (bundleTool === 'webpack') {
                logger.logLine(`Bundling ${target.name ? target.name + ' ' : ''}with webpack`);

                const webpackConfigOptions: WebpackConfigOptions = {
                    projectRoot: projectRoot,
                    projectConfig: libConfig,
                    buildOptions: buildOptions,
                    angularBuildConfig: angularBuildConfig,

                    bundleLibraryTarget: target.libraryTarget,
                    bundleRoot: bundleRootDir,
                    bundleEntryFile: bundleEntryFile,
                    bundleOutDir: target.outDir,
                    bundleOutFileName: tempBundleDestFileName,
                    packageName: packageName,
                    inlineResources: shouldInlineResources,

                    logger: logger
                };

                const webpackConfig = getWebpackConfig(webpackConfigOptions);
                await webpackBundle(webpackConfig, buildOptions, null, false, undefined, logger);
            } else {
                logger.logLine(`Bundling ${target.name ? target.name + ' ' : ''}with rollup`);

                const rollupConfigOptions: RollupConfigOptions = {
                    projectRoot: projectRoot,
                    projectConfig: libConfig,
                    buildOptions: buildOptions,
                    angularBuildConfig: angularBuildConfig,

                    bundleLibraryTarget: target.libraryTarget,
                    bundleRoot: bundleRootDir,
                    bundleEntryFile: bundleEntryFile,
                    bundleOutDir: target.outDir,
                    bundleOutFileName: tempBundleDestFileName,
                    packageName: packageName,
                    inlineResources: shouldInlineResources,
                    useNodeResolve: useNodeResolve,

                    logger: logger
                };
                const rollupOptions = getRollupConfig(rollupConfigOptions);
                const bundle = await rollup.rollup(rollupOptions.options);
                await bundle.write(rollupOptions.writeOptions);

                // Remapping sourcemaps
                if (libConfig.sourceMap && bundleRootDir !== srcDir) {
                    logger.logLine(`Remapping sourcemaps`);
                    await remapSourcemap(tempBundleDestFilePath);
                }
            }

            // transform script version
            if (reTransformScriptTarget) {
                let scriptTarget: ts.ScriptTarget;
                let moduleKind: ts.ModuleKind;
                if (target.scriptTarget === 'es5') {
                    scriptTarget = ts.ScriptTarget.ES5;
                } else {
                    scriptTarget = ts.ScriptTarget.ES5;
                }

                if (target.libraryTarget === 'amd') {
                    moduleKind = ts.ModuleKind.UMD;
                } else if (target.libraryTarget === 'commonjs' || target.libraryTarget === 'commonjs2') {
                    moduleKind = ts.ModuleKind.CommonJS;
                } else if (target.libraryTarget === 'umd') {
                    moduleKind = ts.ModuleKind.UMD;
                } else {
                    moduleKind = ts.ModuleKind.ES2015;
                }

                if (exactEntryScriptTarget === target.scriptTarget) {
                    throw new Error(
                        `Transforming the same script target ${exactEntryScriptTarget} -> ${target.scriptTarget
                        } is not allowed at bundleTarget[${i}].`);
                }
                if (exactEntryScriptTarget === 'es3' || exactEntryScriptTarget === 'es4') {
                    throw new Error(
                        `Transforming script target ${exactEntryScriptTarget} -> ${target.scriptTarget
                        } is not allowed at bundleTarget[${i}].`);
                }

                logger.logLine(`Transforming ${bundleEntryFile} to ${target.scriptTarget}`);
                await transpileFile(tempBundleDestFilePath,
                    bundleDestFilePath,
                    {
                        importHelpers: true,
                        target: scriptTarget,
                        module: moduleKind,
                        allowJs: true
                    });

                // Remapping sourcemaps
                if (libConfig.sourceMap && bundleTool !== 'webpack') {
                    logger.logLine(`Remapping sourcemaps`);
                    await remapSourcemap(bundleDestFilePath);
                }

                if (packageConfigOutDir &&
                    moduleKind === ts.ModuleKind.ES2015 &&
                    scriptTarget === ts.ScriptTarget.ES5) {
                    libBuildPipeInfo.mainFields.module =
                        normalizeRelativePath(path.relative(packageConfigOutDir, bundleDestFilePath));
                } else if (packageConfigOutDir &&
                    moduleKind === ts.ModuleKind.UMD &&
                    scriptTarget === ts.ScriptTarget.ES5) {
                    libBuildPipeInfo.mainFields.main =
                        normalizeRelativePath(path.relative(packageConfigOutDir, bundleDestFilePath));
                }

                if (!isSamePaths(tempBundleDestFilePath, bundleDestFilePath)) {
                    await clean(tempBundleDestFilePath.replace(/\.js/i, '') + '.*');
                }
            }
        }

        // minify umd es5 files
        if (target.libraryTarget === 'umd' &&
            bundleTool !== 'webpack' &&
            (exactEntryScriptTarget === 'es5' ||
                target.scriptTarget === 'es5')) {
            const minFilePath = bundleDestFilePath.replace(/\.js$/i, '.min.js');
            logger.logLine(`Minifying ${path.parse(bundleDestFilePath).base}`);
            await writeMinifyFile(bundleDestFilePath,
                minFilePath,
                libConfig.sourceMap,
                libConfig.preserveLicenseComments,
                buildOptions.verbose,
                logger);

            // Remapping sourcemaps
            if (libConfig.sourceMap) {
                logger.logLine(`Remapping sourcemaps`);
                await remapSourcemap(bundleDestFilePath);
            }
        }

        // add pure annotations
        if (target.addPureAnnotations &&
            bundleTool !== 'webpack' &&
            target.libraryTarget === 'es' &&
            (target.scriptTarget === 'es5' ||
                !expectedEntryScriptTarget ||
                expectedEntryScriptTarget === 'es5')) {
            logger.logLine(`Adding pure annotations to ${path.parse(bundleDestFilePath).base}`);
            await addPureAnnotationsToFile(bundleDestFilePath);
        }
    }
}
