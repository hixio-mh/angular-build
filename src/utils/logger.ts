import { colorize } from './colorize';

export enum LogLevel {
    None = 0,
    Error = 1,
    Warn = 2,
    Info = 4,
    Debug = 8
}

export type LogLevelSring = 'debug' | 'info' | 'warn' | 'error' | 'none';

export type LoggerOptions = {
    logLevel?: LogLevelSring;
    name?: string;
    debugPrefix?: string;
    infoPrefix?: string;
    warnPrefix?: string;
    errorPrefix?: string;
    color?: boolean;
};


export interface LoggerBase {
    debug?: (message: string, optionalParams?: any[]) => void;
    info?: (message: string, optionalParams?: any[]) => void;
    warn?: (message: string, optionalParams?: any[]) => void;
    error?: (message: string, optionalParams?: any[]) => void;
}

export class Logger implements LoggerBase {

    readonly loggerOptions: LoggerOptions;
    private minLogLevel: LogLevel = LogLevel.Info;

    set logLevel(logLevel: LogLevelSring) {
        switch (logLevel) {
            case 'debug':
                this.minLogLevel = LogLevel.Debug;
                break;
            case 'info':
                this.minLogLevel = LogLevel.Info;
                break;
            case 'warn':
                this.minLogLevel = LogLevel.Warn;
                break;
            case 'error':
                this.minLogLevel = LogLevel.Error;
                break;
            case 'none':
                this.minLogLevel = LogLevel.None;
                break;
            default:
        }
    }

    constructor(loggerOptions: LoggerOptions) {
        this.loggerOptions = loggerOptions || {};
        if (this.loggerOptions.logLevel) {
            this.logLevel = this.loggerOptions.logLevel;
        }
    }

    debug(message: string, optionalParams?: any[]): void {
        if (this.minLogLevel < LogLevel.Debug || !message) {
            return;
        }

        const prefix =
            `${this.loggerOptions.name ? this.loggerOptions.name + ' ' : ''}${
            this.loggerOptions.debugPrefix
                ? this.loggerOptions.debugPrefix + ' '
                : ''}`;
        if (optionalParams) {
            console.log(`${prefix}${message}`, optionalParams);
        } else {
            console.log(`${prefix}${message}`);
        }
    }

    info(message: string, optionalParams?: any[]): void {
        if (this.minLogLevel < LogLevel.Info || !message) {
            return;
        }

        const prefix =
            `${this.loggerOptions.name ? this.loggerOptions.name + ' ' : ''}${
            this.loggerOptions.infoPrefix
                ? this.loggerOptions.infoPrefix + ' '
                : ''}`;
        if (optionalParams) {
            console.log(`${prefix}${message}`, optionalParams);
        } else {
            console.log(`${prefix}${message}`);
        }
    }

    warn(message: string, optionalParams?: any[]): void {
        if (this.minLogLevel < LogLevel.Warn || !message) {
            return;
        }

        const prefix =
            `${this.loggerOptions.name ? this.loggerOptions.name + ' ' : ''}${
            this.loggerOptions.warnPrefix
                ? this.loggerOptions.warnPrefix + ' '
                : ''}`;
        const logMsg = this.loggerOptions.color !== false
            ? colorize(`${prefix}${message.trim()}`, 'yellow')
            : `${prefix}${message.trim()}`;

        if (optionalParams) {
            console.warn(logMsg, optionalParams);
        } else {
            console.warn(logMsg);
        }
    }

    error(message: string, optionalParams?: any[]): void {
        if (this.minLogLevel < LogLevel.Warn || !message) {
            return;
        }

        const prefix =
            `${this.loggerOptions.name ? this.loggerOptions.name + ' ' : ''}${
            this.loggerOptions.errorPrefix
                ? this.loggerOptions.errorPrefix + ' '
                : ''}`;
        const logMsg = this.loggerOptions.color !== false
            ? colorize(`${prefix}${message.trim()}`, 'red')
            : `${prefix}${message.trim()}`;

        if (optionalParams) {
            console.error(logMsg, optionalParams);
        } else {
            console.error(logMsg);
        }
    }
}
