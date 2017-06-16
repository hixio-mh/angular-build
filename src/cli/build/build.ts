import * as path from 'path';
import * as fs from 'fs-extra';
import * as rollup from 'rollup';
import * as ts from 'typescript';
import * as webpack from 'webpack';

import { CliOptions } from '../cli-options';

import {
    addPureAnnotationsToFile, copyAssets, copyStyles, copyTemplateAndStyleUrls, defaultAngularAndRxJsExternals,
    getAoTGenDir,
    getWebpackToStringStatsOptions,
    prepareBuildOptions,
    prepareAngularBuildConfig,
    readAngularBuildConfig, tsTranspile,
    getTsTranspileInfo, TsTranspiledInfo, transpileFile
} from '../../helpers';
import { AngularBuildConfig, BuildOptions, BundleTarget, LibProjectConfig, ProjectConfig, TsTranspilation } from
    '../../models';
import { clean, colorize, Logger, readJson, remapSourcemap } from '../../utils';
import { getWebpackConfig, WebpackConfigOptions } from '../../webpack-configs';
import { getRollupConfig, RollupConfigOptions } from '../../rollup-configs';

export async function build(cliOptions: CliOptions, logger: Logger = new Logger()): Promise<number> {
    try {
        await buildInternal(cliOptions, logger);
    } catch (err) {
        if (err) {
            logger.errorLine(`An error occured during the build:\n${(err.stack) || err}${err.details
                ? `\n\nError details:\n${err.details}`
                : ''}`);
        }
        return -1;
    }
    return 0;
}

