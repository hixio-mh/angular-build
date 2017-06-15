// ReSharper disable once CommonJsExternalModule
const spawn = require('cross-spawn');

export function spawnPromise(command: string,
    commandArgs: string[],
    showStdOut?: boolean,
    showStdErr: boolean = true,
    errorFilter?: RegExp): Promise<number> {
    return new Promise((resolve, reject) => {
        // const child = spawn(command, commandArgs, { stdio: 'inherit' });
        const child = spawn(command, commandArgs);
        child.stdout.on('data',
            (data: any) => {
                if (showStdOut) {
                    console.log(`${data}`);
                }
            });
        child.stderr.on('data',
            (data: any) => {
                if (showStdErr) {
                    const msg = data.toString();
                    if (!errorFilter || !errorFilter.test(msg)) {
                        console.error(msg);
                    }
                }
            });
        child.on('error',
            (err: any) => {
                reject(err);
            });
        child.on('close',
            (code: number) => {
                resolve(code);
            });
    });
}
