export type YargType = 'array' | 'boolean' | 'count' | 'number' | 'string';

export function yargsTypeMap(typeStr: string): YargType | undefined {
    switch (typeStr) {
    case 'boolean':
        return 'boolean';
    case 'number':
    case 'integer':
        return 'number';
    case 'string':
        return 'string';
    default:
        return undefined;
    }
}
