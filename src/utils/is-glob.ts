// fork from: https://github.com/micromatch/is-glob
// fork from: https://github.com/micromatch/is-extglob

const chars: { [key: string]: string } = { '{': '}', '(': ')', '[': ']' };

export function isExtglob(str: string): boolean {
    if (typeof str !== 'string' || str === '') {
        return false;
    }

    let match: any;
    while ((match = /(\\).|([@?!+*]\(.*\))/g.exec(str))) {
        if (match[2]) {
            return true;
        }
        str = str.slice(match.index + match[0].length);
    }

    return false;
}

export function isGlob(str: string): boolean {
    if (typeof str !== 'string' || str === '') {
        return false;
    }

    if (isExtglob(str)) {
        return true;
    }

    const regex = /\\(.)|(^!|\*|[\].+)]\?|\[[^\\\]]+\]|\{[^\\}]+\}|\(\?[:!=][^\\)]+\)|\([^|]+\|[^\\)]+\))/;
    let match: any;

    while ((match = regex.exec(str))) {
        if (match[2]) {
            return true;
        }

        let idx = match.index + match[0].length;

        // if an open bracket/brace/paren is escaped,
        // set the index to the next closing character
        const open = match[1];
        const close = open ? chars[open] : null;
        if (open && close) {
            const n = str.indexOf(close as any, idx);
            if (n !== -1) {
                idx = n + 1;
            }
        }

        str = str.slice(idx);
    }

    return false;
}
