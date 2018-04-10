import { existsSync } from 'fs';
import * as path from 'path';

import { AngularBuildContext } from '../build-context';

export function resolveLoaderPath(loader: string): string {
    let loaderPath = loader;
    let resolved = false;

    if (AngularBuildContext.nodeModulesPath) {
        const tempPath = path.resolve(AngularBuildContext.nodeModulesPath, loader);
        if (existsSync(tempPath)) {
            loaderPath = tempPath;
            resolved = true;
        }
    }

    if (!resolved && AngularBuildContext.fromAngularBuildCli) {
        if (AngularBuildContext.cliRootPath) {
            const tempPath = path.resolve(AngularBuildContext.cliRootPath, 'node_modules', loader);
            if (existsSync(tempPath)) {
                loaderPath = tempPath;
                resolved = true;
            }
        }

        if (!resolved && AngularBuildContext.nodeModulesPath) {
            const tempPath = path.resolve(AngularBuildContext.nodeModulesPath,
                '@bizappframework/angular-build/node_modules', loader);
            if (existsSync(tempPath)) {
                loaderPath = tempPath;
                resolved = true;
            }
        }

        if (!resolved) {
            const tempPath = require.resolve(loader);
            if (existsSync(tempPath)) {
                loaderPath = tempPath;
            }
        }
    }

    return loaderPath;
}
