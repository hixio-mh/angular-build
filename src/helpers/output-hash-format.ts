export interface OutputHashFormat {
    bundle: string;
    chunk: string;
    extractedAssets: string;
}

export const outputHashFormat: OutputHashFormat = {
    bundle: `.[hash:${20}]`,
    chunk: `.[chunkhash:${20}]`,
    extractedAssets: `.[hash:${20}]`
};
