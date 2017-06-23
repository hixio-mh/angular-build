import * as fs from 'fs-extra';
import * as path from 'path';

import { prepareBannerSync, TsTranspiledInfo } from '../../helpers';
import { TypingsAndMetaData } from '../../models';
import { globCopyFiles, isInFolder, normalizeRelativePath, isSamePaths, readJson } from '../../utils';
import {LibBuildPipeInfo} from './lib-build-pipe-info';

export async function packagingTask(libBuildPipeInfo: LibBuildPipeInfo): Promise<void> {
    const projectRoot = libBuildPipeInfo.projectRoot;
    const libConfig = libBuildPipeInfo.libConfig;
    const tsTranspiledInfoes = libBuildPipeInfo.tsTranspiledInfoes || [];
    const mainFields = libBuildPipeInfo.mainFields || {};
    const packageName = libBuildPipeInfo.packageName;
    const logger = libBuildPipeInfo.logger;

    if (!libConfig.packageOptions || !libConfig.packageOptions.packageConfigFile) {
        return;
    }

    if (!libConfig.outDir) {
        throw new Error(`The 'outDir' property is required by lib config's 'packageOptions'.`);
    }

    const srcDir = path.resolve(projectRoot, libConfig.srcDir || '');
    const outDir = path.resolve(projectRoot, libConfig.outDir);
    const packageConfigOutDir = path.resolve(outDir, libConfig.packageOptions.outDir || '');

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
    if (libConfig.packageOptions.typingsAndMetaData &&
    (libConfig.packageOptions.typingsAndMetaData.entry ||
        libConfig.packageOptions.typingsAndMetaData.outFileName)) {

        const typingsAndMetaData =
            libConfig.packageOptions.typingsAndMetaData as TypingsAndMetaData;
        if (!tsTranspiledInfoes.length) {
            throw new Error(
                `No proper typescript transpilation output found. The lib config's ` +
                `'packageOptions.typingsAndMetaData' requires typescript transpilation.`);
        }

        let foundTsTranspilationInfo: TsTranspiledInfo | undefined;
        if (typeof typingsAndMetaData.tsTranspilationIndex === 'number') {
            const index = typingsAndMetaData.tsTranspilationIndex as number;
            if (index < 0 || index >= tsTranspiledInfoes.length) {
                throw new Error(
                    `No proper typescript transpilation output found with tsTranspilationIndex: ${index}. ` +
                    `Please correct 'tsTranspilationIndex' in lib config -> ` +
                    `'packageOptions.typingsAndMetaData.tsTranspilationIndex'.`);
            }
            foundTsTranspilationInfo = tsTranspiledInfoes[index];
        } else if (typingsAndMetaData.tsTranspilationIndex &&
            typeof typingsAndMetaData.tsTranspilationIndex === 'string') {
            const tsTransName = typingsAndMetaData.tsTranspilationIndex as string;
            foundTsTranspilationInfo = tsTranspiledInfoes.find(t => t.name === tsTransName);
            if (!foundTsTranspilationInfo) {
                throw new Error(
                    `No proper typescript transpilation output found with tsTranspilationIndex: ${tsTransName}. ` +
                    `Please correct 'tsTranspilationIndex' in lib config -> ` +
                    `'packageOptions.typingsAndMetaData.tsTranspilationIndex'.`);
            }
        } else if (typeof typingsAndMetaData.tsTranspilationIndex === 'undefined') {
            foundTsTranspilationInfo = tsTranspiledInfoes[0];
        }
        if (!foundTsTranspilationInfo) {
            throw new Error(
                `No proper typescript transpilation output found. The lib config's ` +
                `'packageOptions.typingsAndMetaData' requires typescript transpilation.`);
        }

        foundTsTranspilationInfo = foundTsTranspilationInfo as TsTranspiledInfo;

        let typingsOutDirRelative = libConfig.packageOptions.typingsAndMetaData.outDir;
        if (!typingsOutDirRelative &&
            foundTsTranspilationInfo.tsTranspilation.outDir &&
            isInFolder(packageConfigOutDir, foundTsTranspilationInfo.outDir)) {
            typingsOutDirRelative = path.relative(packageConfigOutDir, foundTsTranspilationInfo.outDir);
        }
        if (!typingsOutDirRelative) {
            throw new Error(`The 'typingsAndMetaData.outDir' is required.`);
        }
        if (!isInFolder(packageConfigOutDir, path.resolve(packageConfigOutDir, typingsOutDirRelative))) {
            throw new Error(
                `The typings re-export 'outDir' must be inside the package folder: ${packageConfigOutDir}`);
        }
        typingsOutDirRelative = normalizeRelativePath(typingsOutDirRelative);
        if (!isSamePaths(path.resolve(packageConfigOutDir, typingsOutDirRelative),
            foundTsTranspilationInfo.outDir)) {
            // copy d.ts and metadta.json files
            await globCopyFiles(foundTsTranspilationInfo.outDir,
                '**/*.+(d.ts|metadata.json)',
                path.resolve(packageConfigOutDir, typingsOutDirRelative));
        }

        // typings d.ts entry
        let typingsEntryFile = typingsAndMetaData.entry;
        if (!typingsEntryFile && mainFields.typings) {
            typingsEntryFile = path.parse(mainFields.typings).base;
        } else if (!typingsEntryFile && libConfig.entry) {
            typingsEntryFile = path.parse(libConfig.entry.replace(/\.(ts|js)$/, '.d.ts')).base;
        }
        if (!typingsEntryFile) {
            throw new Error(`The typings entry file is required for for 'typingsAndMetaData' options.`);
        }
        if (!/\.d\.ts$/i.test(typingsEntryFile)) {
            typingsEntryFile = typingsEntryFile + '.d.ts';
        }
        mainFields.typings = normalizeRelativePath(path.join(typingsOutDirRelative, typingsEntryFile));

        if (typingsAndMetaData.outFileName) {
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

            let typingsOutFileName = typingsAndMetaData.outFileName
                .replace(/\[name\]/g, typingsEntryFile.replace(/\.d\.ts$/i, ''))
                .replace(/\[pkg-name\]/g, packageName)
                .replace(/\[package-name\]/g, packageName)
                .replace(/\[packagename\]/g, packageName);
            if (!/\.d\.ts$/i.test(typingsOutFileName)) {
                typingsOutFileName = typingsOutFileName + '.d.ts';
            }

            // typings re-exports
            const typingsIndexContent =
                `${bannerContent}export * from './${typingsOutDirRelative}/${typingsEntryFile.replace(/\.d\.ts$/i,
                    '')}';\n`;
            const typingOutFilePath = path.resolve(packageConfigOutDir, typingsOutFileName);
            await fs.writeFile(typingOutFilePath, typingsIndexContent);
            mainFields.typings = typingsOutFileName;

            // metadata re-exports
            const metaDataOutFilePath = path.resolve(packageConfigOutDir,
                typingsOutFileName.replace(/\.d\.ts$/i, '.metadata.json'));
            const metaDataIndexContent =
                `{"__symbolic":"module","version":3,"metadata":{},"exports":[{"from":"./${typingsOutDirRelative}/${
                    typingsEntryFile.replace(/\.d\.ts$/i, '')}"}]}`;
            await fs.writeFile(metaDataOutFilePath, metaDataIndexContent);
        }
    }

    libPackageConfig = Object.assign(libPackageConfig, mainFields, libConfig.packageOptions.mainFields);

    logger.logLine(`Copying and updating package.json`);
    await fs.writeFile(path.resolve(packageConfigOutDir, 'package.json'),
        JSON.stringify(libPackageConfig, null, 2));
}
