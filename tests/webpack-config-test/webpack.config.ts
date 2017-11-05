// require("tsconfig-paths").register();
import * as path from 'path';
import { getWebpackConfigStandalone } from '../../src';

export default function (env: any, argv: any): any {
    return getWebpackConfigStandalone(path.resolve(__dirname, 'angular-build.json'), env, argv);
}
