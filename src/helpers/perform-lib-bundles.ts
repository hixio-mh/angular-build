import * as path from 'path';

import { readFile, writeFile } from 'fs-extra';
import * as rollup from 'rollup';
import * as rimraf from 'rimraf';
import * as ts from 'typescript';

import {
    AngularBuildContext,
    BundleOptionsInternal,
    InternalError,
    InvalidConfigError,
    LibProjectConfigInternal,
    TsTranspilationOptionsInternal,
    TypescriptCompileError
} from '../models';

import { Logger } from '../utils/logger';
import { isSamePaths } from '../utils/path-helpers';

import { getRollupConfig } from './get-rollup-config';
import { getLibBundleTargetWebpackConfig } from '../webpack-configs/lib-configs/lib-bundle-target';

import { runWebpack } from './run-webpack';
import { minifyFile } from './minify-file';

const { exists } = require('fs-extra');
const sorcery = require('sorcery');

export async function performLibBundles(angularBuildContext: AngularBuildContext, customLogger?: Logger): Promise<void> {
    const libConfig = angularBuildContext.projectConfig as LibProjectConfigInternal;
    if (!libConfig.bundles || !libConfig.bundles.length) {
        return;
    }

    const projectRoot = AngularBuildContext.projectRoot;
    const logger = customLogger || AngularBuildContext.logger;
    const verbose = AngularBuildContext.angularBuildConfig.logLevel === 'debug';

    const packageName = angularBuildContext.packageNameWithoutScope;
    const isPackagePrivate = angularBuildContext.isPackagePrivate;
    const bundles = libConfig.bundles;

    const srcDir = path.resolve(projectRoot, libConfig.srcDir || '');
    const outDir = path.resolve(projectRoot, libConfig.outDir);

    for (let i = 0; i < bundles.length; i++) {
        const currentBundle = bundles[i] as BundleOptionsInternal;

        currentBundle._index = i;

        let expectedEntryScriptTarget: ts.ScriptTarget | undefined;
        let exactEntryScriptTarget: ts.ScriptTarget | undefined;

        // entry
        let entryFilePath = '';
        if (currentBundle.entryRoot && currentBundle.entryRoot === 'prevBundleOutDir') {
            let foundBundleTarget: BundleOptionsInternal | undefined;
            if (i > 0) {
                foundBundleTarget = bundles[i - 1];
            }
            if (!foundBundleTarget) {
                throw new InvalidConfigError(
                    `No previous bundle target found, please correct in 'libs[${libConfig._index}].bundles[${i
                    }].entryRoot' value.`);
            }

            if (!foundBundleTarget._outputFilePath) {
                throw new InternalError(
                    "The 'foundBundleTarget._outputFilePath' is not set.");
            }

            entryFilePath = foundBundleTarget._outputFilePath;

            expectedEntryScriptTarget = foundBundleTarget._expectedScriptTarget;
            exactEntryScriptTarget = foundBundleTarget._exactScriptTarget;
        } else if (currentBundle.entryRoot && currentBundle.entryRoot === 'tsOutDir') {
            if (!currentBundle.entry) {
                throw new InvalidConfigError(
                    `The 'libs[${libConfig._index}].bundles[${i}].entry' value is required.`);
            }

            if (!libConfig.tsTranspilation) {
                throw new InvalidConfigError(
                    `To use 'tsOutDir', the 'libs[${libConfig._index}].tsTranspilation' option is required.`);

            }

            if (!libConfig.tsTranspilation.tsconfig) {
                throw new InvalidConfigError(
                    `To use 'tsOutDir', the 'libs[${libConfig._index}].tsTranspilation.tsconfig' value is required.`);

            }

            const tsTranspilation = libConfig.tsTranspilation as TsTranspilationOptionsInternal;
            if (!tsTranspilation._tsOutDir) {
                throw new InternalError(
                    "The 'tsTranspilation._tsOutDir' is not set.");
            }

            if (!tsTranspilation._tsCompilerConfig) {
                throw new InternalError(
                    "The 'tsTranspilation._tsCompilerConfig' is not set.");
            }

            const entryRootDir = tsTranspilation._tsOutDir;
            entryFilePath = path.resolve(entryRootDir, currentBundle.entry);

            const compilerOptions = tsTranspilation._tsCompilerConfig.options;

            expectedEntryScriptTarget = compilerOptions.target;
            exactEntryScriptTarget = expectedEntryScriptTarget;
        } else if (currentBundle.entryRoot && currentBundle.entryRoot === 'outDir') {
            if (!currentBundle.entry) {
                throw new InvalidConfigError(
                    `The 'libs[${libConfig._index}].bundles[${i
                    }].entry' value is required.`);
            }

            entryFilePath = path.resolve(outDir, currentBundle.entry);

            if (/\.esm?2017\.js$/i.test(entryFilePath) || /esm?2017$/i.test(path.dirname(entryFilePath))) {
                expectedEntryScriptTarget = ts.ScriptTarget.ES2017;
            } else if (/\.esm?2016\.js$/i.test(entryFilePath) || /esm?2016$/i.test(path.dirname(entryFilePath))) {
                expectedEntryScriptTarget = ts.ScriptTarget.ES2016;
            } else if (/\.esm?2015\.js$/i.test(entryFilePath) || /esm?2015$/i.test(path.dirname(entryFilePath))) {
                expectedEntryScriptTarget = ts.ScriptTarget.ES2015;
            } else if (/\.esm?5\.js$/i.test(entryFilePath) || /esm?5$/i.test(path.dirname(entryFilePath))) {
                expectedEntryScriptTarget = ts.ScriptTarget.ES2015;
            }
        } else {
            if (!currentBundle.entry) {
                throw new InvalidConfigError(
                    `The 'libs[${libConfig._index}].bundles[${i
                    }].entry' value is required.`);
            }

            entryFilePath = path.resolve(srcDir, currentBundle.entry);
        }

        const entryFileExists = await exists(entryFilePath);
        if (!entryFileExists) {
            throw new InvalidConfigError(
                `The entry file path: ${entryFilePath} doesn't exist. Please correct in 'libs[${libConfig._index
                }].bundles[${i}].entry' value.`);
        }
        currentBundle._entryFilePath = entryFilePath;

        if (currentBundle.tsconfig) {
            currentBundle._tsConfigPath = path.resolve(srcDir, currentBundle.tsconfig);
        } else if (/\.ts$/i.test(currentBundle._entryFilePath)) {
            const tempTsConfigPath = path.resolve(path.dirname(currentBundle._entryFilePath), 'tsconfig.json');
            if (await exists(tempTsConfigPath)) {
                currentBundle._tsConfigPath = path.resolve(path.dirname(currentBundle._entryFilePath), 'tsconfig.json');
            }
        }
        if (currentBundle._tsConfigPath) {
            const jsonConfigFile = ts.readConfigFile(currentBundle._tsConfigPath, ts.sys.readFile);
            if (jsonConfigFile.error && jsonConfigFile.error.length) {
                const formattedMsg = formatDiagnostics(jsonConfigFile.error);
                if (formattedMsg) {
                    throw new InvalidConfigError(formattedMsg);
                }
            }

            // _tsConfigJson
            currentBundle._tsConfigJson = jsonConfigFile.config;

            // _tsCompilerConfig
            currentBundle._tsCompilerConfig = ts.parseJsonConfigFileContent(currentBundle._tsConfigJson,
                ts.sys,
                path.dirname(currentBundle._tsConfigPath),
                undefined,
                currentBundle._tsConfigPath);
            const compilerOptions = currentBundle._tsCompilerConfig.options;

            // _ecmaVersion
            if (compilerOptions.target === ts.ScriptTarget.ES2017) {
                currentBundle._ecmaVersion = 8;
            } else if (compilerOptions.target === ts.ScriptTarget.ES2016) {
                currentBundle._ecmaVersion = 7;
            } else if (compilerOptions.target !== ts.ScriptTarget.ES3 && compilerOptions.target !== ts.ScriptTarget.ES5) {
                currentBundle._ecmaVersion = 6;
            }

            // _nodeResolveFields
            const nodeResolveFields: string[] = [];
            if (compilerOptions.target === ts.ScriptTarget.ES2017) {
                nodeResolveFields.push('es2017');
                nodeResolveFields.push('es2016');
                nodeResolveFields.push('es2015');
            } else if (compilerOptions.target === ts.ScriptTarget.ES2016) {
                nodeResolveFields.push('es2016');
                nodeResolveFields.push('es2015');
            } else if (compilerOptions.target !== ts.ScriptTarget.ES3 &&
                compilerOptions.target !== ts.ScriptTarget.ES5) {
                nodeResolveFields.push('es2015');
            }

            const defaultMainFields = ['module', 'main'];
            nodeResolveFields.push(...defaultMainFields);

            currentBundle._nodeResolveFields = nodeResolveFields;

            exactEntryScriptTarget = compilerOptions.target;
        }

        // scriptTarget
        if (currentBundle.scriptTarget) {
            const scriptTarget = currentBundle.scriptTarget as string;
            const tsScriptTarget = toTsScriptTarget(scriptTarget);
            if (tsScriptTarget) {
                currentBundle._expectedScriptTarget = tsScriptTarget;
                currentBundle._exactScriptTarget = tsScriptTarget;
            }
        } else if (expectedEntryScriptTarget || exactEntryScriptTarget) {
            currentBundle._expectedScriptTarget = expectedEntryScriptTarget;
            currentBundle._exactScriptTarget = exactEntryScriptTarget;
        }

        // bundleOutDir
        let bundleOutDir = '';
        if (currentBundle.outDir) {
            bundleOutDir = path.resolve(outDir, currentBundle.outDir);
        } else {
            bundleOutDir = outDir;
        }
        bundleOutDir = replaceOutputTokens(bundleOutDir, angularBuildContext);

        // _outputFilePath
        let formatSuffix = '';
        if (i > 0 && !/\-?esm?(\d{1,4})$/i.test(bundleOutDir) && !/\-?umd$/i.test(bundleOutDir)) {
            if (currentBundle.libraryTarget === 'es') {
                formatSuffix = '.esm';
            } else {
                formatSuffix = `.${currentBundle.libraryTarget}`;
            }
        }
        if (currentBundle.scriptTarget &&
            currentBundle.libraryTarget !== 'umd' &&
            !/\-?esm?(\d{1,4})$/i.test(bundleOutDir)) {
            formatSuffix = `${formatSuffix}.${currentBundle.scriptTarget}`;
        }

        let outFileName = currentBundle.outFileName;
        if (!outFileName) {
            if (packageName && !isPackagePrivate) {
                if (currentBundle.libraryTarget === 'umd' && angularBuildContext.parentPackageName) {
                    outFileName =
                        `${angularBuildContext.parentPackageName}-${packageName}.${currentBundle.libraryTarget}.js`;
                } else {
                    outFileName = `${packageName}${formatSuffix}.js`;
                }
            } else {
                outFileName = path.basename(entryFilePath).replace(/\.ts$/i, '.js');
            }
        }
        outFileName = replaceOutputTokens(outFileName, angularBuildContext);
        outFileName = outFileName.replace(/\[name\]/g, path.basename(entryFilePath).replace(/\.(js|ts)$/i, ''));
        const outputFilePath = path.resolve(bundleOutDir, outFileName);
        currentBundle._outputFilePath = outputFilePath;

        // externals
        if (typeof currentBundle.externals === 'undefined' && libConfig.externals) {
            currentBundle.externals = JSON.parse(JSON.stringify(libConfig.externals));
        }

        // path.dirname(entryFilePath) !== srcDir
        const shouldReMapSourceMap = libConfig.sourceMap &&
            !/\.ts$/i.test(entryFilePath);

        if (currentBundle.transformScriptTargetOnly) {
            if (!currentBundle.scriptTarget) {
                throw new InvalidConfigError(
                    `The 'libs[${libConfig._index}].bundles[${i
                    }].scriptTarget' value is required.`);
            }

            await transformScriptTarget(
                entryFilePath,
                outputFilePath,
                toTsScriptTarget(currentBundle.scriptTarget) as ts.ScriptTarget,
                toTsModuleKind(currentBundle.libraryTarget) || ts.ModuleKind.ES2015,
                shouldReMapSourceMap as boolean,
                logger);
        } else {
            let reTransformScriptTarget = false;
            let tempOutputFilePath = outputFilePath;

            if (currentBundle.scriptTarget &&
                expectedEntryScriptTarget !== toTsScriptTarget(currentBundle.scriptTarget)) {
                reTransformScriptTarget = true;
                tempOutputFilePath = tempOutputFilePath.replace(/\.js$/i, '') + '.temp.js';
            }

            // main bundling
            if (currentBundle.bundleTool === 'webpack') {
                const wpOptions = getLibBundleTargetWebpackConfig(angularBuildContext, currentBundle, tempOutputFilePath);
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
                const rollupOptions = getRollupConfig(angularBuildContext, currentBundle, tempOutputFilePath);
                logger.info(
                    `Bundling ${currentBundle.libraryTarget} module with rollup`);

                const bundle = await rollup.rollup(rollupOptions.inputOptions);
                await bundle.write(rollupOptions.outputOptions);
            }


            // Remapping sourcemaps
            if (shouldReMapSourceMap && currentBundle.bundleTool !== 'webpack') {
                const chain: any = await sorcery.load(tempOutputFilePath);
                await chain.write();
            }

            // re transform script version
            if (reTransformScriptTarget) {
                if (!currentBundle.scriptTarget) {
                    throw new InvalidConfigError(
                        `The 'libs[${libConfig._index}].bundles[${i
                        }].scriptTarget' value is required.`);
                }

                await transformScriptTarget(
                    tempOutputFilePath,
                    outputFilePath,
                    toTsScriptTarget(currentBundle.scriptTarget) as ts.ScriptTarget,
                    toTsModuleKind(currentBundle.libraryTarget) || ts.ModuleKind.ES2015,
                    shouldReMapSourceMap as boolean,
                    logger);

                if (!isSamePaths(tempOutputFilePath, outputFilePath)) {
                    await new Promise((resolve: any, reject: any) => rimraf(
                        tempOutputFilePath.replace(/\.js/i, '') + '.*',
                        (delErr: Error) => delErr ? reject(delErr) : resolve())
                    );
                }
            }
        }

        // minify umd es5 files
        if (currentBundle.bundleTool !== 'webpack' &&
            (currentBundle.minify ||
                (currentBundle.minify !== false &&
                    currentBundle.libraryTarget === 'umd' &&
                    (exactEntryScriptTarget === ts.ScriptTarget.ES5 ||
                        currentBundle.scriptTarget === 'es5')))) {
            const minFilePath = outputFilePath.replace(/\.js$/i, '.min.js');
            logger.debug(`Minifying ${path.basename(outputFilePath)}`);

            await minifyFile(outputFilePath,
                minFilePath,
                libConfig.sourceMap as boolean,
                verbose,
                logger);

            // Remapping sourcemaps
            if (libConfig.sourceMap) {
                const chain: any = await sorcery.load(outputFilePath);
                await chain.write();
            }
        }
    }
}

