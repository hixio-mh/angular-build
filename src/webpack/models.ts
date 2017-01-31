export { IconDesign, IconOptions, IconPluginOptions } from './plugins/icon-webpack-plugin';

export interface AppConfig {
    name?: string;
    extends?: string,
    target?: string;
    root?: string;
    outDir?: string;
    main?: string;
    assets?: string | (string | AssetEntry)[];
    styles?: string | (string | GlobalScopedEntry)[];
    scripts?: string | (string | GlobalScopedEntry)[];
    provide: { [key: string]: string };
    tsconfig?: string;
    publicPath?: string;
    index?: string;
    htmlInjectOptions?: HtmlInjectOptions;
    faviconConfig?: string;
    dlls?: (DllEntry | string)[];
    dllOutChunkName?: string;
    referenceDll?: boolean;
    moduleReplacements?: ModuleReplacementEntry[];
    environments?: { [key: string]: string };

    // Environment specifics
    appendVersionHash?: boolean;
    sourceMap?: boolean;
    compressAssets?: boolean;
    skipCopyAssets?: boolean;
    skipGenerateIcons?: boolean;
    buildTargetOverrides: { [name: string]: { [key: string]: any } };
    skip?: boolean;

    test?: string;
    aotGenDir?: string;
    i18nFile?: string;
    i18nFormat?: string;
    locale?: string;
}

export type AssetEntry = {
    from: string | {
        glob: string;
        dot?: boolean;
    };
    to?: string;
    context?: string;
};

export type GlobalScopedEntry = {
    input: string;
    output?: string;
    lazy?: boolean;
    path?: string;
    entry?: string;
}

export type DllEntry = {
    entry: string | string[];
    importToMain?: boolean;
}

export type ModuleReplacementEntry = {
    resourceRegExp: string;
    newResource: string;
}

export interface HtmlInjectOptions {
    indexOutFileName?: string;
    stylesOutFileName?: string;
    iconsOutFileName?: string;
    customTagAttributes?: {
        tagName: string;
        attribute: { [key: string]: string | boolean };
    }[];
}


export interface BuildOptions {
    angularBuildConfigFile?: string;
    progress?: boolean;
    verbose?: boolean;
    performanceHint?: boolean;

    // production, prod
    production?: boolean;
    // dll
    dll?: boolean;
    aot?: boolean;
}

export interface AngularBuildConfig {
    apps?: AppConfig[];
}