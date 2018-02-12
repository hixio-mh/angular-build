export interface CliOptions {
    args: any;
    cliVersion: string;
    cliIsGlobal: boolean;
    cliRootPath: string;
    startTime: number;

    command?: string;
    commandOptions?: any;
}
