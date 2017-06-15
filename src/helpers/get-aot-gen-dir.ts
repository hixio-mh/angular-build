import * as path from 'path';

import { readJson, readJsonSync } from '../utils';

export function getAoTGenDirSync(tsConfigPath: string): string|undefined {
    let aotGenDir: string | undefined = undefined;

    if (tsConfigPath) {
        const tsConfig = readJsonSync(tsConfigPath);
        if (tsConfig.angularCompilerOptions && tsConfig.angularCompilerOptions.genDir) {
            aotGenDir = path.resolve(path.dirname(tsConfigPath), tsConfig.angularCompilerOptions.genDir);
        }
    }
    return aotGenDir;
}

export async function getAoTGenDir(tsConfigPath: string): Promise<string | undefined> {
    let aotGenDir: string | undefined = undefined;

    if (tsConfigPath) {
        const tsConfig = await readJson(tsConfigPath);
        if (tsConfig.angularCompilerOptions && tsConfig.angularCompilerOptions.genDir) {
            aotGenDir = path.resolve(path.dirname(tsConfigPath), tsConfig.angularCompilerOptions.genDir);
        }
    }
    return aotGenDir;
}
