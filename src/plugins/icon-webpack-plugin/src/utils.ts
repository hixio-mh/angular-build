import * as path from 'path';
import * as fs from 'fs';

export function stripComments(content: string): string {
    /**
     * First capturing group matches double quoted string
     * Second matches single quotes string
     * Third matches block comments
     * Fourth matches line comments
     */
    const regexp: RegExp = /("(?:[^\\\"]*(?:\\.)?)*")|('(?:[^\\\']*(?:\\.)?)*')|(\/\*(?:\r?\n|.)*?\*\/)|(\/{2,}.*?(?:(?:\r?\n)|$))/g;
    let result = content.replace(regexp, (match, m1, m2, m3, m4) => {
        // Only one of m1, m2, m3, m4 matches
        if (m3) {
            // A block comment. Replace with nothing
            return "";
        } else if (m4) {
            // A line comment. If it ends in \r?\n then keep it.
            let length = m4.length;
            if (length > 2 && m4[length - 1] === "\n") {
                return m4[length - 2] === "\r" ? "\r\n" : "\n";
            } else {
                return "";
            }
        } else {
            // We match a string
            return match;
        }
    });
    return result;
};

export function readJsonSync(filePath: string) {
    const context = stripComments(fs.readFileSync(filePath).toString().replace(/^\uFEFF/, ''));
    return JSON.parse(context);
}

export function guessAppName(baseDir: string): string {
    let projectJson = path.resolve(baseDir, 'project.json');
    if (!fs.existsSync(projectJson)) {
        projectJson = path.resolve(baseDir, '../project.json');
    }
    if (fs.existsSync(projectJson)) {
        const title = readJsonSync(projectJson).title;
        if (title && title.length) {
            return title;
        }
    }

    let packageJson = path.resolve(baseDir, 'package.json');
    if (!fs.existsSync(packageJson)) {
        packageJson = path.resolve(baseDir, '../package.json');
    }

    if (fs.existsSync(packageJson)) {
        return readJsonSync(packageJson).name;
    }

    return null;
}