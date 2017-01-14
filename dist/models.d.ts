export interface AppConfig {
    root?: string;
    outDir?: string;
    main?: string;
    assets?: any;
    styles?: string[];
    scripts?: string[];
    environments?: any;
    test?: string;
    index?: string;
    indexOutFileName?: string;
    htmlInjectOptions?: HtmlInjectOptions;
    icon?: string | {
        masterPicture: any;
    };
    publicPath?: string;
    name?: string;
    extends?: string;
    target?: string;
    enabled?: boolean;
    skipOnDllBuild?: boolean;
    appendHashVersionOnDevelopment?: boolean;
    appendHashVersionOnProduction?: boolean;
    compressAssetsOnProduction?: boolean;
    provide: {
        [key: string]: string;
    };
    referenceDllOnDevelopment?: boolean;
    referenceDllOnProduction?: boolean;
    tryBuildDll?: boolean;
    tryBuildDllCommand?: string;
    tryBuildDllCommandArgs?: string[];
    dllEntryChunkName?: string;
    dlls?: DllEntry[] | string[];
    importPolyfillsToMain?: boolean;
    tsconfig?: string;
}
export interface HtmlInjectOptions {
    stylesInjectOutFileName?: string;
    iconsInjectOutFileName?: string;
    customScriptAttributes?: {
        [key: string]: any;
    };
    customLinkAttributes: {
        [key: string]: any;
    };
}
export interface DllEntry {
    entry: string[] | string;
    targets?: string[];
    env?: string;
    isPolyfills?: boolean;
}
export interface ExtraEntry {
    input: string;
    output?: string;
    lazy?: boolean;
    path?: string;
    entry?: string;
}
export interface BuildOptions {
    progress?: boolean;
    debug?: boolean;
    dll?: boolean;
    copyAssetsOnDllBuild?: boolean;
    generateIconssOnDllBuild?: boolean;
    sourcemapOnProduction?: boolean;
    useNameModuleOnDevelopment?: boolean;
    generateAssetsOnDevelopment?: boolean;
    generateAssetsOnProduction?: boolean;
    generateStatsOnDevelopment?: boolean;
    generateStatsOnProduction?: boolean;
    productionReplacementModules?: ReplacementModuleEntry[];
}
export interface ReplacementModuleEntry {
    resourceRegExp: string;
    newResource: string;
}
export interface AngularBuildOptions extends BuildOptions {
    aot?: boolean;
}
export interface AngularAppConfig extends AppConfig {
    mainAoT?: string;
    i18nFile?: string;
    i18nFormat?: string;
    locale?: string;
}
