import { ParsedCommandLine, ScriptTarget } from 'typescript';

import { JsonObject } from '../json-object';
import { TsTranspilationOptions } from '../lib-project-config';

export interface TsTranspilationOptionsInternal extends TsTranspilationOptions {
    _index: number;
    _tsConfigPath: string;
    _tsConfigJson: JsonObject;
    _tsCompilerConfig: ParsedCommandLine;
    _declaration: boolean;
    _scriptTarget: ScriptTarget;
    _tsOutDirRootResolved: string;

    _angularCompilerOptions?: JsonObject;
    _detectedEntryName?: string;
    _typingsOutDir?: string;
    _customTsOutDir?: string;
}
