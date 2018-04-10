export function normalizeEnvironment(rawEnvironment: any): { [key: string]: boolean | string; } {
    let environment: { [key: string]: boolean | string; } = {};
    if (!rawEnvironment) {
        return environment;
    }

    if (typeof rawEnvironment === 'string') {
        environment[rawEnvironment] = true;
    } else if (typeof rawEnvironment === 'object') {
        environment = { ...rawEnvironment };
    }

    const normalizedEnv: { [key: string]: boolean | string; } = {};
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
    if (typeof (environment.dll) !== 'undefined') {
        if (environment.dll) {
            environment.dll = true;
        } else {
            delete environment.dll;
        }
    }

    // aot
    if (typeof (environment.aot) !== 'undefined') {
        if (environment.aot) {
            environment.aot = true;
        } else {
            delete environment.aot;
        }
    }

    // prod
    if (typeof environment.prod !== 'undefined') {
        if (environment.prod) {
            environment.prod = true;
            (environment as any).production = true;
        } else {
            delete environment.prod;
            if (typeof (environment as any).production !== 'undefined') {
                delete (environment as any).production;
            }
        }
    } else if (typeof (environment as any).production !== 'undefined') {
        if ((environment as any).production) {
            environment.prod = true;
            (environment as any).production = true;
        } else {
            delete (environment as any).production;
            if (typeof environment.prod !== 'undefined') {
                delete environment.prod;
            }
        }
    } else {
        if (typeof environment.prod !== 'undefined') {
            delete environment.prod;
        }
        if (typeof (environment as any).production !== 'undefined') {
            delete (environment as any).production;
        }
    }


    // dev
    if (environment.prod) {
        if (typeof environment.dev !== 'undefined') {
            delete environment.dev;
        }
        if (typeof (environment as any).development !== 'undefined') {
            delete (environment as any).development;
        }
    } else {
        if (typeof environment.dev === 'undefined' &&
            typeof (environment as any).development === 'undefined') {
            environment.dev = true;
            (environment as any).development = true;
        } else if (typeof environment.dev !== 'undefined') {
            if (environment.dev) {
                environment.dev = true;
                (environment as any).development = true;
            } else {
                delete environment.dev;
                if (typeof (environment as any).development !== 'undefined') {
                    delete (environment as any).development;
                }
            }
        } else if (typeof (environment as any).development !== 'undefined') {
            if ((environment as any).development) {
                environment.dev = true;
                (environment as any).development = true;
            } else {
                delete (environment as any).development;
                if (typeof environment.dev !== 'undefined') {
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
