// tslint:disable:no-any
// tslint:disable:no-unsafe-any

// tslint:disable:max-func-body-length
export function normalizeEnvironment(rawEnvironment: any, prod?: boolean): { [key: string]: boolean | string } {
    let environment: { [key: string]: boolean | string } = {};
    if (!rawEnvironment) {
        return environment;
    }

    if (typeof rawEnvironment === 'string') {
        environment[rawEnvironment] = true;
    } else if (typeof rawEnvironment === 'object') {
        environment = { ...rawEnvironment };
    }

    const normalizedEnv: { [key: string]: boolean | string } = {};
    Object.keys(environment).forEach((key: string) => {
        const normalizedKey = normalizeEnvName(key);
        normalizedEnv[normalizedKey] = environment[key];
        if (typeof (normalizedEnv as any)[normalizedKey] === 'string' &&
            ((normalizedEnv as any)[normalizedKey] as string).toLowerCase() === 'true') {
            (normalizedEnv as any)[normalizedKey] = true;
        } else if (typeof (normalizedEnv as any)[normalizedKey] === 'string' &&
            ((normalizedEnv as any)[normalizedKey] as string).toLowerCase() === 'false') {
            (normalizedEnv as any)[normalizedKey] = false;
        }
    });

    environment = { ...normalizedEnv };

    // dll
    if (environment.dll != null) {
        if (environment.dll) {
            environment.dll = true;
        } else {
            delete environment.dll;
        }
    }

    // aot
    if (environment.aot != null) {
        if (environment.aot) {
            environment.aot = true;
        } else {
            delete environment.aot;
        }
    }

    // prod
    if (prod) {
        environment.prod = true;
    }

    if (environment.prod != null) {
        if (environment.prod) {
            environment.prod = true;
            (environment as any).production = true;
        } else {
            delete environment.prod;
            if (typeof (environment as any).production != null) {
                delete (environment as any).production;
            }
        }
    } else if ((environment as any).production != null) {
        if ((environment as any).production) {
            environment.prod = true;
            (environment as any).production = true;
        } else {
            delete (environment as any).production;
            if (environment.prod != null) {
                delete environment.prod;
            }
        }
    } else {
        if (environment.prod != null) {
            delete environment.prod;
        }
        if ((environment as any).production != null) {
            delete (environment as any).production;
        }
    }

    // dev
    if (environment.prod) {
        if (environment.dev != null) {
            delete environment.dev;
        }
        if ((environment as any).development != null) {
            delete (environment as any).development;
        }
    } else {
        if (environment.dev == null &&
            (environment as any).development == null) {
            environment.dev = true;
            (environment as any).development = true;
        } else if (environment.dev != null) {
            if (environment.dev) {
                environment.dev = true;
                (environment as any).development = true;
            } else {
                delete environment.dev;
                if ((environment as any).development != null) {
                    delete (environment as any).development;
                }
            }
        } else if ((environment as any).development != null) {
            if ((environment as any).development) {
                environment.dev = true;
                (environment as any).development = true;
            } else {
                delete (environment as any).development;
                if (environment.dev != null) {
                    delete environment.dev;
                }
            }
        }
    }

    return environment;
}

function normalizeEnvName(envName: string): string {
    const envLower = envName.toLowerCase();
    switch (envLower) {
        case 'prod':
        case 'production':
            return 'prod';
        case 'dev':
        case 'development':
            return 'dev';
        case 'dll':
            return 'dll';
        case 'hot':
            return 'hot';
        case 'test':
            return 'test';
        case 'aot':
            return 'aot';
        default:
            return envName;
    }
}
