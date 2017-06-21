import * as path from 'path';
import * as fs from 'fs';
import { AngularBuildConfig, AppProjectConfig, BuildOptions, LibProjectConfig, ProjectConfig } from '../models';

import { isDllBuildFromNpmEvent, isAoTBuildFromNpmEvent, hasProdFlag, hasDevFlag, isUniversalBuildFromNpmEvent,
    isWebpackDevServer, hasProcessFlag } from './process-helpers';

export const reserviedEnvNames = [
    'app', 'lib', 'project', 'buildOptions', 'baseHref', 'deployUrl', 'publicPath', 'hot', 'devSever'
];

export function prepareBuildOptions(buildOptions: BuildOptions): void {
    if (!buildOptions) {
        throw new Error(`The 'buildOptions' is required.`);
    }

    mergeBuildOptionsWithDefaults(buildOptions);
}

export function prepareAngularBuildConfig(projectRoot: string,
    angularBuildConfig: AngularBuildConfig,
    buildOptions: BuildOptions): void {
    if (!projectRoot) {
        throw new Error(`The 'projectRoot' is required.`);
    }
    if (!angularBuildConfig) {
        throw new Error(`The 'angularBuildConfig' is required.`);
    }
    if (!buildOptions) {
        throw new Error(`The 'buildOptions' is required.`);
    }

    angularBuildConfig.apps = angularBuildConfig.apps || [];
    angularBuildConfig.libs = angularBuildConfig.libs || [];

    // extends
    angularBuildConfig.libs = applyProjectConfigExtends(angularBuildConfig.libs);
    angularBuildConfig.apps = applyProjectConfigExtends(angularBuildConfig.apps);

    angularBuildConfig.libs.forEach((libConfig: LibProjectConfig) => {
        mergeProjectConfigWithEnvOverrides(libConfig, buildOptions);
        mergeProjectConfigWithDefaults(projectRoot, libConfig, buildOptions);
        mergeLibConfigWithDefaults(projectRoot, libConfig);
    });

    angularBuildConfig.apps.forEach((appConfig: AppProjectConfig) => {
        mergeProjectConfigWithEnvOverrides(appConfig, buildOptions);
        mergeProjectConfigWithDefaults(projectRoot, appConfig, buildOptions);
        mergeAppConfigWithDefaults(projectRoot, appConfig, buildOptions);
    });
}

export function mergeProjectConfigWithEnvOverrides(projectConfig: AppProjectConfig | LibProjectConfig, buildOptions: BuildOptions): void {
    if (!projectConfig || !projectConfig.envOverrides || Object.keys(projectConfig.envOverrides).length === 0) {
        return;
    }
    const environment = buildOptions.environment || {};

    const buildTargets: string[] = [];
    if (environment.test) {
        buildTargets.push('test');
    } else {
        if (buildOptions.production || environment.prod || environment.production) {
            buildTargets.push('prod');
            buildTargets.push('production');
        } else if (!buildOptions.production || environment.dev || environment.development) {
            buildTargets.push('dev');
            buildTargets.push('development');
        }

        if (environment.dll) {
            buildTargets.push('dll');
        } else if (environment.aot) {
            buildTargets.push('aot');
        }
    }

    Object.keys(environment)
        .filter(key => reserviedEnvNames.indexOf(key) === -1 &&
            buildTargets.indexOf(key) === -1 &&
            environment[key] &&
            (typeof environment[key] === 'boolean' || environment[key] === 'true'))
        .forEach(key => {
            buildTargets.push(key);
        });

    Object.keys(projectConfig.envOverrides).forEach((buildTargetKey: string) => {
        const targetName = buildTargetKey;
        const targets = targetName.split(',');
        targets.forEach(t => {
            t = t.trim();
            if (buildTargets.indexOf(t) > -1) {
                const newConfig = (projectConfig.envOverrides as any)[t];
                if (newConfig && typeof newConfig === 'object') {
                    overrideProjectConfig(projectConfig, newConfig);
                }
            }
        });
    });
}

