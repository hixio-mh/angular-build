const fs = require('fs-extra');
import * as glob from 'glob';
import * as inquirer from 'inquirer';
import * as denodeify from 'denodeify';
import * as path from 'path';

import { colorize, isInFolder, isSamePaths, normalizeRelativePath, readJson } from '../../utils';
import { AngularBuildConfig, BundleTarget, LibProjectConfig, TsTranspilation } from '../../models';

import { InitInfo } from './init-info';

const globPromise = denodeify(glob);

type LibCreateTrackInfo = {
    index: number;
    processedSrcDirs: string[];
    hasMultipleProjects?: boolean;
    projectsSrcRoot?: string;
};

export async function initLibProjects(cfg: InitInfo): Promise<void> {
    let hasNext = true;
    const trackInfo: LibCreateTrackInfo = {
        index: 0,
        processedSrcDirs: []
    };
    while (hasNext) {
        hasNext = await initLibProject(cfg, trackInfo);
        trackInfo.index++;
    }
}

async function initLibProject(cfg: InitInfo, trackInfo: LibCreateTrackInfo): Promise<boolean> {
    const projectRoot = cfg.cwd;
    const logger = cfg.logger;
    const libIndex = trackInfo.index;
    const processedSrcDirs = trackInfo.processedSrcDirs;

    cfg.angularBuildConfigToWrite = cfg.angularBuildConfigToWrite || {};
    cfg.angularBuildConfigToWrite.libs = cfg.angularBuildConfigToWrite.libs || [];
    let currentLibConfig: LibProjectConfig = {};
    if (cfg.angularBuildConfigToWrite.libs.length && libIndex < cfg.angularBuildConfigToWrite.libs.length) {
        currentLibConfig = cfg.angularBuildConfigToWrite.libs[libIndex];
    } else {
        cfg.angularBuildConfigToWrite.libs.push(currentLibConfig);
    }

    let hasOneMoreLibConfig = false;
    let nextSrcDir = '';

    // srcDir
    if (currentLibConfig.srcDir &&
        processedSrcDirs.indexOf(path.relative(projectRoot, normalizeRelativePath(currentLibConfig.srcDir))) === -1 &&
        await fs.exists(path.resolve(projectRoot, currentLibConfig.srcDir))) {
        const currentSrcDir = path.resolve(projectRoot, normalizeRelativePath(currentLibConfig.srcDir));
        processedSrcDirs.push(currentSrcDir);

        if (!trackInfo.projectsSrcRoot) {
            const parentSrcDir = path.dirname(currentSrcDir);
            if (isInFolder(projectRoot, parentSrcDir)) {
                trackInfo.projectsSrcRoot = parentSrcDir;
            } else if (isInFolder(projectRoot, currentSrcDir)) {
                trackInfo.projectsSrcRoot = currentSrcDir;
            } else {
                trackInfo.projectsSrcRoot = projectRoot;
            }
        }

        const packageJsonPaths = await globPromise(path.join(trackInfo.projectsSrcRoot, '*', 'package.json'));
        if (packageJsonPaths && (packageJsonPaths as string[]).length) {
            const foundSrcPaths =
                (packageJsonPaths as string[])
                    .filter((p: string) => !isSamePaths(path.dirname(path.resolve(p)), currentSrcDir) &&
                        processedSrcDirs.indexOf(path.dirname(path.resolve(p))) === -1)
                    .map((p: string) => path.dirname(path.resolve(p)));
            hasOneMoreLibConfig = foundSrcPaths.length > 0;
            if (hasOneMoreLibConfig) {
                nextSrcDir = normalizeRelativePath(path.relative(projectRoot, foundSrcPaths[0]));
            }
            if (typeof trackInfo.hasMultipleProjects === 'undefined') {
                trackInfo.hasMultipleProjects = (packageJsonPaths as string[]).length > 1;
            }
        }
    } else if (!currentLibConfig.srcDir ||
        processedSrcDirs.indexOf(path.relative(projectRoot, normalizeRelativePath(currentLibConfig.srcDir))) !== -1 ||
        !await fs.exists(path.resolve(projectRoot, currentLibConfig.srcDir))) {
        currentLibConfig.srcDir = '';

        let tempSrcRoot = trackInfo.projectsSrcRoot;
        if (!tempSrcRoot) {
            if (libIndex > 0 && cfg.angularBuildConfigToWrite.libs[libIndex - 1].srcDir) {
                const prevSrcDir = cfg.angularBuildConfigToWrite.libs[libIndex - 1].srcDir as string;
                const parentSrcDir = path.dirname(prevSrcDir);
                if (isInFolder(projectRoot, parentSrcDir)) {
                    tempSrcRoot = parentSrcDir;
                } else if (isInFolder(projectRoot, prevSrcDir)) {
                    tempSrcRoot = prevSrcDir;
                }
            }

            if (!tempSrcRoot && await fs.exists(path.resolve(projectRoot, 'src'))) {
                tempSrcRoot = 'src';
            }
            if (!tempSrcRoot && await fs.exists(path.resolve(projectRoot, 'libs'))) {
                tempSrcRoot = 'libs';
            }
            if (!tempSrcRoot && await fs.exists(path.resolve(projectRoot, 'lib'))) {
                tempSrcRoot = 'lib';
            }
            if (!tempSrcRoot && await fs.exists(path.resolve(projectRoot, 'packages'))) {
                tempSrcRoot = 'packages';
            }
        }

        const packageJsonPaths =
            await globPromise(path.join(tempSrcRoot || projectRoot, tempSrcRoot ? '*' : '**', 'package.json'));
        if (packageJsonPaths && (packageJsonPaths as string[]).length) {
            const foundSrcPaths =
                (packageJsonPaths as string[])
                    .filter((p: string) => processedSrcDirs.indexOf(path.dirname(path.resolve(p))) === -1)
                    .map((p: string) => path.dirname(path.resolve(p)));
            foundSrcPaths.sort();
            hasOneMoreLibConfig = foundSrcPaths.length > 1;

            if (hasOneMoreLibConfig) {
                nextSrcDir = normalizeRelativePath(path.relative(projectRoot, foundSrcPaths[1]));
            }
            if (typeof trackInfo.hasMultipleProjects === 'undefined') {
                trackInfo.hasMultipleProjects = (packageJsonPaths as string[]).length > 1;
            }

            const foundSrcPath = foundSrcPaths.length ? foundSrcPaths[0] : null;
            if (foundSrcPath) {
                processedSrcDirs.push(foundSrcPath);
                currentLibConfig.srcDir = normalizeRelativePath(path.relative(projectRoot, foundSrcPath));
                if (!trackInfo.projectsSrcRoot) {
                    const parentSrcDir = path.dirname(foundSrcPath);
                    if (isInFolder(projectRoot, parentSrcDir)) {
                        trackInfo.projectsSrcRoot = parentSrcDir;
                    } else if (isInFolder(projectRoot, foundSrcPath)) {
                        trackInfo.projectsSrcRoot = foundSrcPath;
                    } else {
                        trackInfo.projectsSrcRoot = projectRoot;
                    }
                }
            }
        }
    }
    const srcDirAnswer = await inquirer.prompt([
        {
            type: 'input',
            name: 'input',
            message: colorize(`Enter src folder of your lib project:`, 'white'),
            default: currentLibConfig.srcDir || undefined,
            validate(value: string): boolean | string {
                const valid = value &&
                    !path.isAbsolute(value) &&
                    fs.existsSync(path.resolve(projectRoot, value)) &&
                    fs.statSync(path.resolve(projectRoot, value)).isDirectory();
                if (valid) {
                    return true;
                }

                return colorize(
                    `Please enter valid src folder of your lib project. Example: 'src' or 'lib' or 'packages/core'.` +
                    ` Path must be relative path to current directory. Commonly it is refer to root folder ` +
                    `containing your typescript source files.`,
                    'yellow');
            }
        }
    ]);
    currentLibConfig.srcDir = normalizeRelativePath(srcDirAnswer.input);
    const srcDir = path.resolve(projectRoot, currentLibConfig.srcDir);

    // read package info
    let pkgConfig: any | undefined;
    if (currentLibConfig.packageOptions && currentLibConfig.packageOptions.packageConfigFile) {
        if (await fs.exists(path.resolve(srcDir, currentLibConfig.packageOptions.packageConfigFile))) {
            pkgConfig = await readJson(path.resolve(srcDir, currentLibConfig.packageOptions.packageConfigFile));
        }
    }
    if (!pkgConfig && await fs.exists(path.resolve(srcDir, 'package.json'))) {
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

    // outDir
    if (!currentLibConfig.outDir) {
        let distName = 'dist';
        if (libIndex > 0 && cfg.angularBuildConfigToWrite.libs[libIndex - 1].outDir) {
            const tempDistName = cfg.angularBuildConfigToWrite.libs[libIndex - 1].outDir as string;
            distName = tempDistName.split('/')[0];
        }

        if (trackInfo.hasMultipleProjects &&
            currentLibConfig.srcDir.lastIndexOf('/') > 0 &&
            currentLibConfig.srcDir.lastIndexOf('/') + 1 < currentLibConfig.srcDir.length) {
            const srcSubDir = currentLibConfig.srcDir.substr(currentLibConfig.srcDir.lastIndexOf('/') + 1);
            currentLibConfig.outDir = packageNameWithoutScope
                ? `${distName}/packages/${packageNameWithoutScope}`
                : `${distName}/packages/${srcSubDir}`;
        } else {
            currentLibConfig.outDir = packageNameWithoutScope ? `${distName}/${packageNameWithoutScope}` : 'dist';
        }
    }
    if (!currentLibConfig.outDir ||
        path.isAbsolute(currentLibConfig.outDir) ||
        isSamePaths(projectRoot, path.resolve(projectRoot, currentLibConfig.outDir)) ||
        isSamePaths(srcDir, path.resolve(projectRoot, currentLibConfig.outDir))) {
        currentLibConfig.outDir = '';
    }
    const outDirAnswer = await inquirer.prompt([
        {
            type: 'input',
            name: 'input',
            message: colorize(`Enter output folder for build results:`, 'white'),
            default: currentLibConfig.outDir || undefined,
            validate(value: string): boolean | string {
                if (value && isSamePaths(projectRoot, path.resolve(projectRoot, value))) {
                    return colorize('The output folder must NOT be the same as project root folder.', 'yellow');
                }
                if (value && isSamePaths(srcDir, path.resolve(projectRoot, value))) {
                    return colorize(`The output folder must NOT be the same as root src folder.`, 'yellow');
                }

                if (value &&
                    (path.isAbsolute(value) ||
                        isInFolder(path.resolve(projectRoot, value), projectRoot) ||
                        isInFolder(path.resolve(projectRoot, value), srcDir))) {
                    return colorize(
                        `The '${value}' path is not alowed. Please enter a valid relative path to current directory.` +
                        `Commonly output folder may be 'dist'.`,
                        'yellow');
                }
                return true;
            }
        }
    ]);
    currentLibConfig.outDir = normalizeRelativePath(outDirAnswer.input);
    const outDir = path.resolve(projectRoot, currentLibConfig.outDir);

    // assets
    if (!currentLibConfig.assets || !currentLibConfig.assets.length) {
        currentLibConfig.assets = [];

        if (await fs.exists(path.resolve(srcDir, 'LICENSE'))) {
            currentLibConfig.assets.push('LICENSE');
        } else if (await fs.exists(path.resolve(projectRoot, 'LICENSE'))) {
            currentLibConfig.assets.push(normalizeRelativePath(path.relative(srcDir, 'LICENSE')));
        }

        if (await fs.exists(path.resolve(srcDir, 'README.md'))) {
            currentLibConfig.assets.push('README.md');
        } else if (await fs.exists(path.resolve(projectRoot, 'README.md'))) {
            currentLibConfig.assets.push(normalizeRelativePath(path.relative(srcDir, 'README.md')));
        }
    }

    // tsTanspilations
    let firstTsTranspilation: TsTranspilation =
        currentLibConfig.tsTranspilations &&
            Array.isArray(currentLibConfig.tsTranspilations) &&
            currentLibConfig.tsTranspilations.length
            ? currentLibConfig.tsTranspilations[0]
            : (currentLibConfig.tsTranspilations as TsTranspilation) || { tsconfig: '' };

    if (!firstTsTranspilation.tsconfig &&
        currentLibConfig.tsconfig &&
        await fs.exists(path.resolve(srcDir, currentLibConfig.tsconfig))) {
        firstTsTranspilation.tsconfig = currentLibConfig.tsconfig;
    }
    if (!firstTsTranspilation.tsconfig || !await fs.exists(path.resolve(srcDir, firstTsTranspilation.tsconfig))) {
        firstTsTranspilation.tsconfig = '';
        if (await fs.exists(path.resolve(srcDir, 'tsconfig-build.json'))) {
            firstTsTranspilation.tsconfig = 'tsconfig-build.json';
        } else if (await fs.exists(path.resolve(srcDir, 'tsconfig.build.json'))) {
            firstTsTranspilation.tsconfig = 'tsconfig.build.json';
        } else if (await fs.exists(path.resolve(srcDir, 'tsconfig-lib.json'))) {
            firstTsTranspilation.tsconfig = 'tsconfig-lib.json';
        } else if (await fs.exists(path.resolve(srcDir, 'tsconfig.lib.json'))) {
            firstTsTranspilation.tsconfig = 'tsconfig.lib.json';
        } else if (await fs.exists(path.resolve(srcDir, 'tsconfig.json'))) {
            firstTsTranspilation.tsconfig = 'tsconfig.json';
        } else if (await fs.exists(path.resolve(projectRoot, 'tsconfig.json'))) {
            firstTsTranspilation.tsconfig =
                normalizeRelativePath(path.relative(currentLibConfig.srcDir, 'tsconfig.json'));
        }
    }
    const tsConfigAnswer = await inquirer.prompt([
        {
            type: 'input',
            name: 'input',
            message: colorize(`Enter tsconfig file:`, 'white'),
            default: firstTsTranspilation.tsconfig || undefined,
            validate(value: string): boolean | string {
                const valid = value &&
                    !path.isAbsolute(value) &&
                    fs.existsSync(path.resolve(srcDir, value)) &&
                    fs.statSync(path.resolve(srcDir, value)).isFile() &&
                    /\.json$/i.test(value);
                if (valid) {
                    return true;
                }
                return colorize('Please enter a valid typescript configuration file for your lib project.', 'yellow');
            }
        }
    ]);
    firstTsTranspilation.tsconfig = normalizeRelativePath(tsConfigAnswer.input);
    if (currentLibConfig.tsconfig) {
        currentLibConfig.tsconfig = firstTsTranspilation.tsconfig;
    }

    const tsConfigJson = await readJson(path.resolve(srcDir, firstTsTranspilation.tsconfig));
    let tsModule = tsConfigJson.compilerOptions && tsConfigJson.compilerOptions.module
        ? tsConfigJson.compilerOptions.module
        : '';
    if (!tsModule || tsModule !== 'es2015') {
        tsModule = 'es2015';
        firstTsTranspilation.module = tsModule;
    }

    let tsScriptTarget = tsConfigJson.compilerOptions && tsConfigJson.compilerOptions.target
        ? tsConfigJson.compilerOptions.target
        : '';
    if (!tsScriptTarget ||
        (tsScriptTarget !== 'es2015' &&
            tsScriptTarget !== 'esnext' &&
            !/es2\d+/.test(tsScriptTarget))) {
        tsScriptTarget = 'es2015';
        firstTsTranspilation.target = tsScriptTarget;
    }

    let declaration = !!tsConfigJson.compilerOptions && !!tsConfigJson.compilerOptions.declaration;
    if (!declaration) {
        firstTsTranspilation.declaration = true;
    }

    if (tsConfigJson.angularCompilerOptions && tsConfigJson.angularCompilerOptions.strictMetadataEmit) {
        firstTsTranspilation.copyTemplateAndStyleUrls = true;
        firstTsTranspilation.inlineMetaDataResources = true;
    }

    // ts outDir
    // const tsConfigDir = path.dirname(path.resolve(srcDir, firstTsTranspilation.tsconfig));
    // const tsConfigOutDirRelative = tsConfigJson.compilerOptions && tsConfigJson.compilerOptions.outDir
    //    ? tsConfigJson.compilerOptions.outDir
    //    : '';
    // const tsConfigOutDirAbsolute = tsConfigOutDirRelative ? path.resolve(tsConfigDir, tsConfigOutDirRelative) : '';
    // let isTypescriptOutputOutsideOutDir = !isSamePaths(tsConfigOutDirAbsolute, outDir) &&
    //    !isInFolder(outDir, tsConfigOutDirAbsolute);
    const tsDeployAnswer = await inquirer.prompt([
        {
            type: 'list',
            name: 'choice',
            message: colorize('Select typescript deploy type:', 'white'),
            choices: [
                'typings and meta-data only',
                'esm-es2015 and esm-es5'
            ]
        }
    ]);
    const deployTypingsAndMetaDataOnly = tsDeployAnswer.choice === 'typings and meta-data only';

    const tsConfigOutDirAnswer = await inquirer.prompt([
        {
            type: 'input',
            name: 'input',
            message: deployTypingsAndMetaDataOnly
                ? colorize(`Enter output folder for typings and meta-data:`, 'white')
                : colorize(`Enter output folder for typescript compiled files:`, 'white'),
            default: deployTypingsAndMetaDataOnly ? 'typings' : tsScriptTarget,
            validate(value: string): boolean | string {
                if (value && isSamePaths(projectRoot, path.resolve(outDir, value))) {
                    return colorize('The output folder must NOT be the same as project root folder.', 'yellow');
                }
                if (value && isSamePaths(srcDir, path.resolve(outDir, value))) {
                    return colorize(`The output folder must NOT be the same as root src folder.`, 'yellow');
                }

                if (value &&
                    (path.isAbsolute(value) ||
                        isInFolder(path.resolve(outDir, value), projectRoot) ||
                        isInFolder(path.resolve(outDir, value), srcDir))) {
                    return colorize(
                        `The '${value}' path is not alowed. Please enter a valid relative path to output directory.`,
                        'yellow');
                }
                return true;
            }
        }
    ]);
    firstTsTranspilation.outDir = normalizeRelativePath(tsConfigOutDirAnswer.input);
    currentLibConfig.tsTranspilations = [firstTsTranspilation];
    if (!deployTypingsAndMetaDataOnly) {
        (currentLibConfig.tsTranspilations as TsTranspilation[]).push(Object.assign({},
            firstTsTranspilation,
            {
                outDir: 'es5',
                target: 'es5'
            }));
    }

    // bundle target
    let firstBundleTarget: BundleTarget =
        currentLibConfig.bundleTargets &&
            Array.isArray(currentLibConfig.bundleTargets) &&
            currentLibConfig.bundleTargets.length
            ? currentLibConfig.bundleTargets[0]
            : (currentLibConfig.bundleTargets as BundleTarget) || {};

    let libraryTarget = firstBundleTarget.libraryTarget || currentLibConfig.libraryTarget;
    if (!libraryTarget) {
        if (tsModule === 'esnext' || tsModule === 'es2015' || /es2\d+$/.test(tsModule)) {
            libraryTarget = 'es';
        } else if (tsModule === 'commonjs') {
            libraryTarget = 'commonjs';
        } else {
            libraryTarget = 'umd';
        }
    }
    firstBundleTarget.name = `${libraryTarget === 'es' ? 'esm' : libraryTarget}-${tsScriptTarget}`;

    if (!firstBundleTarget.entry &&
        currentLibConfig.entry &&
        await fs.exists(path.resolve(srcDir, currentLibConfig.entry))) {
        firstBundleTarget.entry = currentLibConfig.entry;
    }
    if (!firstBundleTarget.entry || !await fs.exists(path.resolve(srcDir, firstBundleTarget.entry))) {
        firstBundleTarget.entry = '';
        if (tsConfigJson.angularCompilerOptions && tsConfigJson.angularCompilerOptions.flatModuleOutFile) {
            firstBundleTarget.entry = normalizeRelativePath(tsConfigJson.angularCompilerOptions.flatModuleOutFile);
        } else if (tsConfigJson.files &&
            tsConfigJson.files.length &&
            tsConfigJson.files.length <= 2 &&
            !/\.d\.ts$/i.test(tsConfigJson.files[0]) &&
            /\.ts$/i.test(tsConfigJson.files[0]) &&
            await fs.exists(path.resolve(srcDir, tsConfigJson.files[0]))) {
            firstBundleTarget.entry = normalizeRelativePath(tsConfigJson.files[0].replace(/\.ts$/i, '.js'));
        }
    }
    const bundleEntryAnswer = await inquirer.prompt([
        {
            type: 'input',
            name: 'input',
            message: colorize(`Enter entry file (from typescript outDir) for bundling:`, 'white'),
            default: firstBundleTarget.entry || undefined,
            validate(value: string): boolean | string {
                const valid = value &&
                    !path.isAbsolute(value) &&
                    /\.js$/i.test(value);
                if (valid) {
                    return true;
                }
                return colorize(`Please enter a valid entry file from typescript outDir for bundling. ` +
                    `Commonly the entry file may be 'index.js' or 'main.js'`,
                    'yellow');
            }
        }
    ]);
    firstBundleTarget.entry = normalizeRelativePath(bundleEntryAnswer.input);
    firstBundleTarget.entryResolution = { entryRoot: 'tsTranspilationOutDir' };
    if (currentLibConfig.entry) {
        currentLibConfig.entry = firstBundleTarget.entry;
    }
    firstBundleTarget.libraryTarget = libraryTarget;

    // bundle outDir
    firstBundleTarget.outDir = firstBundleTarget.outDir || 'bundles';
    if (!firstBundleTarget.outDir ||
        path.isAbsolute(firstBundleTarget.outDir) ||
        isSamePaths(projectRoot, path.resolve(projectRoot, firstBundleTarget.outDir)) ||
        isSamePaths(srcDir, path.resolve(projectRoot, firstBundleTarget.outDir))) {
        firstBundleTarget.outDir = '';
    }
    const bundleTargetOutDirAnswer = await inquirer.prompt([
        {
            type: 'input',
            name: 'input',
            message: colorize(`Enter output folder for bundle results:`, 'white'),
            default: firstBundleTarget.outDir || undefined,
            validate(value: string): boolean | string {
                if (value && isSamePaths(projectRoot, path.resolve(outDir, value))) {
                    return colorize('The output folder must NOT be the same as project root folder.', 'yellow');
                }
                if (value && isSamePaths(srcDir, path.resolve(outDir, value))) {
                    return colorize(`The output folder must NOT be the same as root src folder.`, 'yellow');
                }

                if (value &&
                    (path.isAbsolute(value) ||
                        isInFolder(path.resolve(outDir, value), projectRoot) ||
                        isInFolder(path.resolve(outDir, value), srcDir))) {
                    return colorize(
                        `The '${value}' path is not alowed. Please enter a valid relative path to output directory.`,
                        'yellow');
                }
                return true;
            }
        }
    ]);
    firstBundleTarget.outDir = normalizeRelativePath(bundleTargetOutDirAnswer.input);
    firstBundleTarget.inlineResources = true;
    currentLibConfig.bundleTargets = [firstBundleTarget];

    if (firstBundleTarget.libraryTarget === 'es') {
        (currentLibConfig.bundleTargets as BundleTarget[]).push({
            name: 'esm-es5',
            entryResolution: {
                entryRoot: 'bundleTargetOutDir'
            },
            libraryTarget: 'es',
            outDir: 'bundles',
            inlineResources: false,
            addPureAnnotations: true,
            transformScriptTargetOnly: true,
            scriptTarget: 'es5'
        });
        (currentLibConfig.bundleTargets as BundleTarget[]).push({
            name: 'umd-es5',
            entryResolution: {
                entryRoot: 'bundleTargetOutDir'
            },
            libraryTarget: 'umd',
            outDir: 'bundles',
            inlineResources: false
        });
    }

    // package options
    if (await fs.exists(path.resolve(srcDir, 'package.json'))) {
        currentLibConfig.packageOptions = {
            packageConfigFile: 'package.json'
        };
        if (firstBundleTarget.entry &&
            firstTsTranspilation.outDir &&
            deployTypingsAndMetaDataOnly) {
            currentLibConfig.packageOptions.typingsAndMetaData = {
                entry: firstBundleTarget.entry.replace(/\.(js|ts)$/i, '.d.ts'),
                outDir: firstTsTranspilation.outDir,
                outFileName: '[packagename].d.ts'
            };

            // clean tasks
            currentLibConfig.cleanFiles = [
                `${firstTsTranspilation.outDir}/**/*.js`,
                `${firstTsTranspilation.outDir}/**/*.map`,
                `${firstTsTranspilation.outDir}/**/*.html`,
                `${firstTsTranspilation.outDir}/**/*.css`
            ];
        }
    }

    // banner
    if (!currentLibConfig.banner && await fs.exists(path.resolve(projectRoot, 'banner.txt'))) {
        currentLibConfig.banner = 'banner.txt';
    }

    logger.log('\n');
    if (trackInfo.hasMultipleProjects && hasOneMoreLibConfig) {
        const answer = await inquirer.prompt([
            {
                type: 'confirm',
                name: 'confirm',
                message: colorize(`One more lib config for '${nextSrcDir}'?`, 'white'),
                default: true
            }
        ]);
        if (!!answer.confirm) {
            logger.log('\n');
            return true;
        }
    }

    return false;
}

export async function mergeLibWithUserConfig(cfg: InitInfo, userConfig: AngularBuildConfig): Promise<void> {
    if ((!userConfig.apps && !userConfig.libs) ||
        (userConfig.apps && !Array.isArray(userConfig.apps)) ||
        (userConfig.libs && !Array.isArray(userConfig.libs))) {
        return;
    }

    cfg.angularBuildConfigToWrite = cfg.angularBuildConfigToWrite || {};

    if (userConfig.libs) {
        const tempLibConfig: LibProjectConfig = {};
        const userFirstLibConfig: LibProjectConfig = userConfig.libs[0];

        if (userFirstLibConfig.srcDir &&
            typeof userFirstLibConfig.srcDir === 'string' &&
            !path.isAbsolute(userFirstLibConfig.srcDir)) {
            tempLibConfig.srcDir = userFirstLibConfig.srcDir;
        }
        if (userFirstLibConfig.outDir &&
            typeof userFirstLibConfig.outDir === 'string' &&
            !path.isAbsolute(userFirstLibConfig.outDir)) {
            tempLibConfig.outDir = userFirstLibConfig.outDir;
        }
        if ((userFirstLibConfig as any).main &&
            typeof (userFirstLibConfig as any) === 'string' &&
            !path.isAbsolute((userFirstLibConfig as any))) {
            tempLibConfig.entry = (userFirstLibConfig as any);
        }
        if (userFirstLibConfig.entry &&
            typeof userFirstLibConfig.entry === 'string' &&
            !path.isAbsolute(userFirstLibConfig.entry)) {
            tempLibConfig.entry = userFirstLibConfig.entry;
        }
        if (userFirstLibConfig.tsconfig &&
            typeof userFirstLibConfig.tsconfig === 'string' &&
            !path.isAbsolute(userFirstLibConfig.tsconfig)) {
            tempLibConfig.tsconfig = userFirstLibConfig.tsconfig;
        }
        if (userFirstLibConfig.assets &&
            Array.isArray(userFirstLibConfig.assets)) {
            tempLibConfig.assets = (userFirstLibConfig.assets as any[])
                .filter((p: any) => p && (typeof p === 'string' || (typeof p === 'object' && (p as any).from)))
                .map((p: any) => {
                    if (typeof p === 'string') {
                        return p;
                    } else {
                        return {
                            from: p.from,
                            to: p.to
                        };
                    }
                });
        }
        if (userFirstLibConfig.styles &&
            Array.isArray(userFirstLibConfig.styles)) {
            tempLibConfig.styles = (userFirstLibConfig.styles as any[])
                .filter((p: any) => p && (typeof p === 'string' || (typeof p === 'object' && (p as any).from)))
                .map((p: any) => {
                    if (typeof p === 'string') {
                        return p;
                    } else {
                        return {
                            from: p.from,
                            to: p.to
                        };
                    }
                });
        }
        if (userFirstLibConfig.libraryTarget &&
            (userFirstLibConfig.libraryTarget === 'amd' ||
                userFirstLibConfig.libraryTarget === 'commonjs' ||
                userFirstLibConfig.libraryTarget === 'commonjs2' ||
                userFirstLibConfig.libraryTarget === 'es' ||
                userFirstLibConfig.libraryTarget === 'iife')) {
            tempLibConfig.tsconfig = userFirstLibConfig.tsconfig;
        }
        const userTsTranspilations = userFirstLibConfig.tsTranspilations
            ? Array.isArray(userFirstLibConfig.tsTranspilations)
                ? userFirstLibConfig.tsTranspilations
                : [userFirstLibConfig.tsTranspilations]
            : [];
        tempLibConfig.tsTranspilations = [];
        userTsTranspilations.forEach((tsTranspilation: TsTranspilation) => {
            const tempTsTranspilation: TsTranspilation = {};
            if (tsTranspilation.tsconfig) {
                tempTsTranspilation.tsconfig = tsTranspilation.tsconfig;
            }
            if (tsTranspilation.target) {
                tempTsTranspilation.target = tsTranspilation.target;
            }
            if (tsTranspilation.module) {
                tempTsTranspilation.module = tsTranspilation.module;
            }
            if (tsTranspilation.declaration) {
                tempTsTranspilation.declaration = !!(tsTranspilation.declaration as any);
            }
            if (tsTranspilation.copyTemplateAndStyleUrls) {
                tempTsTranspilation.copyTemplateAndStyleUrls = !!(tsTranspilation.copyTemplateAndStyleUrls as any);
            }
            if (tsTranspilation.inlineMetaDataResources) {
                tempTsTranspilation.inlineMetaDataResources = !!(tsTranspilation.inlineMetaDataResources as any);
            }
            if (Object.keys(tempTsTranspilation).length) {
                (tempLibConfig.tsTranspilations as any[]).push(tempTsTranspilation);
            }
        });
        if (userFirstLibConfig.banner &&
            typeof userFirstLibConfig.banner === 'string' &&
            !path.isAbsolute(userFirstLibConfig.banner)) {
            tempLibConfig.banner = userFirstLibConfig.banner;
        }

        if (Object.keys(tempLibConfig).length) {
            cfg.angularBuildConfigToWrite.libs = cfg.angularBuildConfigToWrite.libs || [];
            if (cfg.angularBuildConfigToWrite.libs.length) {
                cfg.angularBuildConfigToWrite.libs[0] =
                    Object.assign(cfg.angularBuildConfigToWrite.libs[0], tempLibConfig);
            } else {
                cfg.angularBuildConfigToWrite.libs.push(tempLibConfig);
            }
        }
    }
}
