import { EOL } from 'os';
import * as supportsColor from 'supports-color';

import { colorize } from './colorize';

export class Logger {
    private readonly colorSupported: boolean = supportsColor;

    constructor(public readonly outputStream: NodeJS.Socket = process.stdout,
        public readonly errorStream: NodeJS.Socket = process.stderr) {
    }

    log(data: string): void {
        this.outputStream.write(data);
    }

    info(data: string): void {
        this.log(`${colorize('INFO', 'cyan', this.colorSupported)}: ${data}`);
    }

    warn(data: string): void {
        this.log(`${colorize('WARN', 'yellow', this.colorSupported)}: ${data}`);
    }

    error(data: string, prefixErrorText: boolean = true): void {
        prefixErrorText
            ? this.errorStream.write(`${colorize('ERROR', 'red', this.colorSupported)}: ${data}`)
            : this.errorStream.write(data);
    }

    logLine(data: string): void {
        this.outputStream.write(data + EOL);
    }

    infoLine(data: string): void {
        this.info(data + EOL);
    }

    warnLine(data: string): void {
        this.warn(data + EOL);
    }

    errorLine(data: string, prefixErrorText: boolean = true): void {
        this.error(data + EOL, prefixErrorText);
    }
}
