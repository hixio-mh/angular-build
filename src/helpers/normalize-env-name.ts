export function normalizeEnvName(envName: string): string | undefined {
    if (!envName) {
        return envName;
    }
    const envLower = envName.toLowerCase();
    switch (envLower) {
    case 'prod':
    case 'production':
        return 'prod';
    case 'dev':
    case 'development':
        return 'dev';
    case 'lib':
    case 'library':
        return 'lib';
    case 'app':
    case 'application':
        return 'app';
    case 'dll':
        return 'dll';
    case 'aot':
        return 'aot';
    case 'universal':
        return 'universal';
    case 'devserver':
        return 'devServer';
    case 'hmr':
    case 'hot':
        return 'hmr';
    default:
        return envName;
    }
}
