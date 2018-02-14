import { existsSync } from 'fs';
import * as path from 'path';

import * as ts from 'typescript';

import {
    AngularBuildConfigInternal,
    AppProjectConfig,
    AppProjectConfigInternal,
    InternalError,
    InvalidConfigError,
    LibProjectConfig,
    LibProjectConfigInternal,
    PreDefinedEnvironment,
    ProjectConfigInternal,
    TsTranspilationOptionsInternal
} from '../models';

import { isInFolder, isSamePaths, normalizeRelativePath } from '../utils/path-helpers';

import { isWebpackDevServer } from './is-webpack-dev-server';
import { parseDllEntries } from './parse-dll-entry';
import { parseGlobalEntries } from './parse-global-entry';

export function applyAngularBuildConfigDefaults(angularBuildConfig: AngularBuildConfigInternal): void {
    if (!angularBuildConfig) {
        throw new InternalError(`The 'angularBuildConfig' is required.`);
    }

    angularBuildConfig.apps = angularBuildConfig.apps || [];
    angularBuildConfig.libs = angularBuildConfig.libs || [];

    // extends
    angularBuildConfig.libs = applyProjectConfigExtends(angularBuildConfig.libs);
    angularBuildConfig.apps = applyProjectConfigExtends(angularBuildConfig.apps);

    for (let i = 0; i < angularBuildConfig.libs.length; i++) {
        const libConfig = angularBuildConfig.libs[i];
        (libConfig as ProjectConfigInternal)._index = i;
        (libConfig as ProjectConfigInternal)._projectType = 'lib';
    }

    for (let i = 0; i < angularBuildConfig.apps.length; i++) {
        const appConfig = angularBuildConfig.apps[i];
        (appConfig as ProjectConfigInternal)._index = i;
        (appConfig as ProjectConfigInternal)._projectType = 'app';
    }
}

