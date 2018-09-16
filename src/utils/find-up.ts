import { existsSync } from 'fs';
import * as path from 'path';

import { isInFolder, isSamePaths } from './path-helpers';

export function findUpSync(fileName: string | string[], currentDir: string, workingDir: string): string | null {
    let currentDirLocal = currentDir;
    const fileNames = Array.isArray(fileName) ? fileName : [fileName];
    const rootPath = path.parse(currentDirLocal).root;

    do {
        for (const f of fileNames) {
            const tempPath = path.isAbsolute(f) ? f : path.resolve(currentDirLocal, f);
            if (existsSync(tempPath)) {
                return tempPath;
            }
        }

        if (currentDirLocal === rootPath) {
            break;
        }

        currentDirLocal = path.dirname(currentDirLocal);
    } while (currentDirLocal && (isSamePaths(workingDir, currentDirLocal) || isInFolder(workingDir, currentDirLocal)));

    return null;
}
