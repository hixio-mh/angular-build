export interface BuildCommandOptions {
    config?: string;
    env?: string | { [key: string]: string | boolean };
    prod?: boolean;
    filter?: string | string[];
    clean?: boolean;
    progress?: boolean;
    verbose?: boolean;
    watch?: boolean;
    beep?: boolean;

    _startTime?: number;
    _fromBuiltInCli?: boolean;
    _cliIsGlobal?: boolean;
    _cliIsLink?: boolean;
    _cliRootPath?: string;
    _cliVersion?: string;
}
