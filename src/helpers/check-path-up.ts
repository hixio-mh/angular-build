import * as path from 'path';

import { isInFolder } from '../utils';

export function checkPathUp(regex: RegExp, currentDir: string, rootPath: string): boolean {
    do {
        if (regex.test(currentDir)) {
            return true;
        }

        currentDir = path.dirname(currentDir);
        if (!currentDir || path.parse(currentDir).root === currentDir) {
            break;
        }

    } while (currentDir && isInFolder(rootPath, currentDir));

    return false;
}
