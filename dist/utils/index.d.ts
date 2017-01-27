export declare function stripComments(content: string): string;
export declare function readJsonSync(filePath: string): any;
export declare function readJsonAsync(filePath: string, throwError?: boolean): Promise<{}>;
export declare function checkFileOrDirectoryExistsAsync(filePath: string, isDir?: boolean): Promise<{}>;
export declare function findFileOrDirectoryFromPossibleAsync(baseDir: string, possibleNames: string[], preferredName?: string, isDir?: boolean): Promise<{}>;
export declare function askAsync(msg: string): Promise<{}>;
export declare function spawnAsync(command: string, commandArgs: string[], showStdOut?: boolean, showStdErr?: boolean): Promise<{}>;
export declare function getVersionfromPackageJsonAsync(baseDir: string): Promise<{}>;
