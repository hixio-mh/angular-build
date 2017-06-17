import * as path from 'path';
import * as fs from 'fs-extra';

import { LibProjectConfig } from '../../models';
import { Logger, readJson } from '../../utils';

export async function copyPackageConfig(projectRoot: string,
    libConfig: LibProjectConfig,
    mainFields: { [key: string]: string },
    logger: Logger): Promise<any> {
    if (!libConfig.packageOptions || !libConfig.packageOptions.packageConfigFile) {
        return;
    }

    if (!libConfig.outDir) {
        throw new Error(`The 'outDir' property is required in lib config.`);
    }

    const outDir = path.resolve(projectRoot, libConfig.outDir, libConfig.packageOptions.outDir || '');
    const srcDir = path.resolve(projectRoot, libConfig.srcDir || '');

    // read package info
    let libPackageConfig = await readJson(path.resolve(srcDir, libConfig.packageOptions.packageConfigFile));
    let rootPackageConfig: any = null;
    if (await fs.exists(path.resolve(projectRoot, 'package.json'))) {
        rootPackageConfig = await readJson(path.resolve(projectRoot, 'package.json'));
    }

    logger.logLine(`Copying package.json`);

    if (libPackageConfig.devDependencies) {
        delete libPackageConfig.devDependencies;
    }
    if (libPackageConfig.srcipts) {
        delete libPackageConfig.srcipts;
    }

    if (libConfig.packageOptions.useRootPackageConfigVerion !== false && !!rootPackageConfig) {
        libPackageConfig.version = rootPackageConfig.version;
    }

    libPackageConfig = Object.assign(libPackageConfig, mainFields, libConfig.packageOptions.mainFields);
    await fs.writeFile(path.resolve(outDir, 'package.json'), JSON.stringify(libPackageConfig, null, 2));
}
