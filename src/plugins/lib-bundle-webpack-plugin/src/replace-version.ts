import * as path from 'path';

import { readFile, writeFile } from 'fs-extra';
import * as denodeify from 'denodeify';
import * as glob from 'glob';

const globPromise = denodeify(glob) as (pattern: string, options?: glob.IOptions) => Promise<string[]>;

const versionRegex = /export\s+const\s+VERSION\s*=\s*['"`](.*PLACEHOLDER)['"`]/g;

export async function replaceVersion(
    outDir: string,
    projectVersion: string,
    searchPatterns: string | string[]): Promise<void> {
    if (typeof searchPatterns === 'string') {
        searchPatterns = [searchPatterns as string];
    }

    await Promise.all((searchPatterns as string[]).map(async (pattern) => {
        if (pattern.indexOf('*') < 0) {
            pattern = path.join(pattern, '**', '*');
        }

        let files = await globPromise(pattern, { cwd: outDir, nodir: true, dot: true });
        files = files.filter(name => /\.js$/i.test(name));
        await Promise.all(files.map(async (filePath: string) => {
            const content = await readFile(filePath, 'utf-8');
            if (versionRegex.test(content)) {
                content.replace(versionRegex, projectVersion);
                await writeFile(filePath, content);
            }
        }));
    }));
}