export function applyProjectConfigWithEnvOverrides(projectConfig: AppProjectConfig | LibProjectConfig,
    env: { [key: string]: boolean | string; } | PreDefinedEnvironment): void {
    if (!env) {
        throw new InternalError(`The 'env' is required.`);
    }

    if (!projectConfig ||
        !projectConfig.envOverrides ||
        Object.keys(projectConfig.envOverrides).length === 0) {
        return;
    }

    const environment = env as PreDefinedEnvironment;

    const buildTargets: string[] = [];
    if (environment.dll) {
        buildTargets.push('dll');
    } else if (environment.aot) {
        buildTargets.push('aot');
        buildTargets.push('prod');
        buildTargets.push('production');
    }

    if (environment.prod || (environment as any).production) {
        if (!buildTargets.includes('prod')) {
            buildTargets.push('prod');
        }
        if (!buildTargets.includes('production')) {
            buildTargets.push('production');
        }
    } else if (environment.dev ||
        (environment as any).development ||
        (!environment.prod && !(environment as any).production)) {
        buildTargets.push('dev');
        buildTargets.push('development');
    }

    if (environment.hot || isWebpackDevServer()) {
        buildTargets.push('hot');
    }

    const preDefinedKeys = ['prod', 'production', 'dev', 'development', 'aot', 'dll', 'hot'];

    Object.keys(environment)
        .filter(key => !preDefinedKeys.includes(key.toLowerCase()) &&
            !buildTargets.includes(key) &&
            (environment as any)[key] &&
            (typeof (environment as any)[key] === 'boolean' || (environment as any)[key] === 'true'))
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

export function applyProjectConfigDefaults(projectRoot: string,
    projectConfig: AppProjectConfigInternal | LibProjectConfigInternal,
    environment: PreDefinedEnvironment): void {

    if (projectConfig.skip) {
        return;
    }

    const srcDir = path.resolve(projectRoot, projectConfig.srcDir || '');
    if (!environment.dll && projectConfig.styles && projectConfig.styles.length > 0) {
        projectConfig._styleParsedEntries = parseGlobalEntries(projectConfig.styles, srcDir, 'styles');
    }

    if (projectConfig._projectType === 'lib') {
        applyLibProjectConfigDefaults(projectRoot, projectConfig as LibProjectConfigInternal);
    } else {
        applyAppProjectConfigDefaults(projectRoot, projectConfig as AppProjectConfigInternal, environment);
    }
}

function applyProjectConfigExtends(projectConfigs: (AppProjectConfig | LibProjectConfig)[]): any[] {
    if (!projectConfigs) {
        return [];
    }

    return projectConfigs.map((projectConfig: (AppProjectConfig | LibProjectConfig)) => {
        const extendName = projectConfig.extends;
        if (!extendName) {
            return projectConfig;
        }

        const baseProject =
            projectConfigs.find((proj: (AppProjectConfig | LibProjectConfig)) => proj.name === extendName);
        if (!baseProject) {
            return projectConfig;
        }

        const cloneBaseProject = JSON.parse(JSON.stringify(baseProject));
        delete cloneBaseProject.name;
        if (cloneBaseProject.extends) {
            delete cloneBaseProject.extends;
        }
        let cloneProjectConfig = JSON.parse(JSON.stringify(projectConfig));
        cloneProjectConfig = Object.assign({}, cloneBaseProject, cloneProjectConfig);
        return cloneProjectConfig;
    });
}

function overrideProjectConfig(oldConfig: any, newConfig: any): void {
    if (!newConfig || !oldConfig || typeof newConfig !== 'object' || Object.keys(newConfig).length === 0) {
        return;
    }

    Object.keys(newConfig).filter((key: string) => key !== 'envOverrides').forEach((key: string) => {
        oldConfig[key] = JSON.parse(JSON.stringify(newConfig[key]));
    });
}

function applyLibProjectConfigDefaults(projectRoot: string, libConfig: LibProjectConfigInternal): void {
    if (libConfig.skip) {
        return;
    }

    const srcDir = path.resolve(projectRoot, libConfig.srcDir || '');
    const outDir = path.resolve(projectRoot, libConfig.outDir);

    if (libConfig.tsTranspilation) {
        const tsTranspilation = libConfig.tsTranspilation as TsTranspilationOptionsInternal;
        tsTranspilation._tsConfigPath = path.resolve(srcDir, tsTranspilation.tsconfig);

        const jsonConfigFile = ts.readConfigFile(tsTranspilation._tsConfigPath, ts.sys.readFile);
        if (jsonConfigFile.error && jsonConfigFile.error.length) {
            const formattedMsg = formatDiagnostics(jsonConfigFile.error);
            if (formattedMsg) {
                throw new InvalidConfigError(formattedMsg);
            }
        }

        // _tsConfigJson
        tsTranspilation._tsConfigJson = jsonConfigFile.config;

        // _tsCompilerConfig
        tsTranspilation._tsCompilerConfig = ts.parseJsonConfigFileContent(tsTranspilation._tsConfigJson,
            ts.sys,
            path.dirname(tsTranspilation._tsConfigPath),
            undefined,
            tsTranspilation._tsConfigPath);
        const compilerOptions = tsTranspilation._tsCompilerConfig.options;

        // _tsOutDir
        let tsOutputPath: string;
        if (!compilerOptions.outDir) {
            tsOutputPath = outDir;
        } else {
            tsOutputPath = path.isAbsolute(compilerOptions.outDir)
                ? path.resolve(compilerOptions.outDir)
                : path.resolve(path.dirname(tsTranspilation._tsConfigPath), compilerOptions.outDir);
        }

        if (compilerOptions.rootDir &&
            !isSamePaths(compilerOptions.rootDir, path.dirname(tsTranspilation._tsConfigPath)) &&
            isInFolder(compilerOptions.rootDir, path.dirname(tsTranspilation._tsConfigPath))) {
            const relSubDir = normalizeRelativePath(
                path.relative(
                    compilerOptions.rootDir,
                    path.dirname(tsTranspilation._tsConfigPath)));
            tsOutputPath = path.resolve(tsOutputPath, relSubDir);
        }
        tsTranspilation._tsOutDir = tsOutputPath;

        // _angularCompilerOptions
        tsTranspilation._angularCompilerOptions = tsTranspilation._tsConfigJson.angularCompilerOptions;
    }
}

function applyAppProjectConfigDefaults(projectRoot: string,
    appConfig: AppProjectConfigInternal,
    environment: PreDefinedEnvironment): void {
    if (appConfig.skip) {
        return;
    }

    if (!appConfig.platformTarget) {
        appConfig.platformTarget = 'web';
    }

    if (!appConfig.platformTarget || appConfig.platformTarget === 'web') {
        appConfig.publicPath = appConfig.publicPath || '/';
    }

    if (appConfig.publicPath) {
        appConfig.publicPath = /\/$/.test(appConfig.publicPath) ? appConfig.publicPath : appConfig.publicPath + '/';
    }

    appConfig.mainEntryChunkName = appConfig.mainEntryChunkName || 'main';
    appConfig.polyfillsChunkName = appConfig.polyfillsChunkName || 'polyfills';
    appConfig.vendorChunkName = appConfig.vendorChunkName || 'vendor';
    appConfig.inlineChunkName = appConfig.inlineChunkName || 'inline';
    appConfig.commonChunkName = appConfig.commonChunkName || 'common';

    if (typeof appConfig.sourceMap === 'undefined') {
        appConfig.sourceMap = !environment.prod || isWebpackDevServer();
    }

    if (typeof appConfig.extractCss === 'undefined') {
        if (!appConfig.platformTarget || appConfig.platformTarget === 'web') {
            appConfig.extractCss = (environment.prod || environment.dll) && !isWebpackDevServer();
        } else {
            appConfig.extractCss = false;
        }
    }

    if (typeof appConfig.bundlesHash === 'undefined') {
        if (!appConfig.platformTarget || appConfig.platformTarget === 'web') {
            if (hasAspAppendVersion(appConfig)) {
                appConfig.bundlesHash = false;
            } else {
                appConfig.bundlesHash = environment.prod && !isWebpackDevServer();
            }
        } else {
            appConfig.bundlesHash = false;
        }
    }

    if (environment.dll) {
        appConfig.referenceDll = false;
        if (appConfig.htmlInject) {
            delete appConfig.htmlInject;
        }
        if (typeof appConfig.environmentVariables !== 'undefined') {
            delete appConfig.environmentVariables;
        }
        if (appConfig.banner) {
            delete appConfig.banner;
        }
    }

    const srcDir = path.resolve(projectRoot, appConfig.srcDir || '');
    const outDir = path.resolve(projectRoot, appConfig.outDir);

    // typescript
    let tsConfigFilePath = path.resolve(srcDir, appConfig.tsconfig || 'tsconfig.json');
    if (existsSync(tsConfigFilePath)) {
        appConfig._tsConfigPath = tsConfigFilePath;
    } else if (!appConfig.tsconfig &&
        appConfig.srcDir &&
        srcDir !== projectRoot &&
        path.resolve(srcDir, '../tsconfig.json') !== tsConfigFilePath) {
        tsConfigFilePath = path.resolve(srcDir, '../tsconfig.json');
        if (existsSync(tsConfigFilePath)) {
            appConfig._tsConfigPath = tsConfigFilePath;
        }
    }
    if (!appConfig._tsConfigPath &&
        !appConfig.tsconfig &&
        path.resolve(projectRoot, 'tsconfig.json') !== tsConfigFilePath) {
        tsConfigFilePath = path.resolve(projectRoot, 'tsconfig.json');
        if (existsSync(tsConfigFilePath)) {
            appConfig._tsConfigPath = tsConfigFilePath;
        }
    }

    if (appConfig._tsConfigPath) {
        const jsonConfigFile = ts.readConfigFile(appConfig._tsConfigPath, ts.sys.readFile);
        if (jsonConfigFile.error && jsonConfigFile.error.length) {
            const formattedMsg = formatDiagnostics(jsonConfigFile.error);
            if (formattedMsg) {
                throw new InvalidConfigError(formattedMsg);
            }
        }

        // _tsConfigJson
        appConfig._tsConfigJson = jsonConfigFile.config;

        // _tsCompilerConfig
        appConfig._tsCompilerConfig = ts.parseJsonConfigFileContent(appConfig._tsConfigJson,
            ts.sys,
            path.dirname(appConfig._tsConfigPath),
            undefined,
            appConfig._tsConfigPath);
        const compilerOptions = appConfig._tsCompilerConfig.options;

        // _tsOutDir
        let tsOutputPath: string;
        if (!compilerOptions.outDir) {
            tsOutputPath = outDir;
        } else {
            tsOutputPath = path.isAbsolute(compilerOptions.outDir)
                ? path.resolve(compilerOptions.outDir)
                : path.resolve(path.dirname(appConfig._tsConfigPath), compilerOptions.outDir);
        }

        if (compilerOptions.rootDir &&
            !isSamePaths(compilerOptions.rootDir, path.dirname(appConfig._tsConfigPath)) &&
            isInFolder(compilerOptions.rootDir, path.dirname(appConfig._tsConfigPath))) {
            const relSubDir = normalizeRelativePath(
                path.relative(
                    compilerOptions.rootDir,
                    path.dirname(appConfig._tsConfigPath)));
            tsOutputPath = path.resolve(tsOutputPath, relSubDir);
        }
        appConfig._tsOutDir = tsOutputPath;

        // _angularCompilerOptions
        appConfig._angularCompilerOptions = appConfig._tsConfigJson.angularCompilerOptions;

        // _ecmaVersion
        if (compilerOptions.target === ts.ScriptTarget.ES2017) {
            appConfig._ecmaVersion = 8;
        } else if (compilerOptions.target === ts.ScriptTarget.ES2016) {
            appConfig._ecmaVersion = 7;
        } else if (compilerOptions.target !== ts.ScriptTarget.ES3 && compilerOptions.target !== ts.ScriptTarget.ES5) {
            appConfig._ecmaVersion = 6;
        }

        // _nodeResolveFields
        let nodeResolveFields: string[] = [];
        if (compilerOptions.target === ts.ScriptTarget.ES2017) {
            nodeResolveFields.push('es2017');
            nodeResolveFields.push('es2016');
            nodeResolveFields.push('es2015');
        } else if (compilerOptions.target === ts.ScriptTarget.ES2016) {
            nodeResolveFields.push('es2016');
            nodeResolveFields.push('es2015');
        } else if (compilerOptions.target !== ts.ScriptTarget.ES3 &&
            compilerOptions.target !== ts.ScriptTarget.ES5) {
            nodeResolveFields.push('es2015');
        }

        if (appConfig.nodeResolveFields && appConfig.nodeResolveFields.length > 0) {
            nodeResolveFields = appConfig.nodeResolveFields;
        } else {
            if (appConfig._projectType === 'app' && (!appConfig.platformTarget || appConfig.platformTarget === 'web')) {
                nodeResolveFields.push('browser');
            }
            const defaultMainFields = ['module', 'main'];
            nodeResolveFields.push(...defaultMainFields);
        }
        appConfig._nodeResolveFields = nodeResolveFields;
    }

    if (appConfig.dll && (environment.dll || appConfig.referenceDll)) {
        appConfig._dllParsedResult = parseDllEntries(srcDir, appConfig.dll);
    }

    if (!environment.dll && appConfig.polyfills && appConfig.polyfills.length > 0) {
        const polyfills = Array.isArray(appConfig.polyfills) ? appConfig.polyfills : [appConfig.polyfills];
        appConfig._polyfillParsedResult = parseDllEntries(srcDir, polyfills);
    }

    if (!environment.dll && appConfig.scripts && appConfig.scripts.length > 0) {
        appConfig._scriptParsedEntries = parseGlobalEntries(appConfig.scripts, srcDir, 'scripts');
    }
}

function hasAspAppendVersion(appConfig: AppProjectConfig): boolean {
    if (appConfig.htmlInject && (appConfig.htmlInject.customAttributes ||
        appConfig.htmlInject.customLinkAttributes ||
        appConfig.htmlInject.customLinkAttributes)) {
        let customAttributes = Object.assign({}, appConfig.htmlInject.customAttributes || {});
        customAttributes = Object.assign({}, customAttributes, appConfig.htmlInject.customLinkAttributes || {});
        customAttributes = Object.assign({}, customAttributes, appConfig.htmlInject.customLinkAttributes || {});
        if (customAttributes['asp-append-version']) {
            return true;
        }
    }
    return false;
}

function formatDiagnostics(diagnostic: ts.Diagnostic | ts.Diagnostic[]): string {
    if (!diagnostic) {
        return '';
    }

    const diags = Array.isArray(diagnostic) ? diagnostic : [diagnostic];
    if (!diags || !diags.length || !diags[0].length) {
        return '';
    }

    return diags
        .map((d) => {
            let res = ts.DiagnosticCategory[d.category];
            if (d.file) {
                res += ` at ${d.file.fileName}:`;
                const { line, character } = d.file.getLineAndCharacterOfPosition(d.start as number);
                res += (line + 1) + ':' + (character + 1) + ':';
            }
            res += ` ${ts.flattenDiagnosticMessageText(d.messageText, '\n')}`;
            return res;
        })
        .join('\n');
}
