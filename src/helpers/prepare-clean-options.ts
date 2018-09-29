import { CleanOptions } from '../models';
import { AppProjectConfigInternal, LibProjectConfigInternal } from '../models/internals';

export function prepareCleanOptions(projectConfig: AppProjectConfigInternal | LibProjectConfigInternal): CleanOptions {
    let cleanOptions: CleanOptions = {};
    if (typeof projectConfig.clean === 'object') {
        cleanOptions = { ...cleanOptions, ...projectConfig.clean };
    }

    cleanOptions.beforeBuild = (cleanOptions.beforeBuild || {});
    const beforeBuildOption = cleanOptions.beforeBuild;

    let skipCleanOutDir = false;

    if (projectConfig._projectType === 'app') {
        const appConfig = projectConfig as AppProjectConfigInternal;

        if (!appConfig._isDll && appConfig.referenceDll && beforeBuildOption.cleanOutDir) {
            skipCleanOutDir = true;
        }
    } else if (projectConfig._projectType === 'lib') {
        const libConfig = projectConfig as LibProjectConfigInternal;

        if (libConfig._isNestedPackage && beforeBuildOption.cleanOutDir) {
            skipCleanOutDir = true;
        }
    }

    if (skipCleanOutDir) {
        beforeBuildOption.cleanOutDir = false;
    } else if (beforeBuildOption.cleanOutDir == null) {
        beforeBuildOption.cleanOutDir = true;
    }

    if (beforeBuildOption.cleanCache == null) {
        beforeBuildOption.cleanCache = true;
    }

    cleanOptions.beforeBuild = beforeBuildOption;

    return cleanOptions;
}
