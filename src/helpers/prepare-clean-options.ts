import { CleanOptions } from '../interfaces';
import { AppProjectConfigInternal, LibProjectConfigInternal } from '../interfaces/internals';

export function prepareCleanOptions(projectConfig: AppProjectConfigInternal | LibProjectConfigInternal): CleanOptions {
    let cleanOptions: CleanOptions = {};
    if (typeof projectConfig.clean === 'object') {
        cleanOptions = { ...cleanOptions, ...projectConfig.clean };
    }

    cleanOptions.beforeBuild = (cleanOptions.beforeBuild || {});
    const beforeBuildOption = cleanOptions.beforeBuild;

    if (beforeBuildOption.cleanOutDir !== false) {
        beforeBuildOption.cleanOutDir = true;
    }

    if (projectConfig._projectType === 'app') {
        const appConfig = projectConfig as AppProjectConfigInternal;
        const isDll = appConfig._isDll;

        if (!isDll && appConfig.referenceDll && beforeBuildOption.cleanOutDir) {
            beforeBuildOption.cleanOutDir = false;
        }
    }

    if (beforeBuildOption.cleanOutDir && beforeBuildOption.cleanCache == null) {
        beforeBuildOption.cleanCache = true;
    }

    cleanOptions.beforeBuild = beforeBuildOption;

    return cleanOptions;
}
