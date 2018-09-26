export interface PackageEntrypoints {
    main?: string;
    // tslint:disable-next-line:no-reserved-keywords
    module?: string;
    es2015?: string;
    esm5?: string;
    esm2015?: string;
    fesm2015?: string;
    fesm5?: string;
    typings?: string;
}
