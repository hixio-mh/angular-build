// tslint:disable:no-any
// tslint:disable:no-unsafe-any

import * as path from 'path';

import { writeFile } from 'fs-extra';

import { AngularBuildContext } from '../../../build-context';
import { InvalidConfigError } from '../../../error-models';
import { LibProjectConfigInternal } from '../../../interfaces/internals';

export async function performPackageJsonCopy(angularBuildContext: AngularBuildContext<LibProjectConfigInternal>): Promise<void> {
    const libConfig = angularBuildContext.projectConfig;
    if (!libConfig.packageJsonCopy) {
        return;
    }

    // validation
    if (!libConfig._packageJsonOutDir || !libConfig.outputPath) {
        throw new InvalidConfigError(`The 'projects[${libConfig.name || libConfig._index
            }].outputPath' value is required.`);
    }

    if (!libConfig._packageJson) {
        throw new InvalidConfigError('Could not detect package.json file.');
    }

    const logger = AngularBuildContext.logger;

    logger.info('Copying and updating package.json');

    // merge config
    const rootPackageJson = libConfig._rootPackageJson || {};
    const packageJson: any = {
        ...JSON.parse(JSON.stringify(libConfig._packageJson)),
        ...(libConfig._packageEntryPoints || {})
    };

    if (packageJson.devDependencies) {
        delete packageJson.devDependencies;
    }
    if (libConfig._projectVersion) {
        packageJson.version = libConfig._projectVersion;
    }

    if (rootPackageJson.description &&
        (packageJson.description === '' ||
            packageJson.description === '[PLACEHOLDER]')) {
        packageJson.description = rootPackageJson.description;
    }
    if (rootPackageJson.keywords &&
        (packageJson.keywords === '' ||
            packageJson.keywords === '[PLACEHOLDER]' ||
            (packageJson.keywords && !packageJson.keywords.length))) {
        packageJson.keywords = rootPackageJson.keywords;
    }
    if (rootPackageJson.author &&
        (packageJson.author === '' ||
            packageJson.author === '[PLACEHOLDER]')) {
        packageJson.author = rootPackageJson.author;
    }
    if (rootPackageJson.license &&
        (packageJson.license === '' ||
            packageJson.license === '[PLACEHOLDER]')) {
        packageJson.license = rootPackageJson.license;
    }
    if (rootPackageJson.repository &&
        (packageJson.repository === '' ||
            packageJson.repository === '[PLACEHOLDER]')) {
        packageJson.repository = rootPackageJson.repository;
    }
    if (rootPackageJson.homepage &&
        (packageJson.homepage === '' ||
            packageJson.homepage === '[PLACEHOLDER]')) {
        packageJson.homepage = rootPackageJson.homepage;
    }
    if (packageJson.sideEffects == null) {
        packageJson.sideEffects = false;
    }

    // write package config
    await writeFile(path.resolve(libConfig._packageJsonOutDir, 'package.json'),
        JSON.stringify(packageJson, null, 2));
}
