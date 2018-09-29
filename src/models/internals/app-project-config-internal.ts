import { AppProjectConfig, AppProjectConfigBase } from '../app-project-config';

import { GlobalScriptStyleParsedEntry } from './global-script-style-parsed-entry';
import { PolyfillDllParsedEntry } from './polyfill-dll-parsed-entry';
import { ProjectConfigInternal } from './project-config-internal';

export interface AppProjectConfigInternal extends AppProjectConfig, ProjectConfigInternal<AppProjectConfigBase> {
    _outputHashing?: {
        bundles?: boolean;
        chunks?: boolean;
        extractedAssets?: boolean;
    };

    _ecmaVersion?: number;
    _supportES2015?: boolean;
    _nodeResolveFields?: string[];

    _isDll?: boolean;
    _dllParsedResult?: PolyfillDllParsedEntry;
    _polyfillParsedResult?: PolyfillDllParsedEntry;
    _scriptParsedEntries?: GlobalScriptStyleParsedEntry[];
    _styleParsedEntries?: GlobalScriptStyleParsedEntry[];
}
