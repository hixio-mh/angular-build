import { CleanOptions } from '../interfaces';
import { AppProjectConfigInternal, LibProjectConfigInternal } from '../interfaces/internals';

export function prepareCleanOptions(projectConfig: AppProjectConfigInternal | LibProjectConfigInternal): CleanOptions {
    let cleanOptions: CleanOptions = {};
    if (typeof projectConfig.clean === 'object') {
        cleanOptions = { ...cleanOptions, ...projectConfig.clean };
    }

    cleanOptions.beforeBuild = (cleanOptions.beforeBuild || {});
    const beforeBuildOption = cleanOptions.beforeBuild;
    if (projectConfig._projectType === 'app') {
        const appConfig = projectConfig as AppProjectConfigInternal;
        const isDll = appConfig._isDll;

        if (beforeBuildOption.cleanOutDir !== false && !appConfig.referenceDll) {
            beforeBuildOption.cleanOutDir = true;
        }

        if (!isDll && appConfig.referenceDll && beforeBuildOption.cleanOutDir) {
            beforeBuildOption.cleanOutDir = false;
        }
    }

    if (beforeBuildOption.cleanOutDir && beforeBuildOption.cleanCache == null) {
        beforeBuildOption.cleanCache = true;
    }

    return cleanOptions;
}
