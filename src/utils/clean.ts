import * as rimraf from 'rimraf';

export function clean(filesToClean: string): Promise<any> {
    return new Promise((resolve: any, reject: any) => rimraf(filesToClean,
            (err: Error) => err ? reject(err) : resolve())
    );
}
