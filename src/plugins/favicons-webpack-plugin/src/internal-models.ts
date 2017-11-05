export interface IconStatsJson {
    iconsPathPrefix: string;
    htmls: string[];
    assets: string[];
}

export interface IconStatsInfo {
    filesHash: string;
    optionHash?: string;
    stats: IconStatsJson;
}
