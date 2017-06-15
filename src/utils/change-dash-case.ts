export function chageDashCase(str: string): string {
    if (!str) {
        return str;
    }
    return str.replace(/([a-zA-Z])(?=[A-Z])/g, '$1-').toLowerCase();
    // return str.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
    // return this.replace(/([A-Z])/g, function($1){return "-"+$1.toLowerCase();});
}