function applyProjectConfigExtends(projectConfigs: ProjectConfig[]): ProjectConfig[] {
    if (!projectConfigs) {
        return [];
    }

    return projectConfigs.map((projectConfig: ProjectConfig) => {
        const extendName = projectConfig.extends;
        if (extendName) {
            const baseProject = projectConfigs.find((app: ProjectConfig) => app.name === extendName);
            if (baseProject) {
                const cloneBaseProject = JSON.parse(JSON.stringify(baseProject));
                delete cloneBaseProject.name;
                if (cloneBaseProject.extends) {
                    delete cloneBaseProject.extends;
                }
                let cloneProjectConfig = JSON.parse(JSON.stringify(projectConfig));
                cloneProjectConfig = Object.assign({}, cloneBaseProject, cloneProjectConfig);
                return cloneProjectConfig;
            }
        }
        return projectConfig;
    });
}

function mergeBuildOptionsWithDefaults(buildOptions: BuildOptions): BuildOptions {
    if (Array.isArray(buildOptions.environment)) {
        const envObj: any = {};
        buildOptions.environment.forEach((s: string) => envObj[s] = true);
        buildOptions.environment = envObj;
    } else if (typeof (buildOptions.environment as any) === 'string') {
        const envObj: any = {};
        const key = (buildOptions.environment as any) as string;
        envObj[key] = true;
        buildOptions.environment = envObj;
    }
    const environment = buildOptions.environment || {};

    if (environment.buildOptions && typeof environment.buildOptions === 'object') {
        buildOptions = Object.assign(buildOptions, environment.buildOptions);
        delete environment.buildOptions;
    }
    if (environment.app &&
        (typeof environment.app === 'string' || Array.isArray(environment.app))) {
        buildOptions.filter = environment.app as any;
        delete environment.app;
    }
    if (environment.lib &&
        (typeof environment.lib === 'string' || Array.isArray(environment.lib))) {
        buildOptions.filter = environment.lib as any;
        delete environment.lib;
    }
    if (environment.project &&
        (typeof environment.project === 'string' || Array.isArray(environment.project))) {
        buildOptions.filter = environment.project as any;
        delete environment.project;
    }

    Object.keys(environment).forEach((key: string) => {
        if (typeof environment[key] === 'string' &&
            (environment[key] as string).toLowerCase() === 'true') {
            environment[key] = true;
        } else if (typeof environment[key] === 'string' &&
            (environment[key] as string).toLowerCase() === 'false') {
            environment[key] = true;
        }
    });

    if (typeof buildOptions.verbose === 'undefined') {
        buildOptions.verbose = process.argv.indexOf('--verbose') > -1;
    }

    // dll
    if (typeof (environment.dll) !== 'undefined') {
        const dll = !!(environment.dll as any);
        if (dll) {
            environment.dll = true;
        } else {
            delete environment.dll;
        }
    } else {
        const dll = isDllBuildFromNpmEvent() || process.argv.indexOf('--dll') > -1;
        if (dll) {
            environment.dll = true;
        }
    }

    // aot
    if (typeof (environment.aot) !== 'undefined') {
        const aot = !!(environment.aot as any);
        if (aot) {
            environment.aot = true;
        } else {
            delete environment.aot;
        }
    } else {
        const aot = isAoTBuildFromNpmEvent() || process.argv.indexOf('--aot') > -1;
        if (aot) {
            environment.aot = true;
        }
    }

    // prod
    if (typeof buildOptions.production !== 'undefined') {
        environment.prod = !!(buildOptions.production as any);
    } else if (typeof environment.prod !== 'undefined') {
        const prod = !!(environment.prod as any);
        buildOptions.production = prod;
        if (prod) {
            environment.prod = true;
        } else {
            delete environment.prod;
        }
    } else if (typeof environment.production !== 'undefined') {
        const prod = !!(environment.production as any);
        buildOptions.production = prod;
        if (prod) {
            environment.prod = true;
        } else {
            delete environment.production;
        }
    } else {
        const production = hasProdFlag() ||
            (!hasDevFlag() &&
                !(environment.dev || environment.development) &&
                (isAoTBuildFromNpmEvent() ||
                    process.argv.indexOf('--aot') > -1 ||
                    isUniversalBuildFromNpmEvent() ||
                    process.argv.indexOf('--universal') > -1));
        if (production) {
            buildOptions.production = true;
            environment.prod = true;
        }
    }

    // dev
    if (typeof environment.dev !== 'undefined' &&
        (buildOptions.production || !environment.dev)) {
        delete environment.dev;
    }
    if (typeof environment.development !== 'undefined' &&
        (buildOptions.production || !environment.development)) {
        delete environment.development;
    }
    if (environment.development) {
        environment.dev = true;
        delete environment.development;
    }
    if (environment.dev) {
        environment.dev = true;
    }
    if (!buildOptions.production &&
        !environment.test &&
        typeof environment.dev === 'undefined') {
        environment.dev = true;
    }

    // devServer
    if (isWebpackDevServer() || environment.devServer) {
        environment.devServer = true;
    }

    // hmr
    if (hasProcessFlag('hot') || environment.hot || environment.hmr) {
        environment.hot = true;
        if (environment.hmr) {
            delete environment.hmr;
        }
    }

    // Reset aot = false
    if (environment.dll && environment.aot) {
        environment.aot = false;
    }

    buildOptions.environment = environment;
    return buildOptions;
}

