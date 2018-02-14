export interface OutputHashFormat {
    bundle: string;
    chunk: string;
    extractedCss: string;
    extractedAssets: string;
}

export const outputHashFormat: OutputHashFormat = {
    bundle: `.[chunkhash:${20}]`,
    chunk: `.[chunkhash:${20}]`,
    extractedCss: `.[contenthash:${20}]`,
    extractedAssets: `.[hash:${20}]`
};

