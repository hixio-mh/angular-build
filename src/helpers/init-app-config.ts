// tslint:disable:no-any
// tslint:disable:no-unsafe-any

import * as path from 'path';

import { ScriptTarget } from 'typescript';

import { AppProjectConfigInternal, BuildOptionInternal } from '../interfaces/internals';

import { InternalError, InvalidOptionError } from '../error-models';
import { findUpSync } from '../utils';

import { getEcmaVersionFromScriptTarget } from './get-ecma-version-from-script-target';
import { getnodeResolveFieldsFromScriptTarget } from './get-node-resolve-fields-from-script-target';
import { loadTsConfig } from './load-ts-config';
import { parsePolyfillAndDllEntries } from './parse-polyfill-and-dll-entries';
import { parseScriptAndStyleEntries } from './parse-script-and-style-entries';

// tslint:disable-next-line:max-func-body-length
export function initAppConfig(appConfig: AppProjectConfigInternal, buildOptions: BuildOptionInternal): void {
    applyAppProjectConfigDefaults(appConfig, buildOptions);

    if (!appConfig._workspaceRoot) {
        throw new InternalError("The 'appConfig._workspaceRoot' is not set.");
    }

    if (!appConfig._projectRoot) {
        throw new InternalError("The 'appConfig._projectRoot' is not set.");
    }

    if (!appConfig._outputPath) {
        throw new InternalError("The 'appConfig._outputPath' is not set.");
    }

    const workspaceRoot = appConfig._workspaceRoot;
    const nodeModulesPath = appConfig._nodeModulesPath;
    const projectRoot = appConfig._projectRoot;

    if (appConfig.buildOptimizer && !appConfig.aot) {
        throw new InvalidOptionError('The `buildOptimizer` option cannot be used without `aot`.');
    }

    // tsConfig
    if (appConfig.tsConfig) {
        appConfig._tsConfigPath = path.resolve(projectRoot, appConfig.tsConfig);
    } else {
        const tsconfigFiles = ['tsconfing.app.json', 'tsconfing-app.json'];
        if (appConfig.platformTarget === 'node') {
            tsconfigFiles.push('tsconfig.server.json');
            tsconfigFiles.push('tsconfig-server.json');
        } else {
            tsconfigFiles.push('tsconfig.browser.json');
            tsconfigFiles.push('tsconfig-browser.json');
        }

        const foundTsConfigFilePath =
            findUpSync(tsconfigFiles, projectRoot, workspaceRoot);
        if (foundTsConfigFilePath) {
            appConfig._tsConfigPath = foundTsConfigFilePath;
        }
    }

    if (appConfig._tsConfigPath) {
        loadTsConfig(appConfig._tsConfigPath, appConfig, appConfig);

        if (!appConfig._tsCompilerConfig) {
            throw new InternalError("The 'appConfig._tsCompilerConfig' is not set.");
        }

        const compilerOptions = appConfig._tsCompilerConfig.options;

        // script target
        appConfig._supportES2015 = compilerOptions.target !== ScriptTarget.ES3 &&
            compilerOptions.target !== ScriptTarget.ES5;

        // _ecmaVersion
        const ecmaVersion = getEcmaVersionFromScriptTarget(compilerOptions.target);
        if (ecmaVersion) {
            appConfig._ecmaVersion = ecmaVersion;
        }

        // _nodeResolveFields
        let nodeResolveFields = getnodeResolveFieldsFromScriptTarget(compilerOptions.target);

        if (appConfig.nodeResolveFields &&
            Array.isArray(appConfig.nodeResolveFields) &&
            appConfig.nodeResolveFields.length > 0) {
            nodeResolveFields = appConfig.nodeResolveFields;
        } else {
            if (appConfig._projectType === 'app' &&
                (!appConfig.platformTarget || appConfig.platformTarget === 'web')) {
                nodeResolveFields.push('browser');
            }
            const defaultMainFields = ['module', 'main'];
            nodeResolveFields.push(...defaultMainFields);
        }

        appConfig._nodeResolveFields = nodeResolveFields;
    }

    // output hashing
    if (typeof (appConfig.outputHashing as any) === 'string') {
        const outputHashing = (appConfig.outputHashing as any) as string;
        if (outputHashing === 'all') {
            const objConfig = {
                bundles: true,
                chunks: true,
                extractedAssets: true
            };

            appConfig.outputHashing = objConfig;
            appConfig._outputHashing = objConfig;
        } else if (outputHashing === 'bundles') {
            const objConfig = {
                bundles: true,
                chunks: true
            };

            appConfig.outputHashing = objConfig;
            appConfig._outputHashing = objConfig;
        } else if (outputHashing === 'media') {
            const objConfig = {
                extractedAssets: true
            };

            appConfig.outputHashing = objConfig;
            appConfig._outputHashing = objConfig;
        } else if (outputHashing === 'none') {
            const objConfig = {
                bundles: false,
                chunks: false,
                extractedAssets: false
            };

            appConfig.outputHashing = objConfig;
            appConfig._outputHashing = objConfig;
        }
    }

    if (appConfig.outputHashing == null) {
        if (!appConfig.platformTarget || appConfig.platformTarget === 'web') {
            if (hasAspAppendVersion(appConfig)) {
                const objConfig = {
                    bundles: false,
                    chunks: false,
                    extractedAssets: appConfig.optimization || buildOptions.environment.prod ? true : false
                };

                appConfig.outputHashing = objConfig;
                appConfig._outputHashing = objConfig;
            } else {
                const shouldHash = appConfig.optimization || buildOptions.environment.prod ? true : false;
                const objConfig = {
                    bundles: shouldHash,
                    chunks: shouldHash,
                    extractedAssets: shouldHash
                };

                appConfig.outputHashing = objConfig;
                appConfig._outputHashing = objConfig;
            }
        }
    }

    // dlls
    if (appConfig.vendors && (appConfig._isDll || appConfig.referenceDll)) {
        appConfig._dllParsedResult = parsePolyfillAndDllEntries(appConfig.vendors, true, projectRoot);
    }

    // polyfills
    if (!appConfig._isDll && appConfig.polyfills && appConfig.polyfills.length > 0) {
        const polyfills = Array.isArray(appConfig.polyfills) ? appConfig.polyfills : [appConfig.polyfills];
        appConfig._polyfillParsedResult = parsePolyfillAndDllEntries(polyfills, false, projectRoot);
    }

    // styles
    if (!appConfig._isDll && appConfig.styles && Array.isArray(appConfig.styles) && appConfig.styles.length > 0) {
        appConfig._styleParsedEntries =
            parseScriptAndStyleEntries(
                appConfig.styles,
                'styles',
                workspaceRoot,
                nodeModulesPath,
                projectRoot);
    }

    // scripts
    if (!appConfig._isDll &&
        appConfig.scripts &&
        Array.isArray(appConfig.scripts) &&
        appConfig.scripts.length > 0) {
        appConfig._scriptParsedEntries =
            parseScriptAndStyleEntries(
                appConfig.scripts,
                'scripts',
                workspaceRoot,
                nodeModulesPath,
                projectRoot);
    }
}

