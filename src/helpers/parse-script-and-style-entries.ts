// tslint:disable:no-any
// tslint:disable:no-unsafe-any

import { existsSync } from 'fs';
import * as path from 'path';

import { GlobalEntry } from '../interfaces';

import { GlobalParsedEntry } from '../interfaces/internals';

export function parseScriptAndStyleEntries(extraEntries: string | (string | GlobalEntry)[],
    defaultEntry: string,
    workspaceRoot: string,
    nodeModulesPath: string | null | undefined,
    projectRoot: string): GlobalParsedEntry[] {
    if (!extraEntries || !extraEntries.length) {
        return [];
    }

    const entries = Array.isArray(extraEntries) ? extraEntries : [extraEntries];
    const clonedEntries = entries.map((entry: any) =>
        typeof entry === 'object' ? { ...entry } : entry
    );

    return clonedEntries
        .map((extraEntry: string | GlobalEntry) =>
            typeof extraEntry === 'object' ? extraEntry : { input: extraEntry })
        .map((extraEntry: GlobalEntry) => {
            const parsedEntry: GlobalParsedEntry = {
                paths: [],
                entry: '',
                lazy: extraEntry.lazy
            };

            const inputs = Array.isArray(extraEntry.input) ? extraEntry.input : [extraEntry.input];
            parsedEntry.paths = [];
            inputs.forEach(input => {
                let resolvedPath = path.resolve(projectRoot, input);

                if (nodeModulesPath &&
                    !existsSync(resolvedPath) &&
                    input.startsWith('~node_modules') &&
                    existsSync(path.resolve(workspaceRoot, input.substr(1)))) {
                    resolvedPath = path.resolve(workspaceRoot, input.substr(1));
                } else if (nodeModulesPath &&
                    !existsSync(resolvedPath) &&
                    input.startsWith('~') &&
                    existsSync(path.resolve(nodeModulesPath, input.substr(1)))) {
                    resolvedPath = path.resolve(nodeModulesPath, input.substr(1));
                } else if (!existsSync(resolvedPath) &&
                    input.startsWith('~') &&
                    existsSync(path.resolve(workspaceRoot, input.substr(1)))) {
                    resolvedPath = path.resolve(workspaceRoot, input.substr(1));
                }

                parsedEntry.paths.push(resolvedPath);
            });

            if (extraEntry.bundleName) {
                if (/(\\|\/)$/.test(extraEntry.bundleName) &&
                    !Array.isArray(extraEntry.input) &&
                    typeof extraEntry.input === 'string') {
                    parsedEntry.entry = extraEntry.bundleName +
                        path.basename(extraEntry.input)
                            .replace(/\.(ts|js|less|sass|scss|styl|css)$/i, '');
                } else {
                    parsedEntry.entry = extraEntry.bundleName.replace(/\.(js|css)$/i, '');
                }
            } else if (extraEntry.lazy &&
                !Array.isArray(extraEntry.input) &&
                typeof extraEntry.input === 'string') {
                parsedEntry.entry = path.basename(extraEntry.input)
                    .replace(/\.(js|ts|css|scss|sass|less|styl)$/i, '');
            } else {
                parsedEntry.entry = defaultEntry;
            }

            return parsedEntry;
        });
}