function replaceOutputTokens(input: string, angularBuildContext: AngularBuildContext): string {
    input = input
        .replace(/\[package-?scope\]/g, angularBuildContext.packageScope || '')
        .replace(/\[parent-?package-?name\]/g, angularBuildContext.parentPackageName || '')
        .replace(/\[package-?name\]/g, angularBuildContext.packageNameWithoutScope || '');
    return input;
}

async function transformScriptTarget(bundleEntryFilePath: string,
    bundleDestFilePath: string,
    scriptTarget: ts.ScriptTarget,
    moduleKind: ts.ModuleKind,
    reMapSourceMap: boolean,
    logger: Logger): Promise<void> {
    logger.info(`Transforming script target to ${ts.ScriptTarget[scriptTarget]}`);
    await transpileModule(bundleEntryFilePath,
        bundleDestFilePath,
        {
            importHelpers: true,
            target: scriptTarget,
            module: moduleKind,
            allowJs: true
        });

    if (reMapSourceMap) {
        const chain: any = await sorcery.load(bundleDestFilePath);
        await chain.write();
    }
}

async function transpileModule(inputPath: string,
    outputPath: string,
    compilerOptions: ts.CompilerOptions):
    Promise<void> {
    const inputFile = await readFile(inputPath, 'utf-8');
    const transpiled = ts.transpileModule(inputFile, { compilerOptions: compilerOptions });

    if (transpiled.diagnostics && transpiled.diagnostics.length) {
        const formattedMsg = formatDiagnostics(transpiled.diagnostics);
        if (formattedMsg) {
            throw new TypescriptCompileError(formattedMsg);
        }
    }

    await writeFile(outputPath, transpiled.outputText);

    if (transpiled.sourceMapText) {
        await writeFile(`${outputPath}.map`, transpiled.sourceMapText);
    }
}

