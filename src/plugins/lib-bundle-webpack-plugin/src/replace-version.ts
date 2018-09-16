import * as path from 'path';

import * as denodeify from 'denodeify';
import { readFile, writeFile } from 'fs-extra';

import * as glob from 'glob';

import { Logger } from '../../../utils';

const globPromise = denodeify(glob) as (pattern: string, options?: glob.IOptions) => Promise<string[]>;
const versionRegex = /export\s+const\s+VERSION\s*=\s*['"`](.*PLACEHOLDER)['"`]/g;

export async function replaceVersion(
    searchRootDir: string,
    projectVersion: string,
    searchPattern: string,
    logger: Logger): Promise<boolean> {
    let replaced = false;

    if (searchPattern.indexOf('*') < 0) {
        searchPattern = path.join(searchPattern, '**', '*');
    }

    let files = await globPromise(searchPattern, { cwd: searchRootDir, nodir: true, dot: true });
    files = files.filter(name => /\.js$/i.test(name));

    for (const filePath of files) {
        const content = await readFile(filePath, 'utf-8');
        if (versionRegex.test(content)) {
            if (!replaced) {
                logger.debug('Updating version placeholder');
            }

            content.replace(versionRegex, projectVersion);
            await writeFile(filePath, content);

            replaced = true;
        }
    }

    return replaced;
}
