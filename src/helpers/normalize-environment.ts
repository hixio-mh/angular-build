import { JsonObject } from '../models';

// tslint:disable:max-func-body-length
export function normalizeEnvironment(rawEnvironment: string | JsonObject | null, prod?: boolean): { [key: string]: boolean | string } {
    let environment: { [key: string]: boolean | string } = {};
    if (!rawEnvironment) {
        return environment;
    }

    if (typeof rawEnvironment === 'string') {
        environment[rawEnvironment] = true;
    } else if (typeof rawEnvironment === 'object') {
        environment = { ...(rawEnvironment as { [key: string]: boolean | string }) };
    }

    const normalizedEnv: { [key: string]: boolean | string } = {};
    Object.keys(environment).forEach((key: string) => {
        const normalizedKey = normalizeEnvName(key);
        normalizedEnv[normalizedKey] = environment[key];
        if (typeof normalizedEnv[normalizedKey] === 'string' &&
            (normalizedEnv[normalizedKey] as string).toLowerCase() === 'true') {
            normalizedEnv[normalizedKey] = true;
        } else if (typeof normalizedEnv[normalizedKey] === 'string' &&
            (normalizedEnv[normalizedKey] as string).toLowerCase() === 'false') {
            normalizedEnv[normalizedKey] = false;
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
            environment.production = true;
        } else {
            delete environment.prod;
            if (typeof environment.production != null) {
                delete environment.production;
            }
        }
    } else if (environment.production != null) {
        if (environment.production) {
            environment.prod = true;
            environment.production = true;
        } else {
            delete environment.production;
            if (environment.prod != null) {
                delete environment.prod;
            }
        }
    } else {
        if (environment.prod != null) {
            delete environment.prod;
        }
        if (environment.production != null) {
            delete environment.production;
        }
    }

    // dev
    if (environment.prod) {
        if (environment.dev != null) {
            delete environment.dev;
        }
        if (environment.development != null) {
            delete environment.development;
        }
    } else {
        if (environment.dev == null &&
            environment.development == null) {
            environment.dev = true;
            environment.development = true;
        } else if (environment.dev != null) {
            if (environment.dev) {
                environment.dev = true;
                environment.development = true;
            } else {
                delete environment.dev;
                if (environment.development != null) {
                    delete environment.development;
                }
            }
        } else if (environment.development != null) {
            if (environment.development) {
                environment.dev = true;
                environment.development = true;
            } else {
                delete environment.development;
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
