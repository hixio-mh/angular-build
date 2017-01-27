export { IconDesign, IconOptions, IconPluginOptions } from './plugins/icon-webpack-plugin';
export interface AppConfig {
    root?: string;
    outDir?: string;
    assets?: any[];
    styles?: (string | GlobalScopedEntry)[];
    scripts?: (string | GlobalScopedEntry)[];
    environments?: any;
    test?: string;
    tsconfig?: string;
    index?: string;
    indexOutFileName?: string;
    htmlInjectOptions?: HtmlInjectOptions;
    faviconConfig?: string;
    publicPath?: string;
    name?: string;
    extends?: string;
    target?: string;
    enabled?: boolean;
    appendOutputHashOnDevelopment?: boolean;
    appendOutputHashOnProduction?: boolean;
    compressAssetsOnProduction?: boolean;
    provide: {
        [key: string]: string;
    };
    skipOnDllsBundle?: boolean;
    referenceDllsOnDevelopment?: boolean;
    referenceDllsOnProduction?: boolean;
    tryBundleDlls?: boolean;
    dllOutChunkName?: string;
    dlls?: (DllEntry | string)[];
    productionReplacementModules?: ProductionReplacementEntry[];
}
export interface AngularAppConfig extends AppConfig {
    main?: string;
    mainAot?: string;
    aotGenDir?: string;
    i18nFile?: string;
    i18nFormat?: string;
    locale?: string;
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
    importToMain?: boolean;
}
export interface GlobalScopedEntry {
    input: string;
    output?: string;
    lazy?: boolean;
    path?: string;
    entry?: string;
}
export interface ProductionReplacementEntry {
    resourceRegExp: string;
    newResource: string;
}
export interface BuildOptions {
    progress?: boolean;
    debug?: boolean;
    dll?: boolean;
    performanceHints?: boolean;
    copyAssetsOnDllBuild?: boolean;
    generateIconsOnDllBuild?: boolean;
    sourceMapOnProduction?: boolean;
}
export interface AngularBuildOptions extends BuildOptions {
    aot?: boolean;
}
export interface AngularBuildConfig {
    apps?: AngularAppConfig[];
}
