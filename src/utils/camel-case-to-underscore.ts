export function camelCaseToUnderscore(s: string): string {
    return s.replace(/(?:^|\.?)([A-Z])/g, (_, y) => `_${y.toLowerCase()}`).replace(/^_/, '');
}
