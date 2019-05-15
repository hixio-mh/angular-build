import { JsonObject } from '../models';

export interface CliOptions {
    cliVersion: string;
    cliIsGlobal?: boolean;
    cliRootPath?: string;
    startTime?: number;
    cliIsLink?: boolean;
    commandOptions?: JsonObject;
}
