import { ParsedCommandLine, ScriptTarget } from 'typescript';

import { TsTranspilationOptions } from '../lib-project-config';

export interface TsTranspilationOptionsInternal extends TsTranspilationOptions {
    _index: number;
    _tsConfigPath: string;
    _tsConfigJson: { [key: string]: string | boolean | {} };
    _tsCompilerConfig: ParsedCommandLine;
    _declaration: boolean;
    _scriptTarget: ScriptTarget;
    _tsOutDirRootResolved: string;

    _angularCompilerOptions?: { [key: string]: string };
    _detectedEntryName?: string;
    _typingsOutDir?: string;
    _customTsOutDir?: string;
}
