// tslint:disable:no-any
// tslint:disable:no-unsafe-any
// tslint:disable:no-console

import { colorize } from './colorize';

export enum LogLevel {
    None = 0,
    Error = 1,
    Warn = 2,
    Info = 4,
    Debug = 8
}

export type LogLevelString = 'debug' | 'info' | 'warn' | 'error' | 'none';

export interface LoggerOptions {
    logLevel?: LogLevelString;
    name?: string;
    debugPrefix?: string;
    infoPrefix?: string;
    warnPrefix?: string;
    errorPrefix?: string;
    color?: boolean;
}

export interface LoggerBase {
    debug(message: string, optionalParams?: any): void;
    info(message: string, optionalParams?: any): void;
    warn(message: string, optionalParams?: any): void;
    error(message: string, optionalParams?: any): void;
}

export class Logger implements LoggerBase {
    readonly loggerOptions: LoggerOptions;
    private _minLogLevel: LogLevel = LogLevel.Info;

    set logLevel(logLevel: LogLevelString) {
        switch (logLevel) {
            case 'debug':
                this._minLogLevel = LogLevel.Debug;
                break;
            case 'info':
                this._minLogLevel = LogLevel.Info;
                break;
            case 'warn':
                this._minLogLevel = LogLevel.Warn;
                break;
            case 'error':
                this._minLogLevel = LogLevel.Error;
                break;
            case 'none':
                this._minLogLevel = LogLevel.None;
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

    debug(message: string, optionalParams?: any): void {
        if (this._minLogLevel < LogLevel.Debug || !message) {
            return;
        }

        const prefix =
            // tslint:disable-next-line:prefer-template
            `${this.loggerOptions.name ? this.loggerOptions.name + ' ' : ''}${
            this.loggerOptions.debugPrefix
                // tslint:disable-next-line:prefer-template
                ? this.loggerOptions.debugPrefix + ' '
                : ''}`;
        if (optionalParams) {
            console.log(`${prefix}${message}`, optionalParams);
        } else {
            console.log(`${prefix}${message}`);
        }
    }

    info(message: string, optionalParams?: any): void {
        if (this._minLogLevel < LogLevel.Info || !message) {
            return;
        }

        const prefix =
            // tslint:disable-next-line:prefer-template
            `${this.loggerOptions.name ? this.loggerOptions.name + ' ' : ''}${
            this.loggerOptions.infoPrefix
                // tslint:disable-next-line:prefer-template
                ? this.loggerOptions.infoPrefix + ' '
                : ''}`;
        if (optionalParams) {
            console.log(`${prefix}${message}`, optionalParams);
        } else {
            console.log(`${prefix}${message}`);
        }
    }

    warn(message: string, optionalParams?: any): void {
        if (this._minLogLevel < LogLevel.Warn || !message) {
            return;
        }

        const prefix =
            // tslint:disable-next-line:prefer-template
            `${this.loggerOptions.name ? this.loggerOptions.name + ' ' : ''}${
            this.loggerOptions.warnPrefix
                // tslint:disable-next-line:prefer-template
                ? this.loggerOptions.warnPrefix + ' '
                : ''}`;
        const logMsg = this.loggerOptions.color !== false
            ? colorize(`${prefix}${message}`, 'yellow')
            : `${prefix}${message.trimLeft()}`;

        if (optionalParams) {
            console.warn(logMsg, optionalParams);
        } else {
            console.warn(logMsg);
        }
    }

    error(message: string, optionalParams?: any): void {
        if (this._minLogLevel < LogLevel.Error || !message) {
            return;
        }

        const prefix =
            // tslint:disable-next-line:prefer-template
            `${this.loggerOptions.name ? this.loggerOptions.name + ' ' : ''}${
            this.loggerOptions.errorPrefix
                // tslint:disable-next-line:prefer-template
                ? this.loggerOptions.errorPrefix + ' '
                : ''}`;
        const logMsg = this.loggerOptions.color !== false
            ? colorize(`${prefix}${message}`, 'red')
            : `${prefix}${message.trimLeft()}`;

        if (optionalParams) {
            console.error(logMsg, optionalParams);
        } else {
            console.error(logMsg);
        }
    }
}
