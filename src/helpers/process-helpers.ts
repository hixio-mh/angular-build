export function hasProcessFlag(flag: string): boolean {
    return process.argv.join('').indexOf(flag) > -1;
}

export function isWebpackDevServer(): boolean {
    return !!process.argv[1] && !!(/webpack-dev-server/.exec(process.argv[1]));
}

export function hasProdFlag(): boolean {
    const hasFlag =
        (process.env.ASPNETCORE_ENVIRONMENT && process.env.ASPNETCORE_ENVIRONMENT.toLowerCase() === 'production') ||
        (process.env.NODE_ENV &&
            (process.env.NODE_ENV.toLowerCase() === 'prod' ||
                process.env.NODE_ENV.toLowerCase() === 'production')) ||
        process.argv.indexOf('--env.prod') > -1 ||
        process.argv.indexOf('--env.production') > -1 ||
        process.argv.indexOf('--env.Production') > -1 ||
        (process.argv.indexOf('--prod') > -1 && process.argv[process.argv.indexOf('--prod')] !== 'false') ||
        (process.argv.indexOf('--production') > -1 &&
            process.argv[process.argv.indexOf('--production')] !== 'false') ||
        (process.argv.indexOf('--Production') > -1 &&
            process.argv[process.argv.indexOf('--Production')] !== 'false');
    return hasFlag;
}

export function hasDevFlag(): boolean {
    const hasFlag = (process.env.ASPNETCORE_ENVIRONMENT &&
        process.env.ASPNETCORE_ENVIRONMENT.toLowerCase() === 'development') ||
        process.argv.indexOf('--env.dev') > -1 ||
        process.argv.indexOf('--env.development') > -1 ||
        process.argv.indexOf('--env.Development') > -1 ||
        (process.argv.indexOf('--dev') > -1 && process.argv[process.argv.indexOf('--dev')] === 'true') ||
        (process.argv.indexOf('--development') > -1 && process.argv[process.argv.indexOf('--development')] === 'true') ||
        (process.argv.indexOf('--Development') > -1 && process.argv[process.argv.indexOf('--Development')] === 'true') ||
        (process.env.NODE_ENV &&
            (process.env.NODE_ENV.toLowerCase() === 'dev' ||
                process.env.NODE_ENV.toLowerCase() === 'development'));
    return typeof hasFlag === 'undefined' ? false : hasFlag;
}

export function isDllBuildFromNpmEvent(eventName?: string): boolean {
    const lcEvent = process.env.npm_lifecycle_event;
    if (!lcEvent) {
        return false;
    }

    if (eventName) {
        return lcEvent.includes(eventName);
    } else {
        return lcEvent.includes(':dll') ||
            lcEvent.includes('-dll') ||
            lcEvent === 'dll';
    }
}

export function isAoTBuildFromNpmEvent(eventName?: string): boolean {
    const lcEvent = process.env.npm_lifecycle_event;
    if (!lcEvent) {
        return false;
    }

    if (eventName) {
        return lcEvent.includes(eventName);
    } else {
        return lcEvent.includes(':aot') ||
            lcEvent.includes('-aot') ||
            lcEvent === 'aot';
    }
}

export function isUniversalBuildFromNpmEvent(eventName?: string): boolean {
    const lcEvent = process.env.npm_lifecycle_event;
    if (!lcEvent) {
        return false;
    }

    if (eventName) {
        return lcEvent.includes(eventName);
    } else {
        return lcEvent.includes(':universal') ||
            lcEvent.includes('-universal') ||
            lcEvent === 'universal';
    }
}

export function isTestBuildFromNpmEvent(eventName?: string): boolean {
    const lcEvent = process.env.npm_lifecycle_event;
    if (!lcEvent) {
        return false;
    }

    if (eventName) {
        return lcEvent.includes(eventName);
    } else {
        return lcEvent.includes(':test') ||
            lcEvent.includes('-test') ||
            lcEvent === 'test';
    }
}
