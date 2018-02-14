declare var module: NodeModule;

interface NodeModule {
    // SystemJS module definition
    id: string;
}

declare var process: GlobalEnvironment;

interface GlobalEnvironment {
    env: {
        production: boolean;
        [key: string]: string | boolean;
    };
}

// declare var env: {
//     production: boolean;
//     [key: string]: string | boolean;
// };

// // tslint:disable-next-line:no-empty-interface
// interface Global extends GlobalEnvironment { }
