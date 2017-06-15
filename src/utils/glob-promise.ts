import * as glob from 'glob';

export function globPromise(pattern: string, options: glob.IOptions): Promise<string[]> {
    return new Promise((resolve, reject) => {
        glob(pattern,
            options,
            (err, matches) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve(matches);
            });
    });
}