function formatDiagnostics(diagnostic: ts.Diagnostic | ts.Diagnostic[]): string {
    if (!diagnostic) {
        return '';
    }

    const diags = Array.isArray(diagnostic) ? diagnostic : [diagnostic];
    if (!diags || !diags.length || !diags[0].length) {
        return '';
    }

    return diags
        .map((d) => {
            let res = ts.DiagnosticCategory[d.category];
            if (d.file) {
                res += ` at ${d.file.fileName}:`;
                const { line, character } = d.file.getLineAndCharacterOfPosition(d.start as number);
                res += (line + 1) + ':' + (character + 1) + ':';
            }
            res += ` ${ts.flattenDiagnosticMessageText(d.messageText, '\n')}`;
            return res;
        })
        .join('\n');
}

// TODO: to update targets whenever ts api changes
export function toTsScriptTarget(target: string): ts.ScriptTarget | undefined {
    switch (target) {
        case 'ES3':
        case 'es3':
            return ts.ScriptTarget.ES3;
        case 'ES5':
        case 'es5':
            return ts.ScriptTarget.ES5;
        case 'ES2015':
        case 'es2015':
            return ts.ScriptTarget.ES2015;
        case 'ES2016':
        case 'es2016':
            return ts.ScriptTarget.ES2016;
        case 'ES2017':
        case 'es2017':
            return ts.ScriptTarget.ES2017;
        case 'ESNext':
        case 'esnext':
            return ts.ScriptTarget.ESNext;
        case 'Latest':
        case 'latest':
            return ts.ScriptTarget.Latest;
        default:
            return undefined;
    }
}

export function toTsModuleKind(module: string): ts.ModuleKind {
    switch (module) {
        case 'amd':
            return ts.ModuleKind.AMD;
        case 'commonjs':
        case 'commonjs2':
            return ts.ModuleKind.CommonJS;
        case 'es2015':
            return ts.ModuleKind.ES2015;
        case 'esnext':
            return ts.ModuleKind.ESNext;
        case 'system':
            return ts.ModuleKind.System;
        case 'umd':
            return ts.ModuleKind.UMD;
        case 'none':
            return ts.ModuleKind.None;
        default:
            return ts.ModuleKind.None;
    }
}
