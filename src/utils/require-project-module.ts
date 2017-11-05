import * as resolve from 'resolve';

// require dependencies within the target project
export function requireProjectModule(root: string, moduleName: string): any {
    return require(resolve.sync(moduleName, { basedir: root }));
}
