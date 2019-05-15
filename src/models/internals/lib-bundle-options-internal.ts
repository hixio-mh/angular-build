import { ParsedCommandLine, ScriptTarget } from 'typescript';

import { JsonObject } from '../json-object';
import { LibBundleOptions } from '../lib-project-config';

export interface LibBundleOptionsInternal extends LibBundleOptions {
    _index: number;
    _entryFilePath: string;
    _outputFilePath: string;

    _tsConfigPath?: string;
    _tsConfigJson?: JsonObject;
    _tsCompilerConfig?: ParsedCommandLine;

    _sourceScriptTarget?: ScriptTarget;
    _destScriptTarget?: ScriptTarget;
    _ecmaVersion?: number;
    _supportES2015?: boolean;

    _nodeResolveFields?: string[];
}
