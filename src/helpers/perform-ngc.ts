import * as path from 'path';

import { ParsedCommandLine } from 'typescript';

import {
    InvalidConfigError,
    LibBuildContext,
    LibProjectConfigInternal,
    TsTranspilationOptionsInternal,
    TypescriptCompileError
} from '../models';

import { Logger } from '../utils/logger';

import { processNgResources } from './process-ng-resources';

const spawn = require('cross-spawn');
const { exists } = require('fs-extra');

export async function performNgc(angularBuildContext: LibBuildContext, customLogger?: Logger): Promise<void> {
    const libConfig = angularBuildContext.projectConfig as LibProjectConfigInternal;
    if (!libConfig.tsTranspilation) {
        return;
    }

    const logger = customLogger || angularBuildContext.logger;

    const projectRoot = angularBuildContext.projectRoot;
    const tsTranspilation = libConfig.tsTranspilation as TsTranspilationOptionsInternal;
    const tsConfigPath = tsTranspilation._tsConfigPath;

    if (!tsConfigPath) {
        throw new InvalidConfigError(`The 'libs[${libConfig._index
            }].tsTranspilation.tsconfig' value is required.`);
    }

    let ngcCommandPath = path.join(angularBuildContext.nodeModulesPath, '.bin/ngc');

    if (!await exists(ngcCommandPath)) {
        let internalNodeModulePath = path.dirname(require.resolve('@angular/compiler-cli'));
        while (internalNodeModulePath &&
            !/node_modules$/i.test(internalNodeModulePath) &&
            internalNodeModulePath !== path.dirname(internalNodeModulePath)) {
            internalNodeModulePath = path.dirname(internalNodeModulePath);
        }
        ngcCommandPath = path.join(internalNodeModulePath, '.bin/ngc');
    }

    const srcDir = path.resolve(projectRoot, libConfig.srcDir || '');
    const tsCompilerConfig = tsTranspilation._tsCompilerConfig as ParsedCommandLine;
    const compilerOptions = tsCompilerConfig.options;
    const tsOutDir = tsTranspilation._tsOutDir as string;
    const copyTemplateAndStyleUrls = tsTranspilation.copyTemplateAndStyleUrls;
    const inlineMetaDataResources = tsTranspilation.inlineMetaDataResources;
    const stylePreprocessorOptions = libConfig.stylePreprocessorOptions;
    const flatModuleOutFile =
        tsTranspilation._angularCompilerOptions && tsTranspilation._angularCompilerOptions.flatModuleOutFile
            ? tsTranspilation._angularCompilerOptions.flatModuleOutFile
            : '';

    const commandArgs: string[] = ['-p', tsConfigPath];

    if (!compilerOptions.outDir) {
        commandArgs.push('--outDir');
        commandArgs.push(tsOutDir);
    }

    if (libConfig.sourceMap && !compilerOptions.sourceMap) {
        commandArgs.push('--sourceMap');
    }
    if (tsTranspilation.i18nFile) {
        commandArgs.push('--i18nFile');
        commandArgs.push(tsTranspilation.i18nFile);
    }
    if (tsTranspilation.i18nFormat) {
        commandArgs.push('--i18nFormat');
        commandArgs.push(tsTranspilation.i18nFormat);
    }
    if (tsTranspilation.locale) {
        commandArgs.push('--locale');
        commandArgs.push(tsTranspilation.locale);
    }
    if (tsTranspilation.missingTranslation) {
        commandArgs.push('--missingTranslation');
        commandArgs.push(tsTranspilation.missingTranslation);
    }
    if (tsTranspilation.i18nOutFile) {
        commandArgs.push('--i18nOutFile');
        commandArgs.push(tsTranspilation.i18nOutFile);
    }
    if (tsTranspilation.i18nOutFormat) {
        commandArgs.push('--i18nOutFormat');
        commandArgs.push(tsTranspilation.i18nOutFormat);
    }

    logger.debug(`Compiling typescript with ${path.relative(projectRoot, tsConfigPath)}`);

    await new Promise((resolve, reject) => {
        const errors: string[] = [];
        const child = spawn(ngcCommandPath, commandArgs, {});
        child.stdout.on('data', (data: any) => console.log(`${data}`));
        child.stderr.on('data', (data: any) => errors.push(data.toString().trim()));
        child.on('error', (err: Error) => reject(err));
        child.on('exit', (exitCode: number) => {
            if (exitCode === 0) {
                if (copyTemplateAndStyleUrls || inlineMetaDataResources) {
                    logger.debug(`Processing template and style urls`);

                    let stylePreprocessorIncludePaths: string[] = [];
                    if (stylePreprocessorOptions &&
                        stylePreprocessorOptions.includePaths) {
                        stylePreprocessorIncludePaths =
                            stylePreprocessorOptions.includePaths
                                .map(p => path.resolve(srcDir, p));
                    }

                    processNgResources(
                            srcDir,
                            tsOutDir,
                            `${path.join(tsOutDir, '**/*.js')}`,
                            stylePreprocessorIncludePaths,
                            copyTemplateAndStyleUrls,
                            inlineMetaDataResources,
                            flatModuleOutFile
                            ? flatModuleOutFile.replace(/\.js$/i, '.metadata.json')
                            : '')
                        .then(() => {
                            resolve();
                        }).catch(err => reject(err));
                } else {
                    resolve();
                }

            } else {
                reject(new TypescriptCompileError(errors.join('\n')));
            }

        });
    });
}
