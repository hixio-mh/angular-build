import * as fs from 'fs-extra';
import * as path from 'path';

import { AppProjectConfig, ProjectConfig } from '../models';
import { getAoTGenDirSync } from './get-aot-gen-dir';

export function getNodeModuleStartPaths(projectRoot: string, projectConfig: ProjectConfig): string[] {
    const srcDir = path.resolve(projectRoot, projectConfig.srcDir || '');

    // Separate modules from node_modules into a vendor chunk.
    const nodeModulesPath = path.resolve(projectRoot, 'node_modules');
    // Resolves all symlink to get the actual node modules folder.
    const realNodeModules = fs.realpathSync(nodeModulesPath);

    const vendorChunkStartPaths: string[] = [
        nodeModulesPath,
        realNodeModules,
        path.resolve(srcDir, '$$_gendir', 'node_modules'),
        path.resolve(projectRoot, '$$_gendir', 'node_modules'),
        path.resolve(srcDir, 'aot-browser-compiled', 'node_modules'),
        path.resolve(projectRoot, 'aot-browser-compiled', 'node_modules'),
        path.resolve(srcDir, 'browser-aot-compiled', 'node_modules'),
        path.resolve(projectRoot, 'browser-aot-compiled', 'node_modules'),
        path.resolve(srcDir, 'aot-compiled', 'node_modules'),
        path.resolve(projectRoot, 'aot-compiled', 'node_modules')
    ];

    const tsConfigPath = path.resolve(projectRoot,
        projectConfig.srcDir || '',
        projectConfig.tsconfig || 'tsconfig.json');
    const aotGenDirAbs = getAoTGenDirSync(tsConfigPath);
    if (tsConfigPath && aotGenDirAbs) {
        vendorChunkStartPaths.push(path.resolve(aotGenDirAbs, 'node_modules'));
    }
    if ((projectConfig as AppProjectConfig).vendorChunkPaths) {
        const vendorChunkPaths = (projectConfig as AppProjectConfig).vendorChunkPaths as string[];
        vendorChunkPaths.forEach(p => {
            const resolvedPath = path.resolve(srcDir, p);
            if (vendorChunkStartPaths.indexOf(resolvedPath) === -1) {
                vendorChunkStartPaths.push(resolvedPath);
            }
        });
    }

    return vendorChunkStartPaths;
}
