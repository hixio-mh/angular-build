import * as path from 'path';

import * as spawn from 'cross-spawn';
import { pathExists, writeFile } from 'fs-extra';
import { ScriptTarget } from 'typescript';

import { AngularBuildContext } from '../../../build-context';
import { InternalError, TypescriptCompileError } from '../../../models/errors';
import { LibProjectConfigInternal, TsTranspilationOptionsInternal } from '../../../models/internals';
import { globCopyFiles, normalizeRelativePath } from '../../../utils';

import { processNgResources } from './process-ng-resources';
import { replaceVersion } from './replace-version';

export async function performTsTranspile(angularBuildContext: AngularBuildContext<LibProjectConfigInternal>): Promise<void> {
    const libConfig = angularBuildContext.projectConfig;
    if (!libConfig._tsTranspilations || !libConfig._tsTranspilations.length) {
        return;
    }

    const logger = AngularBuildContext.logger;

    for (const tsTranspilation of libConfig._tsTranspilations) {
        const tsConfigPath = tsTranspilation._tsConfigPath;
        if (!tsTranspilation._tsCompilerConfig) {
            throw new InternalError("The 'tsTranspilation._tsCompilerConfig' is not set.");
        }
        const compilerOptions = tsTranspilation._tsCompilerConfig.options;

        const commandArgs: string[] = ['-p', tsConfigPath];

        if (tsTranspilation._customTsOutDir) {
            commandArgs.push('--outDir');
            commandArgs.push(tsTranspilation._customTsOutDir);
        }

        if (tsTranspilation.target) {
            commandArgs.push('--target');
            commandArgs.push(tsTranspilation.target);
        } else if (tsTranspilation._scriptTarget && !compilerOptions.target) {
            commandArgs.push('--target');
            commandArgs.push(ScriptTarget[tsTranspilation._scriptTarget]);
        }

        if (tsTranspilation._declaration !== compilerOptions.declaration) {
            commandArgs.push('--declaration');

            if (tsTranspilation._declaration === false) {
                commandArgs.push('false');
            }
        }

        let scriptTargetText: string;
        if (tsTranspilation.target) {
            scriptTargetText = tsTranspilation.target.toUpperCase();
        } else {
            scriptTargetText = ScriptTarget[tsTranspilation._scriptTarget];
        }

        logger.info(
            `Compiling typescript with ${tsTranspilation.useTsc ? 'tsc' : 'ngc'}, target: ${scriptTargetText}`);

        await new Promise((resolve, reject) => {
            const errors: string[] = [];
            const commandPath = tsTranspilation.useTsc ? AngularBuildContext.tscCliPath : AngularBuildContext.ngcCliPath;
            const child = spawn(commandPath, commandArgs, {});
            child.stdout.on('data', (data: string | Buffer) => {
                logger.debug(`${data}`);
            });
            child.stderr.on('data', (data: string | Buffer | {}) => errors.push(data.toString().trim()));
            child.on('error', reject);
            child.on('exit',
                (exitCode: number) => {
                    if (exitCode === 0) {
                        afterTsTranspileTask(angularBuildContext, tsTranspilation).then(() => {
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
}

// tslint:disable:max-func-body-length
async function afterTsTranspileTask(angularBuildContext: AngularBuildContext<LibProjectConfigInternal>,
    tsTranspilation: TsTranspilationOptionsInternal): Promise<void> {
    const logger = AngularBuildContext.logger;
    const libConfig = angularBuildContext.projectConfig;

    if (!libConfig._projectRoot) {
        throw new InternalError("The 'libConfig._projectRoot' is not set.");
    }

    const projectRoot = libConfig._projectRoot;
    const outputRootDir = libConfig._outputPath;

    const stylePreprocessorOptions = libConfig.stylePreprocessorOptions;
    const flatModuleOutFile =
        !tsTranspilation.useTsc &&
            tsTranspilation._angularCompilerOptions &&
            tsTranspilation._angularCompilerOptions.flatModuleOutFile
            ? tsTranspilation._angularCompilerOptions.flatModuleOutFile
            : '';
    const projectVersion = libConfig._projectVersion;

    // Replace version
    if (tsTranspilation.replaceVersionPlaceholder !== false && projectVersion
        && (tsTranspilation._index === 0 || (tsTranspilation._index > 0 && libConfig._prevTsTranspilationVersionReplaced))) {
        logger.debug('Checking version placeholder');

        const hasVersionReplaced = await replaceVersion(tsTranspilation._tsOutDirRootResolved,
            projectVersion,
            `${path.join(tsTranspilation._tsOutDirRootResolved, '**/version.js')}`,
            logger);
        if (tsTranspilation._index === 0) {
            libConfig._prevTsTranspilationVersionReplaced = hasVersionReplaced;
        }
    }

    // Inline assets
    // angularCompilerOptions -> enableResourceInlining ?
    if (tsTranspilation.inlineAssets &&
        (tsTranspilation._index === 0 || (tsTranspilation._index > 0 && libConfig._prevTsTranspilationResourcesInlined))) {
        logger.debug('Checking resources to be inlined');

        let stylePreprocessorIncludePaths: string[] = [];
        if (stylePreprocessorOptions &&
            stylePreprocessorOptions.includePaths) {
            stylePreprocessorIncludePaths =
                stylePreprocessorOptions.includePaths
                    .map(p => path.resolve(projectRoot, p));
        }

        const resourcesInlined = await processNgResources(
            projectRoot,
            tsTranspilation._tsOutDirRootResolved,
            `${path.join(tsTranspilation._tsOutDirRootResolved, '**/*.js')}`,
            stylePreprocessorIncludePaths,
            tsTranspilation._declaration,
            flatModuleOutFile
                ? flatModuleOutFile.replace(/\.js$/i, '.metadata.json')
                : null,
            logger);

        if (tsTranspilation._index === 0) {
            libConfig._prevTsTranspilationResourcesInlined = resourcesInlined;
        }
    }

    // Move typings and metadata files
    if (tsTranspilation.moveTypingFilesToPackageRoot &&
        tsTranspilation._declaration &&
        tsTranspilation._typingsOutDir &&
        tsTranspilation._typingsOutDir !== tsTranspilation._tsOutDirRootResolved) {
        if (tsTranspilation.useTsc) {
            logger.debug('Moving typing files to output root');

            await globCopyFiles(tsTranspilation._tsOutDirRootResolved,
                '**/*.+(d.ts)',
                tsTranspilation._typingsOutDir,
                true);
        } else {
            logger.debug('Moving typing and metadata files to output root');

            await globCopyFiles(tsTranspilation._tsOutDirRootResolved,
                '**/*.+(d.ts|metadata.json)',
                tsTranspilation._typingsOutDir,
                true);
        }
    }

    // Re-export
    if (tsTranspilation.reExportTypingEntryToOutputRoot !== false &&
        tsTranspilation._declaration &&
        tsTranspilation._detectedEntryName &&
        outputRootDir &&
        tsTranspilation._typingsOutDir &&
        outputRootDir !== tsTranspilation._typingsOutDir) {
        let reExportName = tsTranspilation._detectedEntryName;
        if (libConfig._isNestedPackage &&
            libConfig._packageNameWithoutScope &&
            await pathExists(path.resolve(outputRootDir, `${reExportName}.d.ts`))) {
            reExportName =
                libConfig._packageNameWithoutScope.substr(libConfig._packageNameWithoutScope.lastIndexOf('/') + 1);
        }

        const relPath = normalizeRelativePath(path.relative(outputRootDir, tsTranspilation._typingsOutDir));

        // add banner to index
        const bannerContent = libConfig._bannerText ? `${libConfig._bannerText}\n` : '';

        if (tsTranspilation.useTsc) {
            logger.debug('Re-exporting typing files to output root');
        } else {
            logger.debug('Re-exporting typing and metadata entry files to output root');
        }

        const reExportTypingsContent =
            `${bannerContent}export * from './${relPath}/${tsTranspilation._detectedEntryName}';\n`;
        const reEportTypingsFileAbs = path.resolve(outputRootDir, `${reExportName}.d.ts`);
        await writeFile(reEportTypingsFileAbs, reExportTypingsContent);

        if (!tsTranspilation.useTsc) {
            const flatModuleId =
                tsTranspilation._angularCompilerOptions &&
                    tsTranspilation._angularCompilerOptions.flatModuleId
                    ? tsTranspilation._angularCompilerOptions.flatModuleId
                    : libConfig._projectName;

            const metadataJson = {
                __symbolic: 'module',
                version: 3,
                metadata: {},
                exports: [{ from: `./${relPath}/${tsTranspilation._detectedEntryName}` }],
                flatModuleIndexRedirect: true,
                importAs: flatModuleId
            };

            const reEportMetaDataFileAbs = reEportTypingsFileAbs.replace(/\.d\.ts$/i, '.metadata.json');
            await writeFile(reEportMetaDataFileAbs, JSON.stringify(metadataJson, null, 2));
        }
    }
}
