import * as path from 'path';

import * as denodeify from 'denodeify';
import { copy, ensureDir, remove } from 'fs-extra';
import * as glob from 'glob';

const globPromise = denodeify(glob) as (pattern: string, options?: glob.IOptions) => Promise<string[]>;

export async function globCopyFiles(fromPath: string, pattern: string, toPath: string, move?: boolean):
    Promise<void> {
    const files = await globPromise(pattern, { cwd: fromPath });
    for (const filePath of files) {
        const fileDestPath = path.join(toPath, filePath);
        await ensureDir(path.dirname(filePath));
        await copy(path.join(fromPath, filePath), fileDestPath);
        if (move) {
            await remove(path.join(fromPath, filePath));
        }
    }
}