async function buildInternal(cliOptions: CliOptions, logger: Logger = new Logger()): Promise<any> {
    logger.logLine(`\n${colorize(
        `angular-build ${cliOptions.cliVersion} [${cliOptions.cliIsLocal ? 'Local' : 'Global'}]`,
        'green')}`);

    cliOptions.cwd = cliOptions.cwd ? path.resolve(cliOptions.cwd) : process.cwd();
    let cleanOutDir = false;
    const projectRoot = cliOptions.cwd;
    let angularBuildConfigPath = path.resolve(projectRoot, 'angular-build.json');
    const cliBuildOptions: any = {};

    if (cliOptions.commandOptions && cliOptions.commandOptions.p) {
        angularBuildConfigPath = path.isAbsolute(cliOptions.commandOptions.p)
            ? path.resolve(cliOptions.commandOptions.p)
            : path.resolve(projectRoot, cliOptions.commandOptions.p);
    }

    const angularBuildConfig = await readAngularBuildConfig(angularBuildConfigPath);

    if (cliOptions.commandOptions && typeof cliOptions.commandOptions === 'object') {
        cleanOutDir = (cliOptions.commandOptions as any).clean;

        const buildOptionsSchema = (angularBuildConfig as any).schema.definitions.BuildOptions.properties;
        Object.keys(cliOptions.commandOptions)
            .filter((key: string) => buildOptionsSchema[key] &&
                typeof (cliOptions as any).commandOptions[key] !== 'undefined' &&
                (cliOptions as any).commandOptions[key] !== 'clean' &&
                (cliOptions as any).commandOptions[key] !== null &&
                (cliOptions as any).commandOptions[key] !== '')
            .forEach((key: string) => {
                cliBuildOptions[key] = (cliOptions as any).commandOptions[key];
            });
    }

    cliBuildOptions.cliIsLocal = cliOptions.cliIsLocal;


    const buildOptions: BuildOptions = Object.assign({}, cliBuildOptions);
    // merge buildOptions
    if (angularBuildConfig.buildOptions) {
        Object.keys(angularBuildConfig.buildOptions)
            .filter((key: string) => !(key in buildOptions) &&
                typeof (angularBuildConfig.buildOptions as any)[key] !== 'undefined')
            .forEach((key: string) => {
                (buildOptions as any)[key] = (angularBuildConfig.buildOptions as any)[key];
            });
    }
    prepareBuildOptions(buildOptions);
    prepareAngularBuildConfig(projectRoot, angularBuildConfig, buildOptions);

    const libConfigs = angularBuildConfig.libs || [];
    const appConfigs = angularBuildConfig.apps || [];

    // filter
    const filterProjects: string[] = [];
    if (buildOptions.filter) {
        filterProjects.push(...Array.isArray(buildOptions.filter) ? buildOptions.filter : [buildOptions.filter]);
    }

    if (appConfigs.length === 0 && libConfigs.length === 0) {
        throw new Error('No project config is available.');
    }

    // build libs
    if (libConfigs.length) {
        const filteredLibConfigs = libConfigs
            .filter((projectConfig: ProjectConfig) =>
                !projectConfig.skip &&
                (filterProjects.length === 0 ||
                    (filterProjects.length > 0 &&
                        projectConfig.name &&
                        filterProjects.indexOf(projectConfig.name) > -1)));

        for (let libConfig of filteredLibConfigs) {
            // clean outDir
            if (cleanOutDir) {
                await cleanOutDirs(projectRoot, libConfig, buildOptions, logger);
            }

            // bundle
            await buildLib(projectRoot, libConfig, buildOptions, angularBuildConfig, cliOptions.cliIsLocal, logger);
        }
    }

    // build apps
    if (appConfigs.length) {
        const webpackIsGlobal = !cliOptions.cliIsLocal;
        const webpackWatchOptions = angularBuildConfig && angularBuildConfig.webpackWatchOptions
            ? angularBuildConfig.webpackWatchOptions
            : {};

        const filteredAppConfigs = appConfigs
            .filter((projectConfig: ProjectConfig) =>
                !projectConfig.skip &&
                (filterProjects.length === 0 ||
                    (filterProjects.length > 0 &&
                        projectConfig.name &&
                        filterProjects.indexOf(projectConfig.name) > -1)));
        const webpackConfigs = filteredAppConfigs.map((projectConfig: ProjectConfig) => getWebpackConfig({
            projectRoot,
            projectConfig,
            buildOptions,
            angularBuildConfig,
            logger,
            webpackIsGlobal
        }));
        if (!webpackConfigs || webpackConfigs.length === 0) {
            throw new Error('No webpack config available.');
        }
        const firstConfig = Array.isArray(webpackConfigs) ? webpackConfigs[0] : webpackConfigs;
        const watch = cliOptions.commandOptions.watch || firstConfig.watch;
        if (watch || !Array.isArray(webpackConfigs)) {
            // clean outDir
            if (cleanOutDir) {
                await cleanOutDirs(projectRoot, filteredAppConfigs[0], buildOptions, logger);
            }

            await webpackBundle(webpackConfigs, buildOptions, watch, webpackWatchOptions, logger);
        } else {
            for (let i = 0; i < webpackConfigs.length; i++) {
                const mappedAppConfig = filteredAppConfigs[i];
                const webpackConfig = webpackConfigs[i];

                // clean outDir
                if (cleanOutDir) {
                    await cleanOutDirs(projectRoot, mappedAppConfig, buildOptions, logger);
                }

                await webpackBundle(webpackConfig, buildOptions, watch, webpackWatchOptions, logger);
            }
        }
    }
}

