/// <reference types="yargs" />
import * as yargs from 'yargs';
import { CliOptions } from './models';
export declare const buildCommandModule: yargs.CommandModule;
export declare function build(cliOptions: CliOptions): Promise<{}>;
