import * as sass from 'node-sass';

export function sassPromise(options: SassOptions): Promise<SassResult> {
    return new Promise((resolve, reject) => {
        sass.render(options,
            (err, result) => {
                err ? reject(err) : resolve(result);
            });
    });
}

export interface SassResult {
    css: Buffer;
    map: Buffer;
    stats: {
        entry: string;
        start: number;
        end: number;
        duration: number;
        includedFiles: string[];
    };
}

export type SassImporterReturnType = { file: string } | { contents: string } | Error | null;

export interface SassImporter {
    (url: string, prev: string, done: (data: SassImporterReturnType) => void): SassImporterReturnType | void;
}

export interface SassOptions {
    file?: string;
    data?: string;
    importer?: SassImporter | SassImporter[];
    functions?: { [key: string]: Function };
    includePaths?: string[];
    indentedSyntax?: boolean;
    indentType?: string;
    indentWidth?: number;
    linefeed?: string;
    omitSourceMapUrl?: boolean;
    outFile?: string;
    outputStyle?: 'compact' | 'compressed' | 'expanded' | 'nested';
    precision?: number;
    sourceComments?: boolean;
    sourceMap?: boolean | string;
    sourceMapContents?: boolean;
    sourceMapEmbed?: boolean;
    sourceMapRoot?: string;
}