function overrideProjectConfig(oldConfig: any, newConfig: any): void {
    if (!newConfig || !oldConfig || typeof newConfig !== 'object' || Object.keys(newConfig).length === 0) {
        return;
    }

    Object.keys(newConfig).filter((key: string) => key !== 'envOverrides').forEach((key: string) => {
        if (typeof newConfig[key] === 'object') {
            oldConfig[key] = JSON.parse(JSON.stringify(newConfig[key]));
        } else {
            oldConfig[key] = newConfig[key];
        }
    });
}

function mergeProjectConfigWithDefaults(projectRoot: string,
    projectConfig: ProjectConfig,
    buildOptions: BuildOptions): void {
    if (!projectConfig.srcDir &&
        projectConfig.entry &&
        fs.existsSync(path.resolve(projectRoot, projectConfig.entry)) &&
        fs.existsSync(path.resolve(projectRoot, path.dirname(projectConfig.entry)))) {
        const tempSrcDir = path.relative(projectRoot, path.dirname(projectConfig.entry));
        projectConfig.srcDir = tempSrcDir.replace(/\\/, '/');
    }
    projectConfig.srcDir = projectConfig.srcDir || '';
    if (projectConfig.srcDir && !path.isAbsolute(projectConfig.srcDir)) {
        projectConfig.srcDir = projectConfig.srcDir.replace(/\\/g, '/');
    }
    // remove ending slash
    while (projectConfig.srcDir && projectConfig.srcDir.endsWith('/')) {
        projectConfig.srcDir = projectConfig.srcDir.substr(0, projectConfig.srcDir.length - 1);
    }

    if (!projectConfig.outDir) {
        if (projectConfig.srcDir &&
            !path.isAbsolute(projectConfig.srcDir) &&
            projectConfig.srcDir.indexOf('/') > 0 &&
            projectConfig.srcDir.indexOf('/') + 1 < projectConfig.srcDir.length) {
            const srcSubDir = projectConfig.srcDir.substr(projectConfig.srcDir.indexOf('/') + 1);
            projectConfig.outDir = `dist/${srcSubDir}`;
        } else {
            projectConfig.outDir = 'dist';
        }
    }
    if (projectConfig.outDir && !path.isAbsolute(projectConfig.outDir)) {
        projectConfig.outDir = projectConfig.outDir.replace(/\\/g, '/');
    }
    // remove ending slash
    while (projectConfig.outDir && projectConfig.outDir.endsWith('/')) {
        projectConfig.outDir = projectConfig.outDir.substr(0, projectConfig.outDir.length - 1);
    }


    projectConfig.assets = projectConfig.assets || ([] as string[]);
    projectConfig.styles = projectConfig.styles || ([] as string[]);

    if (typeof projectConfig.sourceMap === 'undefined') {
        if (projectConfig.platformTarget === 'web') {
            projectConfig.sourceMap = !buildOptions.production;
        } else {
            projectConfig.sourceMap = true;
        }
    }
}

