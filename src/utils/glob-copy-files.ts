import * as fs from 'fs-extra';
import * as path from 'path';

import { globPromise } from './glob-promise';

export async function globCopyFiles(fromPath: string, fileGlob: string, outDir: string): Promise<void> {
    const relativePaths = await globPromise(fileGlob, { cwd: fromPath, nodir: true, dot: true });
    await Promise.all(relativePaths.map(async (relativeFrom) => {
        const absoluteFrom = path.resolve(fromPath, relativeFrom);
        const dest = path.resolve(outDir, relativeFrom);
        await fs.copy(absoluteFrom, dest);
    }));
}
