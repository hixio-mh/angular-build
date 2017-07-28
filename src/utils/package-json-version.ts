import * as path from 'path';
const fs = require('fs-extra');
import * as semver from 'semver';

import { readJson } from './read-json';

export async function getVersionfromPackageJson(baseDir: string): Promise<string> {
    const packageJsonPath = path.resolve(baseDir, 'package.json');
    if (!await fs.exists(packageJsonPath)) {
        return '';
    }
    const pkgConfig = await readJson(packageJsonPath);
    if (pkgConfig.version) {
        try {
            return new semver.SemVer(pkgConfig.version).toString();
        } catch (err) {
            return '';
        }
    } else {
        return '';
    }
}
