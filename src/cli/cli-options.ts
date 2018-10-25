export interface CliOptions {
    cliVersion: string;
    cliIsGlobal?: boolean;
    cliRootPath?: string;
    startTime?: number;
    cliIsLink?: boolean;
    // tslint:disable-next-line:no-any
    commandOptions?: { [key: string]: any };
}
