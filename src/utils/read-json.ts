// tslint:disable:no-any
// tslint:disable:no-unsafe-any

import { readFile, readFileSync } from 'fs';

import { stripComments } from './strip-comments';

export async function readJson(filePath: string): Promise<any> {
    const content = await new Promise((resolve, reject) => {
        readFile(filePath,
            (err, buffer) => {
                if (err) {
                    reject(err);

                    return;
                }

                resolve(buffer);
            });
    });

    const contentStr = stripComments(content.toString().replace(/^\uFEFF/, ''));

    return JSON.parse(contentStr);
}

export function readJsonSync(filePath: string): any {
    let data = readFileSync(filePath, 'utf-8');
    data = stripComments(data.toString().replace(/^\uFEFF/, ''));

    return JSON.parse(data);
}
