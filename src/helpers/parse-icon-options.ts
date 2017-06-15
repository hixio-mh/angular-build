import * as path from 'path';
import * as fs from 'fs';

import { AppProjectConfig } from '../models';
import { readJsonSync } from '../utils';
import { IconPluginOptions } from '../plugins/icon-webpack-plugin';


export function parseIconOptions(projectRoot: string, appConfig: AppProjectConfig): IconPluginOptions | undefined {
    const appRoot = path.resolve(projectRoot, appConfig.srcDir);
    const hashFormat = appConfig.appendOutputHash ? `-[hash` : '';

    let iconOptions: IconPluginOptions | undefined = undefined;

    if (appConfig.faviconConfig) {
        const testFaviconConfig = appConfig.faviconConfig;
        let iconConfigPath = path.resolve(appRoot, testFaviconConfig);
        if (!fs.existsSync(iconConfigPath)) {
            iconConfigPath = path.resolve(projectRoot, testFaviconConfig);
        }
        if (fs.existsSync(iconConfigPath)) {
            if (testFaviconConfig !== appConfig.faviconConfig) {
                appConfig.faviconConfig = testFaviconConfig;
            }
            iconOptions = readJsonSync(iconConfigPath);
        }
    }

    if (!iconOptions || !iconOptions.masterPicture) {
        return undefined;
    }

    iconOptions.masterPicture = path.resolve(appRoot, iconOptions.masterPicture);
    if (!fs.existsSync(iconOptions.masterPicture) &&
        fs.existsSync(path.resolve(projectRoot, iconOptions.masterPicture))) {
        iconOptions.masterPicture = path.resolve(projectRoot, iconOptions.masterPicture);
    }

    if (!fs.existsSync(iconOptions.masterPicture)) {
        throw new Error(`Icon not found at ${iconOptions.masterPicture}`);
    }

    if (!iconOptions.iconsPath) {
        iconOptions.iconsPath = `icons${hashFormat}/`;
    }
    if (!iconOptions.statsFilename) {
        iconOptions.statsFilename = 'iconstats.json';
    }
    if (typeof iconOptions.emitStats === 'undefined') {
        iconOptions.emitStats = false;
    }

    return iconOptions;
}