// tslint:disable:max-func-body-length
function applyAppProjectConfigDefaults(appConfig: AppProjectConfigInternal, buildOptions: BuildOptionInternal): void {
    if (appConfig.skip) {
        return;
    }

    const environment = buildOptions.environment;

    if (appConfig.optimization == null && (environment.prod || environment.production)) {
        appConfig.optimization = true;
    }

    if (!appConfig.platformTarget) {
        appConfig.platformTarget = 'web';
    }

    if (appConfig.publicPath == null) {
        if (!appConfig.platformTarget || appConfig.platformTarget === 'web') {
            appConfig.publicPath = '/';
        }
    }

    if (appConfig.publicPath) {
        appConfig.publicPath = /\/$/.test(appConfig.publicPath) ? appConfig.publicPath : `${appConfig.publicPath}/`;
    }

    if (appConfig.concatenateModules == null &&
        appConfig.platformTarget !== 'node' &&
        appConfig.optimization &&
        !appConfig._isDll) {
        appConfig.concatenateModules = true;
    }

    if (appConfig.aot == null &&
        appConfig.optimization &&
        !appConfig.referenceDll &&
        !appConfig._isDll) {
        appConfig.aot = true;
    }

    if (appConfig.buildOptimizer == null &&
        appConfig.aot &&
        appConfig.platformTarget !== 'node' &&
        appConfig.optimization &&
        !appConfig._isDll) {
        appConfig.buildOptimizer = true;
    }

    appConfig.mainChunkName = appConfig.mainChunkName || 'main';
    appConfig.polyfillsChunkName = appConfig.polyfillsChunkName || 'polyfills';
    appConfig.vendorChunkName = appConfig.vendorChunkName || 'vendor';

    if (appConfig.vendorChunk == null &&
        appConfig.platformTarget !== 'node' &&
        !appConfig.optimization &&
        !appConfig.referenceDll &&
        !appConfig._isDll) {
        appConfig.vendorChunk = true;
    }

    if (appConfig.sourceMap == null && !appConfig.optimization) {
        appConfig.sourceMap = true;
    }

    if (appConfig.extractCss == null) {
        if (!appConfig.platformTarget || appConfig.platformTarget === 'web') {
            if (appConfig.optimization || appConfig._isDll) {
                appConfig.extractCss = true;
            }
        } else {
            appConfig.extractCss = false;
        }
    }

    if (appConfig.extractLicenses == null) {
        if (!appConfig.platformTarget || appConfig.platformTarget === 'web') {
            if (appConfig.optimization || appConfig._isDll) {
                appConfig.extractLicenses = true;
            }
        } else {
            appConfig.extractLicenses = false;
        }
    }

    if (appConfig.namedChunks == null) {
        appConfig.namedChunks = !appConfig.optimization;
    }

    if (appConfig._isDll) {
        if (appConfig.referenceDll) {
            appConfig.referenceDll = false;
        }
        if (appConfig.aot) {
            appConfig.aot = false;
        }
        if (appConfig.buildOptimizer) {
            appConfig.buildOptimizer = false;
        }
        if (appConfig.htmlInject) {
            delete appConfig.htmlInject;
        }
        if (appConfig.environmentVariables != null) {
            delete appConfig.environmentVariables;
        }
        if (appConfig.banner) {
            delete appConfig.banner;
        }
    }
}

function hasAspAppendVersion(appConfig: AppProjectConfigInternal): boolean {
    if (appConfig.htmlInject && (appConfig.htmlInject.customAttributes ||
        appConfig.htmlInject.customLinkAttributes ||
        appConfig.htmlInject.customLinkAttributes)) {
        let customAttributes = { ...(appConfig.htmlInject.customAttributes || {}) };
        customAttributes = { ...customAttributes, ...(appConfig.htmlInject.customLinkAttributes || {}) };
        customAttributes = { ...customAttributes, ...(appConfig.htmlInject.customLinkAttributes || {}) };
        if (customAttributes['asp-append-version']) {
            return true;
        }
    }

    return false;
}
