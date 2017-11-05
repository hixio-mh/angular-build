import * as path from 'path';

import { readFile, writeFile } from 'fs-extra';
import * as rollup from 'rollup';
import * as rimraf from 'rimraf';
import * as ts from 'typescript';

import {
    BundleOptionsInternal,
    InternalError,
    InvalidConfigError,
    LibBuildContext,
    LibProjectConfigInternal,
    RollupError,
    SorceryError,
    TsTranspilationOptionsInternal,
    TypescriptCompileError } from '../models';
import { isSamePaths, Logger } from '../utils';

import { defaultAngularAndRxJsExternals } from './angular-rxjs-externals';
import { getRollupConfig } from './get-rollup-config';
import { minifyFile } from './minify-file';


const { exists } = require('fs-extra');
const sorcery = require('sorcery');

export async function performLibBundles(angularBuildContext: LibBuildContext, customLogger?: Logger): Promise<void> {
    const libConfig = angularBuildContext.projectConfig as LibProjectConfigInternal;
    if (!libConfig.bundles || !libConfig.bundles.length) {
        return;
    }

    const logger = customLogger || angularBuildContext.logger;

    const projectRoot = angularBuildContext.projectRoot;
    const packageName = angularBuildContext.packageNameWithoutScope;
    const bundles = libConfig.bundles;

    const srcDir = path.resolve(projectRoot, libConfig.srcDir || '');
    const outDir = path.resolve(projectRoot, libConfig.outDir);

    for (let i = 0; i < bundles.length; i++) {
        const currentBundle = bundles[i] as BundleOptionsInternal;

        currentBundle._index = i;

        let expectedEntryScriptTarget: ts.ScriptTarget | undefined = undefined;
        let exactEntryScriptTarget: ts.ScriptTarget | undefined = undefined;

        // entry
        let entryFilePath = '';
        if (currentBundle.entryRoot && currentBundle.entryRoot === 'prevBundleOutDir') {
            let foundBundleTarget: BundleOptionsInternal | undefined = undefined;
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
                    `The 'foundBundleTarget._outputFilePath' is not set.`);
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
                    `The 'tsTranspilation._tsOutDir' is not set.`);
            }

            if (!tsTranspilation._tsCompilerConfig) {
                throw new InternalError(
                    `The 'tsTranspilation._tsCompilerConfig' is not set.`);
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

        let entryFileExists = await exists(entryFilePath);
        if (!entryFileExists) {
            throw new InvalidConfigError(
                `The entry file path: ${entryFilePath} doesn't exist. Please correct in 'libs[${libConfig._index
                }].bundles[${i}].entry' value.`);
        }
        currentBundle._entryFilePath = entryFilePath;

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
                formatSuffix = `.esm`;
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
            if (packageName) {
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
        if (!currentBundle.externals && libConfig.externals) {
            currentBundle.externals = JSON.parse(JSON.stringify(libConfig.externals));
        }
        if (currentBundle.includeAngularAndRxJsExternals !== false) {
            if (currentBundle.externals && Array.isArray(currentBundle.externals)) {
                const externals = Object.assign({}, defaultAngularAndRxJsExternals);
                (currentBundle.externals as Array<any>).push(externals);
            } else {
                currentBundle.externals = Object.assign({}, defaultAngularAndRxJsExternals, currentBundle.externals || {});
            }
        }

        const shouldReMapSourceMap = libConfig.sourceMap &&
            path.dirname(entryFilePath) !== srcDir &&
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
            const rollupOptions = getRollupConfig(angularBuildContext, currentBundle, tempOutputFilePath);
            logger.debug(
                `Bundling ${currentBundle.libraryTarget} module with rollup`);

            try {
                const bundle = await rollup.rollup(rollupOptions.inputOptions as any);
                await bundle.write(rollupOptions.outputOptions as any);
            } catch (err) {
                // TODO: to reivew
                throw new RollupError(err);
            }

            // Remapping sourcemaps
            if (shouldReMapSourceMap) {
                // logger.debug(`Remapping sourcemaps - ${path.basename(tempOutputFilePath)}`);

                try {
                    const chain: any = await sorcery.load(tempOutputFilePath);
                    await chain.write();
                } catch (sorceryErr2) {
                    // TODO: to reivew
                    throw new SorceryError(sorceryErr2);
                }
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
        if (currentBundle.libraryTarget === 'umd' &&
            (exactEntryScriptTarget === ts.ScriptTarget.ES5 ||
                currentBundle.scriptTarget === 'es5')) {
            const minFilePath = outputFilePath.replace(/\.js$/i, '.min.js');
            logger.debug(`Minifying ${path.basename(outputFilePath)}`);

            await minifyFile(outputFilePath,
                minFilePath,
                libConfig.sourceMap as boolean,
                angularBuildContext.angularBuildConfig.logLevel === 'debug',
                logger);

            // Remapping sourcemaps
            if (libConfig.sourceMap) {
                // logger.debug(`Remapping sourcemaps - ${path.basename(outputFilePath)}`);
                try {
                    const chain: any = await sorcery.load(outputFilePath);
                    await chain.write();
                } catch (sorceryErr4) {
                    throw new SorceryError(sorceryErr4);
                }
            }
        }
    }
}

function replaceOutputTokens(input: string, angularBuildContext: LibBuildContext): string {
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
    logger.debug(`Transforming script target to ${ts.ScriptTarget[scriptTarget]}`);
    await transpileModule(bundleEntryFilePath,
        bundleDestFilePath,
        {
            importHelpers: true,
            target: scriptTarget,
            module: moduleKind,
            allowJs: true
        });

    if (reMapSourceMap) {
        // logger.debug(`Remapping sourcemaps - ${path.basename(bundleDestFilePath)}`);
        try {
            const chain: any = await sorcery.load(bundleDestFilePath);
            await chain.write();
        } catch (sorceryErr) {
            throw new SorceryError(sorceryErr);
        }
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
