import { existsSync } from 'fs';
import * as path from 'path';

import { isInFolder, isSamePaths } from './path-helpers';

export function findUpSync(fileName: string | string[], currentDir: string, workingDir: string): string | null {
  const fileNames = Array.isArray(fileName) ? fileName : [fileName];
  const rootPath = path.parse(currentDir).root;

  do {
    for (const f of fileNames) {
      const tempPath = path.isAbsolute(f) ? f : path.resolve(currentDir, f);
      if (existsSync(tempPath)) {
        return tempPath;
      }
    }

    if (currentDir === rootPath) {
      break;
    }

    currentDir = path.dirname(currentDir);
  } while (currentDir && (isSamePaths(workingDir, currentDir) || isInFolder(workingDir, currentDir)));

  return null;
}
