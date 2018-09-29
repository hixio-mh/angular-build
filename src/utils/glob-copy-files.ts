import * as path from 'path';

import * as denodeify from 'denodeify';
import { copy, move } from 'fs-extra';
import * as glob from 'glob';

const globPromise = denodeify(glob) as (pattern: string, options?: glob.IOptions) => Promise<string[]>;

export async function globCopyFiles(fromPath: string, pattern: string, toPath: string, forMove?: boolean):
    Promise<void> {
    const files = await globPromise(pattern, { cwd: fromPath });
    for (const relFileName of files) {
        const sourceFilePath = path.join(fromPath, relFileName);
        const destFilePath = path.join(toPath, relFileName);

        if (forMove) {
            await move(sourceFilePath, destFilePath);
        } else {
            await copy(sourceFilePath, destFilePath);
        }
    }
}
