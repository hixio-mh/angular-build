import * as path from 'path';
import * as fs from 'fs-extra';
import * as rollup from 'rollup';
import * as ts from 'typescript';

import {
    addPureAnnotationsToFile, copyAssets, copyStyles, defaultAngularAndRxJsExternals,
    getTsTranspileInfo, prepareBannerSync, processNgResources, transpileFile, tsTranspile, TsTranspiledInfo, writeMinifyFile
} from
    '../../helpers';
import { AngularBuildConfig, BundleTarget, BuildOptions, LibProjectConfig, TsTranspilation, TypingsAndMetaDataReExport } from
    '../../models';
import { clean, Logger, readJson, remapSourcemap } from '../../utils';
import { getWebpackConfig, WebpackConfigOptions } from '../../webpack-configs';
import { getRollupConfig, RollupConfigOptions } from '../../rollup-configs';

import { webpackBundle } from './webpack-bundle';

export async function buildLib(projectRoot: string,
    libConfig: LibProjectConfig,
    buildOptions: BuildOptions,
    angularBuildConfig: AngularBuildConfig,
    cliIsLocal?: boolean,
    logger: Logger = new Logger()): Promise<any> {
    if (!projectRoot) {
        throw new Error(`The 'projectRoot' is required.`);
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

    const mainFields: { [key: string]: string } = {};
    const packageConfigOutDir = path.resolve(outDir,
        libConfig.packageOptions && libConfig.packageOptions.outDir
            ? libConfig.packageOptions.outDir
            : '');

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
    const processedTsTanspileInfoes: TsTranspiledInfo[] = [];
    if (tsTranspilations.length) {
        for (let tsTranspilation of tsTranspilations) {
            const tsTanspileInfo = await getTsTranspileInfo(projectRoot, libConfig, tsTranspilation);
            const foundItem = processedTsTanspileInfoes.find(info => info.outDir === tsTanspileInfo.outDir);
            if (foundItem) {
                logger.warnLine(`The same 'outDir' is used at tsTranspilations and skipping it.`);
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

            let expectedTypingEntryFile = '';

            // add to main fields
            if (packageConfigOutDir) {
                let expectedEntryFile = '';
                if (await fs.exists(path.resolve(tsTanspileInfo.outDir, 'index.js'))) {
                    expectedEntryFile = 'index.js';
                } else {
                    if (libConfig.entry &&
                        await fs.exists(path.resolve(tsTanspileInfo.outDir,
                            libConfig.entry.replace(/\.ts$/i, '.js')))) {
                        expectedEntryFile = libConfig.entry.replace(/\.ts$/i, '.js');
                    } else {
                        const foundBundleTarget = bundleTargets.find(t => !!t.entry &&
                            !!t.entryResolution &&
                            t.entryResolution.entryRoot === 'tsTranspilationOutDir');
                        if (foundBundleTarget && foundBundleTarget.entry) {
                            expectedEntryFile = foundBundleTarget.entry;
                        } else if (tsTanspileInfo.tsConfigJson.files &&
                            tsTanspileInfo.tsConfigJson.files.length &&
                            tsTanspileInfo.tsConfigJson.files.length <= 2) {
                            let firstFile = (tsTanspileInfo.tsConfigJson.files[0] as string).replace(/\.ts$/i, '.js');
                            if (!/\.d\.js$/i.test(firstFile) &&
                                await fs.exists(path.resolve(tsTanspileInfo.outDir, firstFile))) {
                                expectedEntryFile = firstFile;
                            }
                        }
                    }
                }
                expectedTypingEntryFile = expectedEntryFile.replace(/\.js$/i, '.d.ts');

                if (expectedEntryFile && tsTanspileInfo.module === 'es2015' && tsTanspileInfo.target === 'es2015') {
                    mainFields.es2015 = path.relative(packageConfigOutDir,
                        path.join(tsTanspileInfo.outDir, expectedEntryFile)).replace(/\\/g, '/');
                } else if (expectedEntryFile && tsTanspileInfo.module === 'es2015' && tsTanspileInfo.target === 'es5') {
                    mainFields.module = path.relative(packageConfigOutDir,
                        path.join(tsTanspileInfo.outDir, expectedEntryFile)).replace(/\\/g, '/');
                }
                if (expectedEntryFile &&
                    expectedTypingEntryFile &&
                    tsTanspileInfo.declaration &&
                    await fs.exists(path.resolve(tsTanspileInfo.outDir, expectedTypingEntryFile))) {
                    mainFields.typings = path.relative(packageConfigOutDir,
                        path.join(tsTanspileInfo.outDir, expectedTypingEntryFile)).replace(/\\/g, '/');
                }
            }

            if (pathToWriteFile && pathToWriteFile !== tsTanspileInfo.sourceTsConfigPath) {
                await clean(pathToWriteFile);
            }

            if (tsTranspilation.copyTemplateAndStyleUrls !== false || tsTranspilation.inlineMetaDataResources) {
                logger.logLine(`Copying/inlining angular template and styles`);

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

    // externals
    if (libConfig.includeAngularAndRxJsExternals !== false) {
        if (libConfig.externals && Array.isArray(libConfig.externals)) {
            const externals = Object.assign({}, defaultAngularAndRxJsExternals);
            (libConfig.externals as Array<any>).push(externals);
        } else {
            libConfig.externals = Object.assign({}, defaultAngularAndRxJsExternals, libConfig.externals || {});
        }
    }

    // bundleTargets
    if (bundleTargets.length === 0 && libConfig.libraryTarget) {
        // create default bundle target
        const defaultBundleTarget: BundleTarget = {
            libraryTarget: libConfig.libraryTarget
        };
        bundleTargets.push(defaultBundleTarget);
    }

    // bundling
    if (bundleTargets.length) {
        if (!outDir) {
            throw new Error(`The 'outDir' property is required in lib config.`);
        }

        const skipBundleIds: number[] = [];
        for (let i = 0; i < bundleTargets.length; i++) {
            const target = bundleTargets[i];
            let expectedSourceScriptTarget: string | undefined = undefined;

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
                    : packageNameWithoutScope
                        ? `${packageNameWithoutScope}${formatSuffix}.js` : `main${formatSuffix}.js`;
            }

            bundleDestFileName = bundleDestFileName.replace(/\[name\]/g,
                packageNameWithoutScope || 'main');
            target.outFileName = bundleDestFileName;

            let shouldSkipThisTarget = false;
            for (let j = 0; j < i; j++) {
                if ((bundleTargets[j].outFileName as string).toLowerCase() === bundleDestFileName.toLowerCase()) {
                    logger.warnLine(
                        `The same bundle 'outFileName': ${bundleDestFileName} found and skipping this target.`);
                    shouldSkipThisTarget = true;
                    break;
                }
            }
            if (shouldSkipThisTarget) {
                skipBundleIds.push(i);
                continue;
            }

            let shouldInlineResources = target.inlineResources !== false;
            let useNodeResolve: boolean | undefined = undefined;

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
                    if (typeof target.entryResolution.bundleTargetIndex === 'undefined' &&
                        i !== 0 &&
                        skipBundleIds.indexOf(i - 1) === -1) {

                        foundBundleTarget = bundleTargets[i - 1];
                    }

                    if (!foundBundleTarget) {
                        throw new Error(`No bundleTarget found at bundleTargets[${i}].`);
                    }

                    foundBundleTarget = foundBundleTarget as BundleTarget;

                    if (foundBundleTarget.libraryTarget !== 'es') {
                        throw new Error(
                            `The reference library target must be 'es' at bundleTargets[${i}].`);
                    }

                    bundleRootDir = foundBundleTarget.outDir
                        ? path.resolve(outDir as string, foundBundleTarget.outDir as string)
                        : outDir as string;
                    bundleEntryFile = foundBundleTarget.outFileName;
                    if (foundBundleTarget.scriptTarget !== 'es5' &&
                        /\.es2015\.js$/i.test(foundBundleTarget.outFileName as string)) {
                        expectedSourceScriptTarget = 'es2015';
                    } else if (foundBundleTarget.scriptTarget === 'es5' ||
                        /\.es5\.js$/i.test(foundBundleTarget.outFileName as string)) {
                        expectedSourceScriptTarget = 'es5';
                    }
                } else if (target.entryResolution.entryRoot === 'tsTranspilationOutDir') {
                    if (!target.entry && !libConfig.entry) {
                        throw new Error(`The main entry is required for bundling.`);
                    }
                    if (!processedTsTanspileInfoes.length) {
                        throw new Error(`No tsTranspilation is configured at lib config.`);
                    }

                    let foundTsTranspilationInfo: TsTranspiledInfo | undefined;
                    if (typeof target.entryResolution.tsTranspilationIndex === 'number') {
                        const index = target.entryResolution.tsTranspilationIndex as number;
                        if (index < 0 || index >= processedTsTanspileInfoes.length) {
                            throw new Error(
                                `No tsTranspilation found with tsTranspilationIndex: ${index} at bundleTargets[${i}].`);
                        }
                        foundTsTranspilationInfo = processedTsTanspileInfoes[index];
                    } else if (target.entryResolution.tsTranspilationIndex &&
                        typeof target.entryResolution.tsTranspilationIndex === 'string') {
                        const tsTransName = target.entryResolution.tsTranspilationIndex as string;
                        foundTsTranspilationInfo = processedTsTanspileInfoes.find(t => t.name === tsTransName);
                        if (!foundTsTranspilationInfo) {
                            throw new Error(
                                `No tsTranspilation found with tsTranspilationIndex: ${tsTransName} at bundleTargets[${i
                                }].`);
                        }
                    } else if (typeof target.entryResolution.tsTranspilationIndex === 'undefined') {
                        foundTsTranspilationInfo = processedTsTanspileInfoes[0];
                    }

                    if (!foundTsTranspilationInfo) {
                        throw new Error(
                            `No tsTranspilation found with at bundleTargets[${i}].`);
                    }

                    foundTsTranspilationInfo = foundTsTranspilationInfo as TsTranspiledInfo;
                    bundleRootDir = foundTsTranspilationInfo.outDir;
                    bundleEntryFile = target.entry || libConfig.entry;
                    bundleEntryFile = (bundleEntryFile as string).replace(/\.ts$/i, '.js');
                    expectedSourceScriptTarget = foundTsTranspilationInfo.target;
                } else if (target.entryResolution.entryRoot === 'outDir') {
                    if (!target.entry && !libConfig.entry) {
                        throw new Error(`The main entry is required for bundling.`);
                    }
                    bundleEntryFile = target.entry || libConfig.entry;
                    bundleRootDir = outDir as string;
                    useNodeResolve = true;
                    if (/\.es2015\.js$/i.test(bundleEntryFile as string)) {
                        expectedSourceScriptTarget = 'es2015';
                    } else if (/\.es5\.js$/i.test(bundleEntryFile as string)) {
                        expectedSourceScriptTarget = 'es5';
                    }
                }
            } else if (!!(target.entry || libConfig.entry) &&
                /\.ts$/i.test((target.entry || libConfig.entry) as string)) {
                if (processedTsTanspileInfoes.length > 0) {
                    bundleRootDir = processedTsTanspileInfoes[0].outDir;
                    bundleEntryFile = target.entry || libConfig.entry;
                    bundleEntryFile = (bundleEntryFile as string).replace(/\.ts$/i, '.js');
                    expectedSourceScriptTarget = processedTsTanspileInfoes[0].target;
                } else {
                    bundleEntryFile = target.entry || libConfig.entry;
                    if (libConfig.tsconfig) {
                        const tempTsConfig =
                            await readJson(path.resolve(projectRoot, libConfig.srcDir || '', libConfig.tsconfig));
                        if (tempTsConfig.compilerOptions && tempTsConfig.compilerOptions.target) {
                            expectedSourceScriptTarget = tempTsConfig.compilerOptions.target;
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

                target.libraryTarget = target.libraryTarget || libConfig.libraryTarget;
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
                    mainFields.module = path.relative(packageConfigOutDir, bundleDestFilePath).replace(/\\/g, '/');
                } else if (moduleKind === ts.ModuleKind.UMD && scriptTarget === ts.ScriptTarget.ES5) {
                    mainFields.main = path.relative(packageConfigOutDir, bundleDestFilePath).replace(/\\/g, '/');
                }
            } else {
                target.libraryTarget = target.libraryTarget || libConfig.libraryTarget;
                if (target.libraryTarget === 'es' &&
                    expectedSourceScriptTarget === 'es2015' &&
                    target.scriptTarget !== 'es5') {
                    mainFields.es2015 = path.relative(packageConfigOutDir, bundleDestFilePath).replace(/\\/g, '/');
                } else if (target.libraryTarget === 'es' &&
                    (!expectedSourceScriptTarget ||
                        expectedSourceScriptTarget === 'es5' ||
                        target.scriptTarget === 'es5')) {
                    mainFields.module = path.relative(packageConfigOutDir, bundleDestFilePath).replace(/\\/g, '/');
                } else if (target.libraryTarget === 'umd' &&
                    (!expectedSourceScriptTarget ||
                        expectedSourceScriptTarget === 'es5' ||
                        target.scriptTarget === 'es5')) {
                    mainFields.main = path.relative(packageConfigOutDir, bundleDestFilePath).replace(/\\/g, '/');
                }

                if (libConfig.bundleTool === 'webpack') {
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
                        bundleOutFileName: target.outFileName,
                        packageName: packageNameWithoutScope,
                        inlineResources: shouldInlineResources,

                        logger: logger
                    };
                    const webpackConfig = getWebpackConfig(webpackConfigOptions);
                    await webpackBundle(webpackConfig, buildOptions, false, undefined, logger);
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
                        bundleOutFileName: target.outFileName,
                        packageName: packageNameWithoutScope,
                        inlineResources: shouldInlineResources,
                        useNodeResolve: useNodeResolve,

                        logger: logger
                    };
                    const rollupOptions = getRollupConfig(rollupConfigOptions);
                    const bundle = await rollup.rollup(rollupOptions.options);
                    await bundle.write(rollupOptions.writeOptions);
                }

                // transform script version
                if (!target.transformScriptTargetOnly &&
                    target.scriptTarget &&
                    target.scriptTarget !== 'none' &&
                    expectedSourceScriptTarget !== target.scriptTarget) {
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

                    logger.logLine(`Transforming ${bundleEntryFile} to ${target.scriptTarget}`);
                    await transpileFile(bundleDestFilePath,
                        bundleDestFilePath,
                        {
                            importHelpers: true,
                            target: scriptTarget,
                            module: moduleKind,
                            allowJs: true
                        });

                    if (moduleKind === ts.ModuleKind.ES2015 && scriptTarget === ts.ScriptTarget.ES5) {
                        mainFields.module = path.relative(packageConfigOutDir, bundleDestFilePath).replace(/\\/g, '/');
                    } else if (moduleKind === ts.ModuleKind.UMD && scriptTarget === ts.ScriptTarget.ES5) {
                        mainFields.main = path.relative(packageConfigOutDir, bundleDestFilePath).replace(/\\/g, '/');
                    }
                }
            }

            // Remapping sourcemaps
            if (libConfig.sourceMap && bundleRootDir !== srcDir) {
                logger.logLine(`Remapping sourcemaps`);
                await remapSourcemap(bundleDestFilePath);
            }

            // minify umd es5 files
            if (target.libraryTarget === 'umd' &&
                (!expectedSourceScriptTarget ||
                    expectedSourceScriptTarget === 'es5' ||
                    target.scriptTarget === 'es5')) {
                const minFilePath = bundleDestFilePath.replace(/\.js$/i, '.min.js');
                logger.logLine(`Minifying ${path.parse(bundleDestFilePath).base}`);
                await writeMinifyFile(bundleDestFilePath,
                    minFilePath,
                    libConfig.sourceMap,
                    libConfig.preserveLicenseComments,
                    buildOptions.verbose,
                    logger);
            }

            // add pure annotations
            if (target.addPureAnnotations &&
                target.libraryTarget === 'es' &&
                (target.scriptTarget === 'es5' ||
                    !expectedSourceScriptTarget ||
                    expectedSourceScriptTarget === 'es5')) {
                logger.logLine(`Adding pure annotations to ${path.parse(bundleDestFilePath).base}`);
                await addPureAnnotationsToFile(bundleDestFilePath);
            }

        }
    }

    // packaging
    if (libConfig.packageOptions && libConfig.packageOptions.packageConfigFile) {
        if (!libConfig.outDir) {
            throw new Error(`The 'outDir' property is required by lib config -> 'packageOptions'.`);
        }

        // read package info
        let libPackageConfig = await readJson(path.resolve(srcDir, libConfig.packageOptions.packageConfigFile));
        let rootPackageConfig: any = null;
        if (await fs.exists(path.resolve(projectRoot, 'package.json'))) {
            rootPackageConfig = await readJson(path.resolve(projectRoot, 'package.json'));
        }

        if (libPackageConfig.devDependencies) {
            delete libPackageConfig.devDependencies;
        }
        if (libPackageConfig.srcipts) {
            delete libPackageConfig.srcipts;
        }

        if (libConfig.packageOptions.useRootPackageConfigVerion !== false &&
            !!rootPackageConfig &&
            !!rootPackageConfig.version) {
            libPackageConfig.version = rootPackageConfig.version;
        }

        // typing and meta-data re-exports
        if (libConfig.packageOptions.typingsAndMetaDataReExport &&
            (libConfig.packageOptions.typingsAndMetaDataReExport.entry ||
                libConfig.packageOptions.typingsAndMetaDataReExport.outFileName)) {
            const typingsAndMetaDataReExport =
                libConfig.packageOptions.typingsAndMetaDataReExport as TypingsAndMetaDataReExport;
            if (!processedTsTanspileInfoes.length) {
                throw new Error(
                    `No proper typescript transpilation output found. The lib config -> 'packageOptions.typingsAndMetaDataReExport' ` +
                    `requires typescript transpilation.`);
            }

            let foundTsTranspilationInfo: TsTranspiledInfo | undefined;
            if (typeof typingsAndMetaDataReExport.tsTranspilationIndex === 'number') {
                const index = typingsAndMetaDataReExport.tsTranspilationIndex as number;
                if (index < 0 || index >= processedTsTanspileInfoes.length) {
                    throw new Error(
                        `No proper typescript transpilation output found with tsTranspilationIndex: ${index}. ` +
                        `Please correct 'tsTranspilationIndex' in lib config -> 'packageOptions.typingsAndMetaData.tsTranspilationIndex'.`);
                }
                foundTsTranspilationInfo = processedTsTanspileInfoes[index];
            } else if (typingsAndMetaDataReExport.tsTranspilationIndex &&
                typeof typingsAndMetaDataReExport.tsTranspilationIndex === 'string') {
                const tsTransName = typingsAndMetaDataReExport.tsTranspilationIndex as string;
                foundTsTranspilationInfo = processedTsTanspileInfoes.find(t => t.name === tsTransName);
                if (!foundTsTranspilationInfo) {
                    throw new Error(
                        `No proper typescript transpilation output found with tsTranspilationIndex: ${tsTransName}. ` +
                        `Please correct 'tsTranspilationIndex' in lib config -> 'packageOptions.typingsAndMetaData.tsTranspilationIndex'.`);
                }
            } else if (typeof typingsAndMetaDataReExport.tsTranspilationIndex === 'undefined') {
                foundTsTranspilationInfo = processedTsTanspileInfoes[0];
            }
            if (!foundTsTranspilationInfo) {
                throw new Error(
                    `No proper typescript transpilation output found. The lib config -> 'packageOptions.typingsAndMetaData' ` +
                    `requires typescript transpilation.`);
            }

            foundTsTranspilationInfo = foundTsTranspilationInfo as TsTranspiledInfo;

            // typings d.ts entry
            let typingsEntryFile = typingsAndMetaDataReExport.entry;
            if (typingsEntryFile) {
                mainFields.typings = path.relative(packageConfigOutDir,
                    path.join(foundTsTranspilationInfo.outDir, typingsEntryFile)).replace(/\\/g, '/');
            } else {
                typingsEntryFile = libConfig.entry ? libConfig.entry.replace(/\.(ts|js)$/, '.d.ts') : '';
            }

            if (!typingsEntryFile) {
                throw new Error(`The typings entry file is required for for 'typingsAndMetaDataReExport' options.`);
            }

            if (typingsAndMetaDataReExport.outFileName) {
                // add banner to index
                let bannerContent = '';
                if (libConfig.banner) {
                    bannerContent = prepareBannerSync(projectRoot, srcDir, libConfig.banner);
                    if (bannerContent) {
                        bannerContent += '\n';
                    } else {
                        bannerContent = '';
                    }
                }

                const relativeTypingsOutDir = path.relative(packageConfigOutDir, foundTsTranspilationInfo.outDir);
                const typingsOutFileName = typingsAndMetaDataReExport.outFileName
                    .replace(/\[package-name\]/g, packageNameWithoutScope)
                    .replace(/\[packagename\]/g, packageNameWithoutScope);

                // typings re-exports
                const typingsIndexContent =
                    `${bannerContent}export * from './${relativeTypingsOutDir}/${typingsEntryFile}';\n`;
                const typingOutFilePath = path.resolve(packageConfigOutDir, typingsOutFileName);
                await fs.writeFile(typingOutFilePath, typingsIndexContent);

                // metadata re-exports
                const metaDataOutFilePath = path.resolve(packageConfigOutDir,
                    typingsOutFileName.replace(/\.d\.ts$/i, '.metadata.json'));
                const metaDataIndexContent =
                    `{"__symbolic":"module","version":3,"metadata":{},"exports":[{"from":"./${relativeTypingsOutDir}/${
                    typingsEntryFile.replace(/\.d\.ts$/i, '')}"}]}`;
                await fs.writeFile(metaDataOutFilePath, metaDataIndexContent);

                mainFields.typings = typingsOutFileName;
            }
        }

        libPackageConfig = Object.assign(libPackageConfig, mainFields, libConfig.packageOptions.mainFields);

        logger.logLine(`Copying and updating package.json`);
        await fs.writeFile(path.resolve(packageConfigOutDir, 'package.json'), JSON.stringify(libPackageConfig, null, 2));
    }

    if (libConfig.cleanFiles && libConfig.cleanFiles.length && outDir) {
        logger.logLine(`Cleaning`);
        await Promise.all(libConfig.cleanFiles.map(async (fileToClean: string) => {
            await clean(path.join(outDir as string, fileToClean));
        }));
    }

    logger.logLine(`Build completed.\n`);
}
