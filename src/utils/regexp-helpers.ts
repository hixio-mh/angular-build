export function getStringOrRegExp(str: string): RegExp | string {
    if (!str || !str.length || str.length < 3 || !str.startsWith('/') || !str.endsWith('/')) {
        return str;
    }

    const pattern = str.substr(1, str.length - 2);
    return new RegExp(pattern, 'gi');
}
