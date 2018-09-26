import { LibProjectConfig, LibProjectConfigBase } from "../lib-project-config";

import { GlobalScriptStyleParsedEntry } from './global-script-style-parsed-entry';
import { LibBundleOptionsInternal } from './lib-bundle-options-internal';
import { PackageEntrypoints } from './package-entrypoints';
import { ProjectConfigInternal } from './project-config-internal';
import { TsTranspilationOptionsInternal } from './ts-transpilation-options-internal';

export interface LibProjectConfigInternal extends LibProjectConfig, ProjectConfigInternal<LibProjectConfigBase> {
    _isNestedPackage?: boolean;
    _styleParsedEntries?: GlobalScriptStyleParsedEntry[];

    _tsTranspilations?: TsTranspilationOptionsInternal[];
    _prevTsTranspilationVersionReplaced?: boolean;
    _prevTsTranspilationResourcesInlined?: boolean;

    _bundles?: LibBundleOptionsInternal[];

    _packageJsonOutDir?: string;
    _packageEntryPoints?: PackageEntrypoints;
}
