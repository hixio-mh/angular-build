declare var module: NodeModule;

interface NodeModule {
    // SystemJS module definition
    id: string;
}

declare var ENV: {
    PRODUCTION: boolean;
    [key: string]: string | boolean;
};
declare var PRODUCTION: boolean;

interface GlobalEnvironment {
    ENV: {
        PRODUCTION: boolean;
        [key: string]: string | boolean;
    };
    PRODUCTION: boolean;
}

// tslint:disable-next-line:no-empty-interface
interface Global extends GlobalEnvironment { }
