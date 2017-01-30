import { DllEntry } from './models';
export interface DllEntryParsedResult {
    entries: DllEntry[];
    fileDependencies?: string[];
}
export declare function parseDllEntries(baseDir: string, dlls: string | (string | DllEntry)[], isProd: boolean): DllEntryParsedResult;
export declare function packageChunkSort(packages: string[]): (left: any, right: any) => 1 | -1;
export declare function isWebpackDevServer(): boolean;
export declare function hasProdArg(): boolean;
export declare function getEnvName(isProd: boolean, longName?: boolean): string;
export declare function isDllBuildFromNpmEvent(eventName?: string): boolean;
export declare function isAoTBuildFromNpmEvent(eventName?: string): boolean;