async function buildLib(projectRoot: string,
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
        if (outDir === projectRoot) {
            throw new Error(`The 'outDir' and 'projectRoot' must NOT be the same folder.`);
        }
        if (outDir === srcDir) {
            throw new Error(`The 'outDir' and 'srcDir' must NOT be the same folder.`);
        }
    }

    let stylePreprocessorIncludePaths: string[] = [];
    if (libConfig.stylePreprocessorOptions && libConfig.stylePreprocessorOptions.includePaths) {
        stylePreprocessorIncludePaths =
            libConfig.stylePreprocessorOptions.includePaths.map(p => path.resolve(srcDir, p));
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
                `Typescript compiling with ${tsTanspileInfo.name ? tsTanspileInfo.name + ' ' : ''}target: ${
                tsTanspileInfo.target}, module: ${tsTanspileInfo.module}`);

            await tsTranspile(pathToWriteFile || tsTanspileInfo.sourceTsConfigPath);
            processedTsTanspileInfoes.push(tsTanspileInfo);

            if (pathToWriteFile && pathToWriteFile !== tsTanspileInfo.sourceTsConfigPath) {
                await clean(pathToWriteFile);
            }

            if (tsTranspilation.copyTemplateAndStyleUrls !== false) {
                logger.logLine(`Copying template and styles`);
                await copyTemplateAndStyleUrls(
                    srcDir,
                    tsTanspileInfo.outDir,
                    `${path.join(tsTanspileInfo.outDir, '**/*.js')}`,
                    stylePreprocessorIncludePaths);
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

        logger.logLine(`Processing global styles to ${path.relative(projectRoot, outDir as string)}`);
        await copyStyles(srcDir,
            outDir as string,
            libConfig.styles,
            stylePreprocessorIncludePaths,
            packageNameWithoutScope,
            libConfig.sourceMap);
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

        for (let i = 0; i < bundleTargets.length; i++) {
            const target = bundleTargets[i];

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
                bundleDestFileName = packageNameWithoutScope
                    ? `${packageNameWithoutScope}${formatSuffix}.js`
                    : libConfig.outFileName
                        ? `${libConfig.outFileName}${formatSuffix}.js`
                        : `main${formatSuffix}.js`;
            }

            bundleDestFileName = bundleDestFileName.replace(/\[name\]/g,
                packageNameWithoutScope || libConfig.outFileName || 'main');
            target.outFileName = bundleDestFileName;

            let shouldSkipThisTarget = false;
            for (let j = 0; j < i; j++) {
                if ((bundleTargets[j].outFileName as string).toLowerCase() === bundleDestFileName.toLowerCase()) {
                    logger.warnLine(
                        `The same 'bundleOutFileName': ${bundleDestFileName} found and skipping this target.`);
                    shouldSkipThisTarget = true;
                }
            }
            if (shouldSkipThisTarget) {
                continue;
            }

            let shouldInlineResources = target.inlineResources !== false;
            let useNodeResolve: boolean | undefined = undefined;

            // entry resolution
            if (target.entryResolution) {
                if (!target.entryResolution.entryRoot) {
                    throw new Error(
                        `Please specify 'entryResolution.entryRoot' or remove 'entryResolution' property from bundleTargets[${i
                        }].`);
                }

                if (target.entryResolution.entryRoot === 'bundleTargetOutDir') {
                    let foundBundleTarget: BundleTarget | undefined = undefined;
                    if (target.entryResolution.bundleTargetIndex && typeof target.entryResolution.bundleTargetIndex === 'number') {
                        const index = target.entryResolution.bundleTargetIndex as number;
                        if (index === i) {
                            throw new Error(`The 'bundleTargetIndex' must not be current item index at bundleTargets[${i}].`);
                        }
                        if (index < 0 || index >= bundleTargets.length) {
                            throw new Error(`No bundleTarget found with bundleTargetIndex: ${index} at bundleTargets[${i}].`);
                        }
                        foundBundleTarget = bundleTargets[index];
                    } else if (target.entryResolution.bundleTargetIndex &&
                        typeof target.entryResolution.bundleTargetIndex === 'string') {
                        const bundleTargetName = target.entryResolution.bundleTargetIndex as string;
                        if (bundleTargetName === target.name) {
                            throw new Error(`The 'bundleTargetIndex' must not be current item name at bundleTargets[${i}].`);
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

                    if (foundBundleTarget.libraryTarget !== 'es') {
                        throw new Error(
                            `The reference library target must be 'es' at bundleTargets[${i}].`);
                    }

                    bundleRootDir = foundBundleTarget.outDir
                        ? path.resolve(outDir as string, foundBundleTarget.outDir as string)
                        : outDir as string;
                    bundleEntryFile = target.entry || foundBundleTarget.outFileName;
                } else if (target.entryResolution.entryRoot === 'tsTranspilationOutDir') {
                    if (!target.entry && !libConfig.entry) {
                        throw new Error(`The main entry is required for bundling.`);
                    }
                    if (!processedTsTanspileInfoes.length) {
                        throw new Error(`No tsTranspilation is configured at lib config.`);
                    }

                    let foundTsTranspilationInfo: TsTranspiledInfo | undefined;
                    if (target.entryResolution.tsTranspilationIndex &&
                        typeof target.entryResolution.tsTranspilationIndex === 'number') {
                        const index = target.entryResolution.tsTranspilationIndex as number;
                        if (index < 0 || index >= processedTsTanspileInfoes.length) {
                            throw new Error(
                                `No tsTranspilation found with tsTranspilationIndex: ${index} at bundleTargets[${index
                                }].`);
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
                } else if (target.entryResolution.entryRoot === 'outDir') {
                    if (!target.entry && !libConfig.entry) {
                        throw new Error(`The main entry is required for bundling.`);
                    }
                    bundleEntryFile = target.entry || libConfig.entry;
                    bundleRootDir = outDir as string;
                    useNodeResolve = true;
                }
            } else if (!!(target.entry || libConfig.entry) && /\.ts$/i.test((target.entry || libConfig.entry) as string)) {
                if (processedTsTanspileInfoes.length > 0) {
                    bundleRootDir = processedTsTanspileInfoes[0].outDir;
                    bundleEntryFile = target.entry || libConfig.entry;
                    bundleEntryFile = (bundleEntryFile as string).replace(/\.ts$/i, '.js');
                } else {
                    bundleEntryFile = target.entry || libConfig.entry;
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
                let scriptTarget = ts.ScriptTarget.ES5;
                let moduleKind = ts.ModuleKind.ES2015;
                if (target.scriptTarget === 'es5') {
                    scriptTarget = ts.ScriptTarget.ES5;
                }
                if (target.libraryTarget === 'amd') {
                    moduleKind = ts.ModuleKind.UMD;
                } else if (target.libraryTarget === 'commonjs' || target.libraryTarget === 'commonjs2') {
                    moduleKind = ts.ModuleKind.CommonJS;
                } else if (target.libraryTarget === 'umd') {
                    moduleKind = ts.ModuleKind.UMD;
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
            } else {
                target.libraryTarget = target.libraryTarget || libConfig.libraryTarget;

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

                        logger: logger,
                        webpackIsGlobal: !cliIsLocal
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
            }

            if (libConfig.sourceMap && bundleRootDir !== srcDir) {
                logger.logLine(`Remapping sourcemaps`);
                await remapSourcemap(bundleDestFilePath);
            }

            if (target.addPureAnnotations) {
                logger.logLine(`Inserting pure annotations`);
                await addPureAnnotationsToFile(bundleDestFilePath);
            }
        }
    }

    // packaging
    if (libConfig.packageOptions && libConfig.packageOptions.packageConfigFile) {
        await libPackageCopy(projectRoot, libConfig, logger);
    }

    logger.logLine(`Build completed.`);
}


async function cleanOutDirs(projectRoot: string,
    projectConfig: ProjectConfig,
    buildOptions: BuildOptions,
    logger: Logger): Promise<any> {
    const srcDir = path.resolve(projectRoot, projectConfig.srcDir);
    const outDir = path.resolve(projectRoot, projectConfig.outDir);

    if (outDir !== srcDir && outDir !== projectRoot) {
        logger.logLine(`\nCleaning ${outDir}`);
        if (/wwwroot$/g.test(outDir)) {
            await clean(outDir + '/**/*');
        } else {
            await clean(outDir);
        }
    }

    if (projectConfig.tsconfig) {
        const tsConfigPath = path.resolve(projectRoot, projectConfig.srcDir || '', projectConfig.tsconfig);
        const aotGenDir = await getAoTGenDir(tsConfigPath);
        if (buildOptions.environment &&
            buildOptions.environment.aot &&
            aotGenDir &&
            aotGenDir !== srcDir &&
            aotGenDir !== projectRoot) {
            await clean(aotGenDir);
        }
    }
}

async function libPackageCopy(projectRoot: string, libConfig: LibProjectConfig, logger: Logger): Promise<any> {
    if (!libConfig.packageOptions || !libConfig.packageOptions.packageConfigFile) {
        return;
    }

    if (!libConfig.outDir) {
        throw new Error(`The 'outDir' property is required in lib config.`);
    }

    const outDir = path.resolve(projectRoot, libConfig.outDir);
    const srcDir = path.resolve(projectRoot, libConfig.srcDir || '');


    // read package info
    let libPackageConfig: any;
    let rootPackageConfig: any;
    let libPackageNameWithoutScope: string;
    if (libConfig.packageOptions && libConfig.packageOptions.packageConfigFile) {
        libPackageConfig = await readJson(path.resolve(srcDir, libConfig.packageOptions.packageConfigFile));
    }

    if (await fs.exists(path.resolve(projectRoot, 'package.json'))) {
        rootPackageConfig = await readJson(path.resolve(projectRoot, 'package.json'));
    }

    const libPackageName = libPackageConfig ? libPackageConfig.name : rootPackageConfig ? rootPackageConfig.name : '';
    libPackageNameWithoutScope = libPackageName;
    if (libPackageNameWithoutScope && libPackageNameWithoutScope.indexOf('/') > -1) {
        libPackageNameWithoutScope = libPackageNameWithoutScope.split('/')[1];
    }

    logger.logLine(`Copying package.json`);

    if (libPackageConfig.devDependencies) {
        delete libPackageConfig.devDependencies;
    }
    if (libPackageConfig.srcipts) {
        delete libPackageConfig.srcipts;
    }

    if (libConfig.packageOptions.useRootPackageConfigVerion && rootPackageConfig) {
        libPackageConfig.version = rootPackageConfig.version;
    }

    if (libConfig.packageOptions.main) {
        libPackageConfig.main = libConfig.packageOptions.main.replace(/\[name\]/g, libPackageNameWithoutScope || 'main');
    }
    if (libConfig.packageOptions.module) {
        libPackageConfig.module =
            libConfig.packageOptions.module.replace(/\[name\]/g, libPackageNameWithoutScope || 'main');
    }
    if (libConfig.packageOptions.es2015) {
        libPackageConfig.es2015 =
            libConfig.packageOptions.es2015.replace(/\[name\]/g, libPackageNameWithoutScope || 'main');
    }
    if (libConfig.packageOptions.typings) {
        libPackageConfig.typings =
            libConfig.packageOptions.typings.replace(/\[name\]/g, libPackageNameWithoutScope || 'main');
    }
    if (libConfig.packageOptions.readMeFile) {
        logger.logLine(`Copying README file`);
        let readMeSourcePath = path.resolve(srcDir, libConfig.packageOptions.readMeFile);
        if (!await fs.exists(readMeSourcePath)) {
            const tempPath = path.resolve(projectRoot, libConfig.packageOptions.readMeFile);
            if (await fs.exists(tempPath)) {
                readMeSourcePath = tempPath;
            }
        }

        const extName = path.extname(readMeSourcePath);
        await fs.copy(readMeSourcePath, path.join(outDir, `README${extName}`));
    }

    await fs.writeFile(path.resolve(outDir, 'package.json'), JSON.stringify(libPackageConfig, null, 2));
}

function webpackBundle(wpConfig: webpack.Configuration | webpack.Configuration[],
    buildOptions: BuildOptions,
    watch?: boolean,
    watchOptions?: webpack.WatchOptions,
    logger: Logger = new Logger()): Promise<any> {
    const firstConfig = Array.isArray(wpConfig) ? wpConfig[0] : wpConfig;
    const webpackCompiler = webpack(wpConfig);
    const statsOptions = getWebpackToStringStatsOptions(firstConfig.stats, buildOptions.verbose);

    if (Array.isArray(wpConfig) && !statsOptions.children) {
        statsOptions.children = wpConfig.map((o: webpack.Configuration) => o.stats) as any;
    }
    if (typeof statsOptions.context === 'undefined') {
        statsOptions.context = firstConfig.context;
    }
    if (typeof statsOptions.colors === 'undefined') {
        // ReSharper disable once CommonJsExternalModule
        statsOptions.colors = require('supports-color');
    }

    watchOptions = watchOptions || firstConfig.watchOptions || {};

    return new Promise((resolve, reject) => {
        const callback: webpack.compiler.CompilerCallback = (err: any, stats: webpack.compiler.Stats) => {
            if (!watch || err) {
                // Do not keep cache anymore
                (webpackCompiler as any).purgeInputFileSystem();
            }

            if (err) {
                return reject(err);
            }

            if (watch) {
                return;
            }

            if (stats.hasErrors()) {
                // logger.errorLine(stats.toJson().errors);
                logger.errorLine(stats.toString('errors-only'));
                return reject();
            } else {
                logger.logLine(stats.toString(statsOptions));
                resolve();
            }
        };

        if (watch) {
            webpackCompiler.watch(watchOptions as webpack.WatchOptions, callback);
            logger.logLine('\nWebpack is watching the files…\n');
        } else {
            webpackCompiler.run(callback);
        }
    });
}