function mergeAppConfigWithDefaults(projectRoot: string,
    appConfig: AppProjectConfig,
    buildOptions: BuildOptions): void {
    appConfig.projectType = 'app';

    appConfig.scripts = appConfig.scripts || ([] as string[]);

    appConfig.platformTarget = appConfig.platformTarget || 'web';
    if (appConfig.platformTarget === 'web') {
        appConfig.publicPath = appConfig.publicPath ||
            (appConfig as any).deployUrl ||
            (buildOptions as any).publicPath ||
            (buildOptions as any).deployUrl ||
            '/';
        appConfig.baseHref = appConfig.baseHref || (buildOptions as any).baseHref;
    }

    if (appConfig.publicPath) {
        appConfig.publicPath = /\/$/.test(appConfig.publicPath) ? appConfig.publicPath : appConfig.publicPath + '/';
    }

    appConfig.polyfills = appConfig.polyfills || ([] as string[]);
    appConfig.vendorChunkName = appConfig.vendorChunkName || 'vendor';
    appConfig.polyfillsChunkName = appConfig.polyfillsChunkName || 'polyfills';
    appConfig.inlineChunkName = appConfig.inlineChunkName || 'inline';

    appConfig.htmlInjectOptions = appConfig.htmlInjectOptions || {};

    const environment = buildOptions.environment || {};

    if ((typeof appConfig.referenceDll === 'undefined') &&
        !environment.test) {
        appConfig.referenceDll = !buildOptions.production &&
            !environment.aot &&
            !environment.dll &&
            environment.dev &&
            appConfig.dlls &&
            appConfig.dlls.length > 0;
    }

    if (appConfig.referenceDll && environment.aot) {
        appConfig.referenceDll = false;
    }

    if (typeof appConfig.extractCss === 'undefined') {
        if (!environment.test && !environment.dll) {
            if (!appConfig.platformTarget || appConfig.platformTarget === 'web') {
                appConfig.extractCss = buildOptions.production;
            } else {
                appConfig.extractCss = false;
            }
        } else {
            appConfig.extractCss = false;
        }
    }

    if (typeof appConfig.appendOutputHash === 'undefined') {
        if (!environment.test) {
            if (!appConfig.platformTarget || appConfig.platformTarget === 'web') {
                // is asp.net
                if (appConfig.htmlInjectOptions &&
                    appConfig.htmlInjectOptions.customTagAttributes &&
                    appConfig.htmlInjectOptions.customTagAttributes
                    .find(c => (c.tagName === 'link' || c.tagName === 'script') &&
                        c.attribute &&
                        c.attribute['asp-append-version'] === true)) {
                    appConfig.appendOutputHash = false;
                } else {
                    appConfig.appendOutputHash = buildOptions.production;
                }
            } else {
                appConfig.appendOutputHash = false;
            }
        } else {
            appConfig.appendOutputHash = false;
        }
    }
}

function mergeLibConfigWithDefaults(projectRoot: string,
    libConfig: LibProjectConfig): void {
    libConfig.projectType = 'lib';
    if (typeof libConfig.includeAngularAndRxJsExternals === 'undefined') {
        libConfig.includeAngularAndRxJsExternals = true;
    }
    if (typeof libConfig.bundleTool === 'undefined') {
        libConfig.bundleTool = 'rollup';
    }
}
