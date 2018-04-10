import * as path from 'path';

import { ParsedCommandLine } from 'typescript';

import { AngularBuildContext, LibProjectConfigInternal, TsTranspilationOptionsInternal } from '../../../build-context';
import { InvalidConfigError, TypescriptCompileError } from '../../../error-models';
import { Logger } from '../../../utils';

import { processNgResources } from './process-ng-resources';
import { replaceVersion } from './replace-version';

const spawn = require('cross-spawn');
const { exists } = require('fs-extra');

export async function
    performNgc<TConfig extends LibProjectConfigInternal>(angularBuildContext: AngularBuildContext<TConfig>,
        customLogger?: Logger): Promise<void> {
    const libConfig = angularBuildContext.projectConfig as LibProjectConfigInternal;
    if (!libConfig.tsTranspilation) {
        return;
    }

    const logger = customLogger ? customLogger : AngularBuildContext.logger;

    const tsTranspilation = libConfig.tsTranspilation as TsTranspilationOptionsInternal;
    const tsConfigPath = tsTranspilation._tsConfigPath;

    if (!tsConfigPath) {
        throw new InvalidConfigError(`The 'projects[${libConfig.name || libConfig._index
            }].tsTranspilation.tsconfig' value is required.`);
    }

    let ngcCommandPath = 'ngc';
    if (AngularBuildContext.nodeModulesPath &&
        await exists(path.join(AngularBuildContext.nodeModulesPath, '.bin/ngc'))) {
        ngcCommandPath = path.join(AngularBuildContext.nodeModulesPath, '.bin/ngc');
    } else if (AngularBuildContext.cliRootPath &&
        await exists(path.join(AngularBuildContext.cliRootPath, 'node_modules/.bin/ngc'))) {
        ngcCommandPath = path.join(AngularBuildContext.cliRootPath, 'node_modules/.bin/ngc');
    } else if (AngularBuildContext.nodeModulesPath &&
        await exists(path.join(AngularBuildContext.nodeModulesPath,
            '@bizappframework/angular-build/node_modules/.bin/ngc'))) {
        ngcCommandPath = path.join(AngularBuildContext.nodeModulesPath,
            '@bizappframework/angular-build/node_modules/.bin/ngc');
    }

    if (!await exists(ngcCommandPath)) {
        let internalNodeModulePath = path.dirname(require.resolve('@angular/compiler-cli'));
        while (internalNodeModulePath &&
            !/node_modules$/i.test(internalNodeModulePath) &&
            internalNodeModulePath !== path.dirname(internalNodeModulePath)) {
            internalNodeModulePath = path.dirname(internalNodeModulePath);
        }
        ngcCommandPath = path.join(internalNodeModulePath, '.bin/ngc');
    }

    const tsCompilerConfig = tsTranspilation._tsCompilerConfig as ParsedCommandLine;
    const compilerOptions = tsCompilerConfig.options;
    const tsOutDir = tsTranspilation._tsOutDir as string;

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

        commandArgs.push('--i18nInFile');
        commandArgs.push(tsTranspilation.i18nFile);
    }
    if (tsTranspilation.i18nFormat) {
        commandArgs.push('--i18nFormat');
        commandArgs.push(tsTranspilation.i18nFormat);

        commandArgs.push('--i18nInFormat');
        commandArgs.push(tsTranspilation.i18nFormat);
    }
    if (tsTranspilation.i18nLocale) {
        commandArgs.push('--locale');
        commandArgs.push(tsTranspilation.i18nLocale);
    }
    if (tsTranspilation.i18nMissingTranslation) {
        commandArgs.push('--missingTranslation');
        commandArgs.push(tsTranspilation.i18nMissingTranslation);
    }
    if (tsTranspilation.i18nOutFile) {
        commandArgs.push('--i18nOutFile');
        commandArgs.push(tsTranspilation.i18nOutFile);
    }
    if (tsTranspilation.i18nOutFormat) {
        commandArgs.push('--i18nOutFormat');
        commandArgs.push(tsTranspilation.i18nOutFormat);
    }

    logger.info(`Compiling typescript with ${path.relative(AngularBuildContext.workspaceRoot, tsConfigPath)}`);

    await new Promise((resolve, reject) => {
        const errors: string[] = [];
        const child = spawn(ngcCommandPath, commandArgs, {});
        child.stdout.on('data',
            (data: any) => {
                logger.debug(`${data}`);
            });
        child.stderr.on('data', (data: any) => errors.push(data.toString().trim()));
        child.on('error', (err: Error) => reject(err));
        child.on('exit',
            (exitCode: number) => {
                if (exitCode === 0) {
                    afterNgcTask(angularBuildContext, customLogger).then(() => {
                        resolve();
                    }).catch(err => {
                        reject(err);
                    });
                } else {
                    reject(new TypescriptCompileError(errors.join('\n')));
                }
            });
    });
}

async function afterNgcTask<TConfig extends LibProjectConfigInternal>(angularBuildContext: AngularBuildContext<TConfig>,
    customLogger?: Logger): Promise<void> {
    const logger = customLogger ? customLogger : AngularBuildContext.logger;

    const libConfig = angularBuildContext.projectConfig as LibProjectConfigInternal;
    const tsTranspilation = libConfig.tsTranspilation as TsTranspilationOptionsInternal;

    const projectRoot = path.resolve(AngularBuildContext.workspaceRoot, libConfig.root || '');
    const tsOutDir = tsTranspilation._tsOutDir as string;

    const replaceVersionPlaceholder = tsTranspilation.replaceVersionPlaceholder;
    const copyTemplateAndStyleUrls = tsTranspilation.copyTemplateAndStyleUrls;
    const inlineMetaDataResources = tsTranspilation.inlineMetaDataResources;
    const stylePreprocessorOptions = libConfig.stylePreprocessorOptions;
    const flatModuleOutFile =
        tsTranspilation._angularCompilerOptions && tsTranspilation._angularCompilerOptions.flatModuleOutFile
            ? tsTranspilation._angularCompilerOptions.flatModuleOutFile
            : '';

    const projectVersion = libConfig._projectVersion;

    if (replaceVersionPlaceholder && projectVersion) {
        logger.debug('Updating version placeholder');

        await replaceVersion(tsOutDir, projectVersion, `${path.join(tsOutDir, '**/version.js')}`);
    }

    if (copyTemplateAndStyleUrls || inlineMetaDataResources) {
        logger.debug('Processing template and style urls');

        let stylePreprocessorIncludePaths: string[] = [];
        if (stylePreprocessorOptions &&
            stylePreprocessorOptions.includePaths) {
            stylePreprocessorIncludePaths =
                stylePreprocessorOptions.includePaths
                    .map(p => path.resolve(projectRoot, p));
        }

        await processNgResources(
            projectRoot,
            tsOutDir,
            `${path.join(tsOutDir, '**/*.js')}`,
            stylePreprocessorIncludePaths,
            copyTemplateAndStyleUrls,
            inlineMetaDataResources,
            flatModuleOutFile
                ? flatModuleOutFile.replace(/\.js$/i, '.metadata.json')
                : '');
    }
}
