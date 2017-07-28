// ReSharper disable once CommonJsExternalModule
const spawn = require('cross-spawn');

export function spawnPromise(command: string,
    commandArgs: string[],
    showStdOut?: boolean,
    showStdErr: boolean = true,
    errorFilter?: RegExp, cwd?: string, stdio?: string, returnStdOut?: boolean): Promise<number|string> {
    return new Promise((resolve, reject) => {
        const child = cwd
            ? spawn(command, commandArgs, { cwd: cwd, stdio: stdio })
            : spawn(command, commandArgs, { stdio: stdio });
        if (child.stdout) {
            child.stdout.on('data',
                (data: any) => {
                    if (returnStdOut) {
                        resolve(data.toString().trim());
                        return;
                    }
                    if (showStdOut) {
                        console.log(`${data.toString().trim()}`);
                    }
                });
        }
        if (child.stderr) {
            child.stderr.on('data',
                (data: any) => {
                    if (showStdErr) {
                        const msg = data.toString();
                        if (!errorFilter || !errorFilter.test(msg)) {
                            console.error(msg);
                        }
                    }
                });
        }
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
