const fs = require('fs-extra');
import * as glob from 'glob';
import * as inquirer from 'inquirer';
import * as denodeify from 'denodeify';
import * as path from 'path';

import { colorize, isInFolder, isSamePaths, normalizeRelativePath, readJson } from '../../utils';
import { AngularBuildConfig, AppProjectConfig, HtmlInjectOptions, ModuleReplacementEntry } from '../../models';
import { FaviconConfig } from '../../plugins/icon-webpack-plugin';

import { InitInfo } from './init-info';

const globPromise = denodeify(glob) as any;

type AppCreateTrackInfo = {
    index: number;
    templatePath: string;
    processedEntryFiles: string[];
    nextExpectedEntryFile?: string;
    nextExpectedTsConfigFile?: string;
    defaultTsConfigFilesCreated?: boolean;
    isUniversal?: boolean;
    possibleMainBrowserEntryFiles: string[];
    possibleMainServerEntryFiles: string[];
    possibleSrcDirNames: string[];
    possibleBrowserTsConfigFiles: string[];
    possibleServerTsConfigFiles: string[];
    posibleBrowserPolyfillNames: string[];
    posibleServerPolyfillNames: string[];
};

export async function initAppProjects(cfg: InitInfo): Promise<void> {
    let templateRelativePath = './templates';
    if (!await fs.exists(path.resolve(__dirname, templateRelativePath))) {
        templateRelativePath = '../templates';
    }
    if (!await fs.exists(path.resolve(__dirname, templateRelativePath))) {
        templateRelativePath = '../../templates';
    }
    if (!await fs.exists(path.resolve(__dirname, templateRelativePath))) {
        templateRelativePath = '../../../templates';
    }
    const templatePath = path.resolve(__dirname, templateRelativePath);

    let hasNext = true;
    const possibleMainBrowserEntryFiles = [
        'main.browser.ts', 'browser.main.ts', 'main-browser.ts', 'browser-main.ts', 'main.client.ts', 'main-client.ts',
        'client.main.ts', 'client-main.ts',
        'boot-browser.ts', 'boot-client.ts',
        'main.app.ts', 'main-app.ts',
        'app.main.ts', 'app-main.ts'
    ];
    const possibleMainServerEntryFiles = [
        'main.server.ts', 'server.main.ts', 'main-server.ts', 'server-main.ts', 'main.node.ts', 'main-node.ts',
        'node.main.ts', 'node-main.ts', 'boot-server.ts', 'boot-node.ts'
    ];

    const possibleSrcDirNames = ['src', 'Client', 'ClientApp', 'client-app', 'AngularApp', 'angular-app'];

    // tsconfigs
    const possibleBrowserTsConfigFiles = [
        'tsconfig.browser.json', 'tsconfig.client.json', 'tsconfig-browser.json', 'tsconfig-client.json'
    ];
    const possibleServerTsConfigFiles = [
        'tsconfig.server.json', 'tsconfig.node.json', 'tsconfig-server.json', 'tsconfig-node.json'
    ];

    // polyfills
    const posibleBrowserPolyfillNames = [
        'polyfills.browser.ts', 'polyfill.browser.ts', 'polyfills-browser.ts', 'polyfill-browser.ts',
        'browser.polyfills.ts', 'browser.polyfill.ts', 'browser-polyfills.ts', 'browser-polyfill.ts'
    ];
    const posibleServerPolyfillNames = [
        'polyfills.server.ts', 'polyfill.server.ts', 'polyfills-server.ts', 'polyfill-server.ts',
        'server.polyfills.ts', 'server.polyfill.ts', 'server-polyfills.ts', 'server-polyfill.ts',
        'polyfills.node.ts', 'polyfill.node.ts', 'polyfills-node.ts', 'polyfill-node.ts',
        'node.polyfills.ts', 'node.polyfill.ts', 'node-polyfills.ts', 'node-polyfill.ts'
    ];

    const trackInfo: AppCreateTrackInfo = {
        index: 0,
        processedEntryFiles: [],
        possibleMainBrowserEntryFiles: possibleMainBrowserEntryFiles,
        possibleMainServerEntryFiles: possibleMainServerEntryFiles,
        possibleSrcDirNames: possibleSrcDirNames,
        possibleBrowserTsConfigFiles: possibleBrowserTsConfigFiles,
        possibleServerTsConfigFiles: possibleServerTsConfigFiles,
        posibleBrowserPolyfillNames: posibleBrowserPolyfillNames,
        posibleServerPolyfillNames: posibleServerPolyfillNames,
        templatePath: templatePath
    };
    while (hasNext) {
        hasNext = await initAppProject(cfg, trackInfo);
        trackInfo.index++;
    }
}

async function initAppProject(cfg: InitInfo, trackInfo: AppCreateTrackInfo): Promise<boolean> {
    const projectRoot = cfg.cwd;
    const logger = cfg.logger;
    const index = trackInfo.index;

    cfg.angularBuildConfigToWrite = cfg.angularBuildConfigToWrite || {};
    cfg.angularBuildConfigToWrite.apps = cfg.angularBuildConfigToWrite.apps || [];
    let currentAppConfig: AppProjectConfig = {};
    if (cfg.angularBuildConfigToWrite.apps.length && index < cfg.angularBuildConfigToWrite.apps.length) {
        currentAppConfig = cfg.angularBuildConfigToWrite.apps[index];
    } else {
        cfg.angularBuildConfigToWrite.apps.push(currentAppConfig);
    }

    let initialSrcDirName = '';
    let initialMainEntryName = '';
    let initialPlatformTarget = currentAppConfig.platformTarget;

    // initial srcDir
    if (!currentAppConfig.srcDir || !await fs.exists(path.resolve(projectRoot, currentAppConfig.srcDir))) {
        if (index === 0) {
            let foundSrcPath = '';
            for (let src of trackInfo.possibleSrcDirNames) {
                const foundSrcPaths = await globPromise(src, { cwd: projectRoot, nocase: true });
                if ((foundSrcPaths as string[]).length) {
                    foundSrcPath = path.resolve(projectRoot, (foundSrcPaths as string[])[0]);
                    break;
                }
            }
            if (foundSrcPath) {
                initialSrcDirName = normalizeRelativePath(path.relative(projectRoot, foundSrcPath));
            }
        } else {
            initialSrcDirName = cfg.angularBuildConfigToWrite.apps[index - 1].srcDir || '';
        }
    } else {
        initialSrcDirName = currentAppConfig.srcDir;
    }

    // initial main entry
    if (initialSrcDirName) {
        const intialSrcDir = path.resolve(projectRoot, initialSrcDirName);
        if (index === 0 && typeof trackInfo.isUniversal === 'undefined') {
            let foundBrowserEntryFile = false;
            let foundServerEntryFile = false;

            for (let mainName of trackInfo.possibleMainBrowserEntryFiles) {
                const foundRelativePaths = await globPromise(mainName, { cwd: intialSrcDir, nodir: true });
                if ((foundRelativePaths as string[]).length) {
                    foundBrowserEntryFile = true;
                    break;
                }
            }
            if (foundBrowserEntryFile) {
                for (let mainName of trackInfo.possibleMainServerEntryFiles) {
                    const foundRelativePaths = await globPromise(mainName, { cwd: intialSrcDir, nodir: true });
                    if ((foundRelativePaths as string[]).length) {
                        foundServerEntryFile = true;
                        break;
                    }
                }
            }

            trackInfo.isUniversal = foundBrowserEntryFile && foundServerEntryFile;
        }

        if (trackInfo.nextExpectedEntryFile) {
            initialMainEntryName = trackInfo.nextExpectedEntryFile;
            trackInfo.nextExpectedEntryFile = '';
        } else if (!currentAppConfig.entry || !await fs.exists(path.resolve(intialSrcDir, currentAppConfig.entry))) {
            let entryFilesToSearch = trackInfo.possibleMainBrowserEntryFiles.slice();
            if (currentAppConfig.platformTarget === 'node') {
                entryFilesToSearch = trackInfo.possibleMainServerEntryFiles.slice();
            }
            let foundEntryFile = '';
            for (let mainName of entryFilesToSearch) {
                const foundRelativePaths = await globPromise(mainName, { cwd: intialSrcDir, nodir: true });
                if ((foundRelativePaths as string[]).length) {
                    const tempFoundEntryFile = normalizeRelativePath((foundRelativePaths as string[])[0]);
                    if (trackInfo.processedEntryFiles.indexOf(tempFoundEntryFile) !== -1) {
                        continue;
                    } else {
                        foundEntryFile = tempFoundEntryFile;
                        break;
                    }
                }
            }
            if (foundEntryFile) {
                initialMainEntryName = foundEntryFile;
            }
        } else {
            initialMainEntryName = currentAppConfig.entry;
        }
    }

    // initial platformTarget
    if (!initialPlatformTarget && initialMainEntryName) {
        if (/(browser|web|client|app)/i.test(initialMainEntryName)) {
            initialPlatformTarget = 'web';
        } else if (/(server|node)/i.test(initialMainEntryName)) {
            initialPlatformTarget = 'node';
        }
    }

    // name
    currentAppConfig.name = currentAppConfig.name || '';

    // platform target
    if (!currentAppConfig.platformTarget) {
        if (initialPlatformTarget) {
            currentAppConfig.platformTarget = initialPlatformTarget;
        } else {
            const answer = await inquirer.prompt([
                {
                    type: 'list',
                    name: 'choice',
                    message: colorize('Select platform target:', 'white'),
                    choices: [
                        'web',
                        'node'
                    ],
                    default: 'web'
                }
            ]);
            currentAppConfig.platformTarget = answer.choice;
        }
    }

    // reset name
    if (!currentAppConfig.name && index < 2) {
        currentAppConfig.name = currentAppConfig.platformTarget === 'node' ? 'server-app' : 'browser-app';
    } else if (!currentAppConfig.name) {
        delete currentAppConfig.name;
    }

    // srcDir
    if (index === 0) {
        currentAppConfig.srcDir = initialSrcDirName;
        const answer = await inquirer.prompt([
            {
                type: 'input',
                name: 'input',
                message: colorize(`Enter src folder of your app project:`, 'white'),
                default: currentAppConfig.srcDir || undefined,
                validate(value: string): boolean | string {
                    const valid = value &&
                        !path.isAbsolute(value) &&
                        fs.existsSync(path.resolve(projectRoot, value)) &&
                        fs.statSync(path.resolve(projectRoot, value)).isDirectory();
                    if (valid) {
                        return true;
                    }

                    return colorize(
                        `Please enter valid src folder of your app project. Example: 'src' or 'client' or 'angular-app'.` +
                        ` Path must be relative path to current directory. Commonly it is refer to root folder ` +
                        `containing your bootstrap main.ts file.`,
                        'yellow');
                }
            }
        ]);
        currentAppConfig.srcDir = normalizeRelativePath(answer.input);
    } else {
        currentAppConfig.srcDir = currentAppConfig.srcDir || cfg.angularBuildConfigToWrite.apps[index - 1].srcDir || '';
    }
    const srcDir = path.resolve(projectRoot, currentAppConfig.srcDir);

    // outDir
    if (!currentAppConfig.outDir) {
        let distName = 'dist';
        if ((!currentAppConfig.platformTarget ||
            currentAppConfig.platformTarget === 'web') &&
            await fs.exists(path.resolve(projectRoot, 'wwwroot'))) {
            distName = 'wwwroot';
        }
        currentAppConfig.outDir = distName;
    }
    if (!currentAppConfig.outDir ||
        path.isAbsolute(currentAppConfig.outDir) ||
        isSamePaths(projectRoot, path.resolve(projectRoot, currentAppConfig.outDir)) ||
        isSamePaths(srcDir, path.resolve(projectRoot, currentAppConfig.outDir))) {
        currentAppConfig.outDir = '';
    }
    const outDirAnswer = await inquirer.prompt([
        {
            type: 'input',
            name: 'input',
            message: colorize(`Enter output folder for build results:`, 'white'),
            default: currentAppConfig.outDir || undefined,
            validate(value: string): boolean | string {
                if (value && isSamePaths(projectRoot, path.resolve(projectRoot, value))) {
                    return colorize('The output folder must NOT be the same as project root folder.', 'yellow');
                }
                if (value && isSamePaths(srcDir, path.resolve(projectRoot, value))) {
                    return colorize(`The output folder must NOT be the same as root src folder.`, 'yellow');
                }

                if (value &&
                    (path.isAbsolute(value) ||
                        isInFolder(path.resolve(projectRoot, value), projectRoot) ||
                        isInFolder(path.resolve(projectRoot, value), srcDir))) {
                    return colorize(
                        `The '${value}' path is not alowed. Please enter a valid relative path to current directory. ` +
                        `Commonly output folder may be 'dist' or 'wwwroot'.`,
                        'yellow');
                }
                return true;
            }
        }
    ]);
    currentAppConfig.outDir = normalizeRelativePath(outDirAnswer.input);

    // assets
    if (!currentAppConfig.assets || !currentAppConfig.assets.length) {
        if (index === 0) {
            currentAppConfig.assets = [
                {
                    from: 'assets/**/*',
                    to: 'assets'
                }
            ];

        } else {
            currentAppConfig.assets = [];
            const foundPrevAssets = cfg.angularBuildConfigToWrite.apps
                .filter(app => !!app.assets && app.assets.length > 0).map(app => app.assets);
            if (foundPrevAssets && foundPrevAssets.length) {
                currentAppConfig.assets = JSON.parse(JSON.stringify(foundPrevAssets[0]));
            }
        }
    }

    // styles
    if (currentAppConfig.platformTarget === 'node') {
        if (currentAppConfig.styles) {
            delete currentAppConfig.styles;
        }
    } else if (!currentAppConfig.styles || !currentAppConfig.styles.length) {
        if (index === 0) {
            currentAppConfig.styles = [];
            const fontawesomePath = 'node_modules/font-awesome/css/font-awesome.css';
            if (await fs.exists(path.resolve(projectRoot, fontawesomePath))) {
                currentAppConfig.styles.push(normalizeRelativePath(path.relative(srcDir, fontawesomePath)));
            }

            const materialIconsPath = 'node_modules/material-design-icons/iconfont/material-icons.css';
            if (await fs.exists(path.resolve(projectRoot, materialIconsPath))) {
                currentAppConfig.styles.push(normalizeRelativePath(path.relative(srcDir, materialIconsPath)));
            }

            const bootstrapPath = 'node_modules/bootstrap/dist/css/bootstrap.css';
            if (await fs.exists(path.resolve(projectRoot, bootstrapPath))) {
                currentAppConfig.styles.push(normalizeRelativePath(path.relative(srcDir, bootstrapPath)));
            }

            if (await fs.exists(path.resolve(srcDir, 'styles.scss'))) {
                currentAppConfig.styles.push('styles.scss');
            } else if (await fs.exists(path.resolve(srcDir, 'styles.less'))) {
                currentAppConfig.styles.push('styles.less');
            } else if (await fs.exists(path.resolve(srcDir, 'styles.css'))) {
                currentAppConfig.styles.push('styles.css');
            } else {
                const answer = await inquirer.prompt([
                    {
                        type: 'confirm',
                        name: 'confirm',
                        message: colorize(`Create 'styles.scss' file to entry global styles?`,
                            'white'),
                        default: false
                    }
                ]);
                if (answer.confirm) {
                    await fs.ensureDir(srcDir);
                    await fs.copy(path.resolve(trackInfo.templatePath, 'styles.scss'),
                        path.resolve(srcDir, 'styles.scss'));
                    currentAppConfig.styles.push('styles.scss');
                }
            }
        } else {
            currentAppConfig.styles = [];
            const foundPrevStyles = cfg.angularBuildConfigToWrite.apps
                .filter(app => !!app.styles && app.styles.length > 0).map(app => app.styles);
            if (foundPrevStyles && foundPrevStyles.length) {
                currentAppConfig.styles = JSON.parse(JSON.stringify(foundPrevStyles[0]));
            }
        }
    }

    let dllProvides: { [key: string]: string } | undefined = undefined;

    // scripts
    if (currentAppConfig.platformTarget === 'node') {
        // TODO: to review
        if (currentAppConfig.scripts) {
            delete currentAppConfig.scripts;
        }
    } else if (!currentAppConfig.scripts || !currentAppConfig.scripts.length) {
        if (index === 0) {
            currentAppConfig.scripts = [];
            const jqueryPath = 'node_modules/jquery/dist/jquery.js';
            if (await fs.exists(path.resolve(projectRoot, jqueryPath))) {
                currentAppConfig.scripts.push(normalizeRelativePath(path.relative(srcDir, jqueryPath)));
                dllProvides = { $: 'jquery', jQuery: 'jquery' };
            }
            const tetherPath = 'node_modules/tether/dist/js/tether.js';
            if (await fs.exists(path.resolve(projectRoot, tetherPath))) {
                currentAppConfig.scripts.push(normalizeRelativePath(path.relative(srcDir, tetherPath)));
            }
            const bootstrapPath = 'node_modules/bootstrap/dist/js/bootstrap.js';
            if (await fs.exists(path.resolve(projectRoot, bootstrapPath))) {
                currentAppConfig.scripts.push(normalizeRelativePath(path.relative(srcDir, bootstrapPath)));
            }
        } else {
            currentAppConfig.scripts = [];
            const foundPrevScripts = cfg.angularBuildConfigToWrite.apps
                .filter(app => !!app.scripts && app.scripts.length > 0).map(app => app.scripts);
            if (foundPrevScripts && foundPrevScripts.length) {
                currentAppConfig.scripts = JSON.parse(JSON.stringify(foundPrevScripts[0]));
            }
        }
    }

    // entry
    if (initialMainEntryName) {
        currentAppConfig.entry = initialMainEntryName;
    }
    if (!currentAppConfig.entry || !await fs.exists(path.resolve(srcDir, currentAppConfig.entry))) {
        currentAppConfig.entry = '';
        if (await fs.exists(path.resolve(srcDir, 'main.ts'))) {
            currentAppConfig.entry = 'main.ts';
        } else if (await fs.exists(path.resolve(srcDir, 'boot-main.ts'))) {
            currentAppConfig.entry = 'boot-main.ts';
        } else if (await fs.exists(path.resolve(srcDir, 'boot-app.ts'))) {
            currentAppConfig.entry = 'boot-app.ts';
        }
    }
    const mainEntryAnswer = await inquirer.prompt([
        {
            type: 'input',
            name: 'input',
            message: colorize(`Enter bootstrap main entry file:`, 'white'),
            default: currentAppConfig.entry || undefined,
            validate(value: string): boolean | string {
                const valid = value &&
                    !path.isAbsolute(value) &&
                    /\.ts$/i.test(value);
                if (valid) {
                    return true;
                }
                return colorize(`Please enter a valid bootstrap main entry file. ` +
                    `Commonly the entry file may be 'main.ts'`,
                    'yellow');
            }
        }
    ]);
    currentAppConfig.entry = normalizeRelativePath(mainEntryAnswer.input);
    trackInfo.processedEntryFiles.push(currentAppConfig.entry);

    // tsconfig
    if (!currentAppConfig.tsconfig || !await fs.exists(path.resolve(srcDir, currentAppConfig.tsconfig))) {
        currentAppConfig.tsconfig = '';

        if (index === 0) {
            const answer = await inquirer.prompt([
                {
                    type: 'confirm',
                    name: 'confirm',
                    message: colorize(`Create default tsconfig files for you?`,
                        'white'),
                    default: true
                }
            ]);

            if (answer.confirm) {
                trackInfo.defaultTsConfigFilesCreated = true;

                await fs.ensureDir(srcDir);

                // root/tsconfig.json
                if (await fs.exists(path.resolve(projectRoot, 'tsconfig.json'))) {
                    const userTsConfigJson = await readJson(path.resolve(projectRoot, 'tsconfig.json'));
                    const masterTsConfigJson = await readJson(path.resolve(trackInfo.templatePath, 'tsconfig.root.json'));
                    const compilerOptionsMerged =
                        Object.assign({}, userTsConfigJson.compilerOptions || {}, masterTsConfigJson.compilerOptions);
                    userTsConfigJson.compilerOptions = compilerOptionsMerged;
                    userTsConfigJson.exclude = userTsConfigJson.exclude || masterTsConfigJson.exclude;

                    const overrideAnswer = await inquirer.prompt([
                        {
                            type: 'confirm',
                            name: 'confirm',
                            message: colorize(`Warning: Override tsconfig.json in project root?`,
                                'yellow'),
                            default: true
                        }
                    ]);

                    if (overrideAnswer.confirm) {
                        await fs.writeFile(path.resolve(projectRoot, 'tsconfig.json'),
                            JSON.stringify(userTsConfigJson, null, 2));
                    }
                } else {
                    await fs.copy(path.resolve(trackInfo.templatePath, 'tsconfig.root.json'),
                        path.resolve(projectRoot, 'tsconfig.json'));
                }

                // src/tsconfig.json
                if (currentAppConfig.srcDir && !isSamePaths(srcDir, projectRoot)) {
                    if (await fs.exists(path.resolve(srcDir, 'tsconfig.json'))) {
                        const userTsConfigJson = await readJson(path.resolve(srcDir, 'tsconfig.json'));
                        const masterTsConfigJson = await readJson(path.resolve(trackInfo.templatePath, 'tsconfig.json'));
                        masterTsConfigJson.compilerOptions.outDir =
                            normalizeRelativePath(path.relative(currentAppConfig.srcDir, 'tsc-out'));
                        const compilerOptionsMerged =
                            Object.assign({}, userTsConfigJson.compilerOptions || {}, masterTsConfigJson.compilerOptions);
                        userTsConfigJson.compilerOptions = compilerOptionsMerged;
                        userTsConfigJson.exclude = userTsConfigJson.exclude || masterTsConfigJson.exclude;

                        const overrideAnswer = await inquirer.prompt([
                            {
                                type: 'confirm',
                                name: 'confirm',
                                message: colorize(
                                    `Warning: Merge ${currentAppConfig.srcDir}/tsconfig.json with template config?`,
                                    'yellow'),
                                default: true
                            }
                        ]);

                        if (overrideAnswer.confirm) {
                            await fs.writeFile(path.resolve(srcDir, 'tsconfig.json'),
                                JSON.stringify(userTsConfigJson, null, 2));
                        }
                    } else {
                        await fs.copy(path.resolve(trackInfo.templatePath, 'tsconfig.json'),
                            path.resolve(srcDir, 'tsconfig.json'));
                    }
                }

                // tsconfig.browser.json
                if (currentAppConfig.platformTarget !== 'node') {
                    if (await fs.exists(path.resolve(srcDir, 'tsconfig.browser.json'))) {
                        let userTsConfigJson = await readJson(path.resolve(srcDir, 'tsconfig.browser.json'));
                        const masterTsConfigJson =
                            await readJson(path.resolve(trackInfo.templatePath, 'tsconfig.browser.json'));
                        userTsConfigJson =
                            Object.assign(userTsConfigJson, masterTsConfigJson);

                        const overrideAnswer = await inquirer.prompt([
                            {
                                type: 'confirm',
                                name: 'confirm',
                                message: colorize(
                                    `Warning: Merge ${currentAppConfig.srcDir}/tsconfig.browser.json with template config?`,
                                    'yellow'),
                                default: true
                            }
                        ]);

                        if (overrideAnswer.confirm) {
                            await fs.writeFile(path.resolve(srcDir, 'tsconfig.browser.json'),
                                JSON.stringify(userTsConfigJson, null, 2));
                        }
                    } else {
                        await fs.copy(path.resolve(trackInfo.templatePath, 'tsconfig.browser.json'),
                            path.resolve(srcDir, 'tsconfig.browser.json'));
                    }
                }

                // tsconfig.server.json
                if (trackInfo.isUniversal || currentAppConfig.platformTarget === 'node') {
                    if (await fs.exists(path.resolve(srcDir, 'tsconfig.server.json'))) {
                        let userTsConfigJson = await readJson(path.resolve(srcDir, 'tsconfig.server.json'));
                        const masterTsConfigJson =
                            await readJson(path.resolve(trackInfo.templatePath, 'tsconfig.server.json'));
                        userTsConfigJson =
                            Object.assign(userTsConfigJson, masterTsConfigJson);

                        const overrideAnswer = await inquirer.prompt([
                            {
                                type: 'confirm',
                                name: 'confirm',
                                message: colorize(
                                    `Warning: Merge ${currentAppConfig.srcDir}/tsconfig.server.json with template config?`,
                                    'yellow'),
                                default: true
                            }
                        ]);

                        if (overrideAnswer.confirm) {
                            await fs.writeFile(path.resolve(srcDir, 'tsconfig.server.json'),
                                JSON.stringify(userTsConfigJson, null, 2));
                        }
                    } else {
                        await fs.copy(path.resolve(trackInfo.templatePath, 'tsconfig.server.json'),
                            path.resolve(srcDir, 'tsconfig.server.json'));
                    }
                }

                const tsConfigFileName = currentAppConfig.platformTarget === 'node'
                    ? 'tsconfig.server.json'
                    : 'tsconfig.browser.json';
                currentAppConfig.tsconfig = tsConfigFileName;
                if (trackInfo.isUniversal) {
                    trackInfo.nextExpectedTsConfigFile = currentAppConfig.platformTarget === 'node'
                        ? 'tsconfig.browser.json'
                        : 'tsconfig.server.json';
                }
            }
        }
        if (trackInfo.defaultTsConfigFilesCreated) {
            if (index === 1) {
                currentAppConfig.tsconfig = trackInfo.nextExpectedTsConfigFile;
            }
        } else {
            let tsConfigFilesToSearch = trackInfo.possibleBrowserTsConfigFiles.slice();
            if (currentAppConfig.platformTarget === 'node') {
                tsConfigFilesToSearch = trackInfo.possibleServerTsConfigFiles.slice();
            }
            let foundTsConfigFile = '';
            for (let tsConfigFileName of tsConfigFilesToSearch) {
                const foundRelativePaths = await globPromise(tsConfigFileName, { cwd: srcDir, nodir: true });
                if ((foundRelativePaths as string[]).length) {
                    foundTsConfigFile = normalizeRelativePath((foundRelativePaths as string[])[0]);
                    break;
                }
            }
            if (!foundTsConfigFile) {
                for (let tsConfigFileName of tsConfigFilesToSearch) {
                    const foundRelativePaths = await globPromise(tsConfigFileName, { cwd: projectRoot, nodir: true });
                    if ((foundRelativePaths as string[]).length) {
                        foundTsConfigFile = normalizeRelativePath(path.relative(currentAppConfig.srcDir || '',
                            (foundRelativePaths as string[])[0]));
                        break;
                    }
                }
            }

            if (!foundTsConfigFile && await fs.exists(path.resolve(srcDir, 'tsconfig.app.json'))) {
                foundTsConfigFile = 'tsconfig.app.json';
            } else if (!foundTsConfigFile && await fs.exists(path.resolve(srcDir, 'tsconfig.build.json'))) {
                foundTsConfigFile = 'tsconfig.build.json';
            } else if (!foundTsConfigFile && await fs.exists(path.resolve(srcDir, 'tsconfig-build.json'))) {
                foundTsConfigFile = 'tsconfig-build.json';
            } else if (!foundTsConfigFile && await fs.exists(path.resolve(srcDir, 'tsconfig.json'))) {
                foundTsConfigFile = 'tsconfig.json';
            } else if (!foundTsConfigFile && await fs.exists(path.resolve(projectRoot, 'tsconfig.app.json'))) {
                foundTsConfigFile = normalizeRelativePath(path.relative(currentAppConfig.srcDir, 'tsconfig.app.json'));
            } else if (!foundTsConfigFile && await fs.exists(path.resolve(projectRoot, 'tsconfig.build.json'))) {
                foundTsConfigFile = normalizeRelativePath(path.relative(currentAppConfig.srcDir, 'tsconfig.build.json'));
            } else if (!foundTsConfigFile && await fs.exists(path.resolve(projectRoot, 'tsconfig.build-json'))) {
                foundTsConfigFile = normalizeRelativePath(path.relative(currentAppConfig.srcDir, 'tsconfig-build.json'));
            } else if (!foundTsConfigFile && await fs.exists(path.resolve(projectRoot, 'tsconfig.json'))) {
                foundTsConfigFile = normalizeRelativePath(path.relative(currentAppConfig.srcDir, 'tsconfig.json'));
            }

            let confirmed = false;
            if (!foundTsConfigFile) {
                const tsConfigFileName = currentAppConfig.platformTarget === 'node'
                    ? 'tsconfig.server.json'
                    : 'tsconfig.browser.json';
                const answer = await inquirer.prompt([
                    {
                        type: 'confirm',
                        name: 'confirm',
                        message: colorize(`We can't find tsconfig file, create one ('${tsConfigFileName}') for you?`,
                            'white'),
                        default: true
                    }
                ]);
                confirmed = !!answer.confirm;
                if (confirmed) {
                    await fs.ensureDir(srcDir);

                    if (index === 0) {
                        await fs.copy(path.resolve(trackInfo.templatePath, 'tsconfig.root.json'),
                            path.resolve(projectRoot, 'tsconfig.json'));

                        if (!isSamePaths(srcDir, projectRoot)) {
                            await fs.copy(path.resolve(trackInfo.templatePath, 'tsconfig.json'),
                                path.resolve(srcDir, 'tsconfig.json'));
                        }
                    }

                    await fs.copy(path.resolve(trackInfo.templatePath, tsConfigFileName),
                        path.resolve(srcDir, tsConfigFileName));

                    currentAppConfig.tsconfig = tsConfigFileName;
                }
            }

            if (!confirmed) {
                const answer = await inquirer.prompt([
                    {
                        type: 'input',
                        name: 'input',
                        message: colorize(`Enter tsconfig file:`, 'white'),
                        default: currentAppConfig.tsconfig || undefined,
                        validate(value: string): boolean | string {
                            const valid = value &&
                                !path.isAbsolute(value) &&
                                fs.existsSync(path.resolve(srcDir, value)) &&
                                fs.statSync(path.resolve(srcDir, value)).isFile() &&
                                /\.json$/i.test(value);
                            if (valid) {
                                return true;
                            }
                            return colorize('Please enter a valid typescript configuration file for your app project.',
                                'yellow');
                        }
                    }
                ]);
                currentAppConfig.tsconfig = normalizeRelativePath(answer.input);
            }
        }
    }

    // polyfills
    if (!currentAppConfig.polyfills || !currentAppConfig.polyfills.length) {
        currentAppConfig.polyfills = [];

        let polyfillFilesToSearch = trackInfo.posibleBrowserPolyfillNames.slice();
        if (currentAppConfig.platformTarget === 'node') {
            polyfillFilesToSearch = trackInfo.posibleServerPolyfillNames.slice();
        }
        let foundPolyfillsFile = '';
        for (let polyfillName of polyfillFilesToSearch) {
            const foundRelativePaths = await globPromise(polyfillName, { cwd: srcDir, nodir: true });
            if ((foundRelativePaths as string[]).length) {
                foundPolyfillsFile = normalizeRelativePath((foundRelativePaths as string[])[0]);
                break;
            }
        }
        if (!foundPolyfillsFile && await fs.exists(path.resolve(srcDir, 'polyfills.app.ts'))) {
            foundPolyfillsFile = 'polyfills.app.ts';
        } else if (!foundPolyfillsFile && await fs.exists(path.resolve(srcDir, 'polyfill.app.ts'))) {
            foundPolyfillsFile = 'polyfill.app.ts';
        } else if (!foundPolyfillsFile && await fs.exists(path.resolve(srcDir, 'app.polyfills.ts'))) {
            foundPolyfillsFile = 'app.polyfills.ts';
        } else if (!foundPolyfillsFile && await fs.exists(path.resolve(srcDir, 'app.polyfill.ts'))) {
            foundPolyfillsFile = 'app.polyfill.ts';
        } else if (!foundPolyfillsFile && await fs.exists(path.resolve(srcDir, 'polyfills.ts'))) {
            foundPolyfillsFile = 'polyfills.ts';
        } else if (!foundPolyfillsFile && await fs.exists(path.resolve(srcDir, 'polyfill.ts'))) {
            foundPolyfillsFile = 'polyfill.ts';
        }

        if (foundPolyfillsFile) {
            currentAppConfig.polyfills = [foundPolyfillsFile];
        } else if (currentAppConfig.platformTarget === 'web') {
            const tempPolyfills: string[] = [];
            let hasCoreJsPolyfill = false;
            let hasEsShimPolyfill = false;
            let hasZoneJsPolyfill = false;
            if (cfg.userPackageConfig.dependencies) {
                Object.keys(cfg.userPackageConfig.dependencies).forEach((key: string) => {
                    if (!hasEsShimPolyfill && key === 'core-js') {
                        tempPolyfills.push('core-js/es6/reflect');
                        tempPolyfills.push('core-js/es7/reflect');
                        hasCoreJsPolyfill = true;
                    } else if (!hasCoreJsPolyfill && key === 'es6-shim') {
                        tempPolyfills.push('es6-shim');
                        hasEsShimPolyfill = true;
                    } else if (!hasCoreJsPolyfill && key === 'reflect-metadata') {
                        tempPolyfills.push('reflect-metadata');
                    } else if (key === 'zone.js') {
                        tempPolyfills.push('zone.js/dist/zone');
                        hasZoneJsPolyfill = true;
                    }
                });
            }

            if (!tempPolyfills.length || !hasZoneJsPolyfill || !(hasCoreJsPolyfill || hasEsShimPolyfill)) {
                foundPolyfillsFile = 'polyfills.browser.ts';
                const answer = await inquirer.prompt([
                    {
                        type: 'confirm',
                        name: 'confirm',
                        message: colorize(`Create '${foundPolyfillsFile}' to entry browser polyfills?`,
                            'white'),
                        default: true
                    }
                ]);
                const confirmed = !!answer.confirm;
                if (confirmed) {
                    cfg.shouldInstallPolyfills = true;
                    await fs.ensureDir(srcDir);
                    await fs.copy(path.resolve(trackInfo.templatePath, foundPolyfillsFile),
                        path.resolve(srcDir, foundPolyfillsFile));
                    currentAppConfig.polyfills = [foundPolyfillsFile];
                }
            } else {
                currentAppConfig.polyfills = tempPolyfills;
            }
        }
    } else if (!Array.isArray(currentAppConfig.polyfills)) {
        currentAppConfig.polyfills = [currentAppConfig.polyfills as string];
    }

    // dlls
    if (!currentAppConfig.dlls || !currentAppConfig.dlls.length) {
        const dllExcludes = ['isomorphic-fetch', 'preboot'];
        if (cfg.userPackageConfig.dependencies &&
            cfg.userPackageConfig.dependencies['aspnet-prerendering'] &&
            currentAppConfig.platformTarget === 'web') {
            dllExcludes.push('aspnet-prerendering');
        }

        currentAppConfig.dlls = [
            {
                entry: normalizeRelativePath(path.relative(srcDir, 'package.json')),
                excludes: dllExcludes
            }
        ];
    }

    // public path
    if (!currentAppConfig.publicPath) {
        if (index === 0) {
            let tempPublicPath = '';
            if (currentAppConfig.outDir.indexOf('/') > -1 && currentAppConfig.outDir.split('/').length === 2) {
                tempPublicPath = currentAppConfig.outDir.split('/')[1];
                if (!/\/$/.test(tempPublicPath)) {
                    tempPublicPath = tempPublicPath + '/';
                }
            } else {
                tempPublicPath = '/';
            }

            const answer = await inquirer.prompt([
                {
                    type: 'input',
                    name: 'input',
                    message: colorize(`Enter public path:`, 'white'),
                    default: tempPublicPath || undefined,
                    validate(value: string): boolean | string {
                        if (value && !/\/$/.test(value)) {
                            return colorize(
                                `Please enter valid public path. ` +
                                `Example: / or /dist/ or http://localhost:5000/.`,
                                'yellow');
                        }
                        return true;
                    }
                }
            ]);
            currentAppConfig.publicPath = answer.input;
        } else {
            currentAppConfig.publicPath = '';
            const foundPrevPublicPaths = cfg.angularBuildConfigToWrite.apps
                .filter(app => !!app.publicPath).map(app => app.publicPath);
            if (foundPrevPublicPaths && foundPrevPublicPaths.length) {
                currentAppConfig.publicPath = foundPrevPublicPaths[0];
            }
        }
    } else if (!/\/$/.test(currentAppConfig.publicPath)) {
        currentAppConfig.publicPath = currentAppConfig.publicPath + '/';
    }

    // faviconConfig
    if (currentAppConfig.platformTarget === 'node') {
        if (currentAppConfig.faviconConfig) {
            delete currentAppConfig.faviconConfig;
        }
    } else if (index === 0) {
        const faviconConfigFile = 'favicon-config.json';
        let currentFaviconConfig: FaviconConfig | null = null;

        if (!currentAppConfig.faviconConfig && await fs.exists(path.resolve(srcDir, faviconConfigFile))) {
            currentFaviconConfig = await readJson(path.resolve(srcDir, faviconConfigFile))
                .then((config: any) => config).catch(() => null);
            if (currentFaviconConfig) {
                currentAppConfig.faviconConfig = 'favicon-config.json';
            }
        } else if (currentAppConfig.faviconConfig && await fs.exists(path.resolve(srcDir, currentAppConfig.faviconConfig))) {
            currentFaviconConfig = await readJson(path.resolve(srcDir, currentAppConfig.faviconConfig))
                .then((config: any) => config).catch(() => null);
            if (!currentFaviconConfig) {
                currentAppConfig.faviconConfig = '';
            }
        }
        if (!currentAppConfig.faviconConfig || !await fs.exists(path.resolve(srcDir, currentAppConfig.faviconConfig))) {
            const answer = await inquirer.prompt([
                {
                    type: 'confirm',
                    name: 'confirm',
                    message: colorize(`Create favicon config file for you?`, 'white'),
                    default: true
                }
            ]);
            const confirmed = !!answer.confirm;
            if (confirmed) {
                currentFaviconConfig = await readJson(path.resolve(trackInfo.templatePath, faviconConfigFile));
                currentAppConfig.faviconConfig = faviconConfigFile;
            } else if (currentAppConfig.faviconConfig) {
                currentAppConfig.faviconConfig = '';
            }
        }

        // favicon master picture
        if (currentFaviconConfig &&
            (!currentFaviconConfig.masterPicture ||
                !await fs.exists(path.resolve(srcDir, currentFaviconConfig.masterPicture)))) {
            currentFaviconConfig.masterPicture = '';
            const possibleIconNames = [
                'favicon.svg', 'favicon.png', 'logo-master.svg', 'logo-master.png', 'master-logo.svg', 'master-logo.png',
                'logo.svg', 'logo.png',
                'icon-master.svg', 'icon-master.png', 'master-icon.svg', 'master-icon.png', 'icon.svg', 'icon.png'
            ];
            let foundIcon = '';
            for (let iconName of possibleIconNames) {
                const foundRelativePaths = await globPromise(iconName, { cwd: srcDir, nodir: true });
                if ((foundRelativePaths as string[]).length) {
                    foundIcon = normalizeRelativePath((foundRelativePaths as string[])[0]);
                    break;
                }
            }
            const answer = await inquirer.prompt([
                {
                    type: 'input',
                    name: 'input',
                    message: colorize(`Enter favicon master picture file:`, 'white'),
                    default: foundIcon || undefined,
                    validate(value: string): boolean | string {
                        if (!value) {
                            return true;
                        }

                        if (/\.ico/i.test(value)) {
                            return colorize('Favicon master picture format should be .svg or .png (NOT .ico).',
                                'yellow');
                        }

                        const valid = value &&
                            !path.isAbsolute(value) &&
                            fs.existsSync(path.resolve(srcDir, value)) &&
                            fs.statSync(path.resolve(srcDir, value)).isFile();
                        if (valid) {
                            return true;
                        }
                        return colorize('Please enter a valid favicon master picture file for your app project.',
                            'yellow');
                    }
                }
            ]);
            if (answer.input) {
                currentFaviconConfig.masterPicture = normalizeRelativePath(answer.input);
            }
        }
        if (currentFaviconConfig && currentAppConfig.faviconConfig) {
            await fs.ensureDir(srcDir);
            await fs.writeFile(path.resolve(srcDir, currentAppConfig.faviconConfig),
                JSON.stringify(currentFaviconConfig, null, 2));
        }
        if (currentAppConfig.assets &&
            currentAppConfig.assets.indexOf('favicon.ico') === -1 &&
            (!currentFaviconConfig || !currentFaviconConfig.masterPicture) &&
            await fs.exists(path.resolve(srcDir, 'favicon.ico'))) {
            currentAppConfig.assets.push('favicon.ico');
        }

    }

    // htmlInjectOptions
    if (currentAppConfig.platformTarget === 'node') {
        if (currentAppConfig.htmlInjectOptions) {
            delete currentAppConfig.htmlInjectOptions;
        }
    } else if (index === 0) {
        if (index > 0 && !currentAppConfig.htmlInjectOptions) {
            const foundHtmlInjectOptions =
                cfg.angularBuildConfigToWrite.apps
                    .filter((app: AppProjectConfig) => app.htmlInjectOptions && app.platformTarget === 'web')
                    .map((app: AppProjectConfig) => JSON.parse(JSON.stringify(app.htmlInjectOptions)));
            if (foundHtmlInjectOptions.length) {
                currentAppConfig.htmlInjectOptions = foundHtmlInjectOptions[0] as HtmlInjectOptions;
            }
        }
        currentAppConfig.htmlInjectOptions = currentAppConfig.htmlInjectOptions || {};

        if (!currentAppConfig.htmlInjectOptions.index &&
            !currentAppConfig.htmlInjectOptions.indexOut &&
            !currentAppConfig.htmlInjectOptions.scriptsOut) {
            if (cfg.isAspNetMvc) {
                let hasAnyAnswer = false;
                let scriptsOutFile =
                    normalizeRelativePath(path.relative(currentAppConfig.srcDir,
                        'Views/Shared/_ScriptsPartial.cshtml'));
                let stylesOutFile =
                    normalizeRelativePath(path.relative(currentAppConfig.srcDir,
                        'Views/Shared/_StylesPartial.cshtml'));
                let iconsOutFile =
                    normalizeRelativePath(path.relative(currentAppConfig.srcDir,
                        'Views/Shared/_FaviconsPartial.cshtml'));
                let resourceHintsOutFile =
                    normalizeRelativePath(path.relative(currentAppConfig.srcDir,
                        'Views/Shared/_ResourceHintsPartial.cshtml'));

                const scriptsOutFileExists =
                    await fs.exists(path.resolve(projectRoot, 'Views/Shared/_ScriptsPartial.cshtml'));
                const stylesOutFileExists =
                    await fs.exists(path.resolve(projectRoot, 'Views/Shared/_StylesPartial.cshtml'));
                const iconsOutFileExists =
                    await fs.exists(path.resolve(projectRoot, 'Views/Shared/_FaviconsPartial.cshtml'));
                const resourceHintsOutFileExists =
                    await fs.exists(path.resolve(projectRoot, 'Views/Shared/_ResourceHintsPartial.cshtml'));

                const scriptsOutAnswer = await inquirer.prompt([
                    {
                        type: 'confirm',
                        name: 'confirm',
                        message: colorize(`${scriptsOutFileExists
                            ? 'Warning: '
                            : ''}Inject bundled script tags to '${scriptsOutFile}'?`,
                            scriptsOutFileExists ? 'yellow' : 'white'),
                        default: true
                    }
                ]);
                if (scriptsOutAnswer.confirm) {
                    hasAnyAnswer = true;
                    currentAppConfig.htmlInjectOptions.scriptsOut = scriptsOutFile;

                    await fs.ensureDir(path.dirname(path.resolve(projectRoot, 'Views/Shared/_ScriptsPartial.cshtml')));
                    await fs.writeFile(path.resolve(projectRoot, 'Views/Shared/_ScriptsPartial.cshtml'), '');
                }

                const stylesOutAnswer = await inquirer.prompt([
                    {
                        type: 'confirm',
                        name: 'confirm',
                        message: colorize(`${stylesOutFileExists
                            ? 'Warning: '
                            : ''}Inject bundled style tags to '${stylesOutFile}'?`,
                            stylesOutFileExists ? 'yellow' : 'white'),
                        default: true
                    }
                ]);
                if (stylesOutAnswer.confirm) {
                    hasAnyAnswer = true;
                    currentAppConfig.htmlInjectOptions.stylesOut = stylesOutFile;

                    await fs.ensureDir(path.dirname(path.resolve(projectRoot, 'Views/Shared/_StylesPartial.cshtml')));
                    await fs.writeFile(path.resolve(projectRoot, 'Views/Shared/_StylesPartial.cshtml'), '');
                }

                if (scriptsOutAnswer.confirm || stylesOutAnswer.confirm) {
                    const iconsOutAnswer = await inquirer.prompt([
                        {
                            type: 'confirm',
                            name: 'confirm',
                            message: colorize(`${iconsOutFileExists
                                ? 'Warning: '
                                : ''}Inject generated icon tags to '${iconsOutFile}'?`,
                                iconsOutFileExists ? 'yellow' : 'white'),
                            default: true
                        }
                    ]);

                    if (iconsOutAnswer.confirm) {
                        currentAppConfig.htmlInjectOptions.iconsOut = iconsOutFile;
                        await fs.ensureDir(path.dirname(
                            path.resolve(projectRoot, 'Views/Shared/_FaviconsPartial.cshtml')));
                        await fs.writeFile(path.resolve(projectRoot, 'Views/Shared/_FaviconsPartial.cshtml'), '');
                    }

                    const resourceHintsOutAnswer = await inquirer.prompt([
                        {
                            type: 'confirm',
                            name: 'confirm',
                            message: colorize(`${resourceHintsOutFileExists
                                ? 'Warning: '
                                : ''}Inject resource hint tags to '${resourceHintsOutFile}'?`,
                                resourceHintsOutFileExists ? 'yellow' : 'white'),
                            default: true
                        }
                    ]);

                    if (resourceHintsOutAnswer.confirm) {
                        currentAppConfig.htmlInjectOptions.resourceHintsOut = resourceHintsOutFile;
                        await fs.ensureDir(path.dirname(
                            path.resolve(projectRoot, 'Views/Shared/_ResourceHintsPartial.cshtml')));
                        await fs.writeFile(path.resolve(projectRoot, 'Views/Shared/_ResourceHintsPartial.cshtml'), '');
                    }

                    if (currentAppConfig.htmlInjectOptions.index) {
                        currentAppConfig.htmlInjectOptions.index = '';
                    }

                    let layoutCopied = false;
                    if (await fs.exists(path.resolve(projectRoot, 'Views/Shared/_Layout.cshtml'))) {
                        const replaceViewsAnswer = await inquirer.prompt([
                            {
                                type: 'confirm',
                                name: 'confirm',
                                message: colorize(
                                    `Warning: Replace 'Views/Shared/_Layout.cshtml' ` +
                                    `with pre-configured template?`,
                                    'yellow'),
                                default: true
                            }
                        ]);
                        if (replaceViewsAnswer.confirm) {
                            const layoutBakPath = path.resolve(projectRoot, 'Views/Shared/_Layout.cshtml.bak');
                            if (!await fs.exists(layoutBakPath) &&
                                await fs.exists(path.resolve(projectRoot, 'Views/Shared/_Layout.cshtml'))) {
                                await fs.copy(path.resolve(projectRoot, 'Views/Shared/_Layout.cshtml'),
                                    layoutBakPath);
                            }

                            await fs.copy(path.resolve(trackInfo.templatePath,
                                    'aspnetcore/angularstarter/content/Views/Shared/_layout.cshtml'),
                                path.resolve(projectRoot, 'Views/Shared/_Layout.cshtml'));
                            layoutCopied = true;
                        }
                    } else {
                        await fs.copy(path.resolve(trackInfo.templatePath,
                                'aspnetcore/angularstarter/content/Views/Shared/_layout.cshtml'),
                            path.resolve(projectRoot, 'Views/Shared/_Layout.cshtml'));
                        layoutCopied = true;
                    }
                    if (layoutCopied) {
                        if (await fs.exists(path.resolve(projectRoot, 'Views/Home/Index.cshtml'))) {
                            const replaceViewsAnswer = await inquirer.prompt([
                                {
                                    type: 'confirm',
                                    name: 'confirm',
                                    message: colorize(
                                        `Warning: Replace 'Views/Home/Index.cshtml' ` +
                                        `with pre-configured template?`,
                                        'yellow'),
                                    default: true
                                }
                            ]);
                            if (replaceViewsAnswer.confirm) {
                                const layoutBakPath = path.resolve(projectRoot, 'Views/Home/Index.cshtml.bak');
                                if (!await fs.exists(layoutBakPath) &&
                                    await fs.exists(path.resolve(projectRoot, 'Views/Home/Index.cshtml'))) {
                                    await fs.copy(path.resolve(projectRoot, 'Views/Home/Index.cshtml'),
                                        layoutBakPath);
                                }

                                await fs.copy(path.resolve(trackInfo.templatePath,
                                        'aspnetcore/angularstarter/content/Views/Home/Index.cshtml'),
                                    path.resolve(projectRoot, 'Views/Home/Index.cshtml'));
                            }
                        } else {
                            await fs.copy(path.resolve(trackInfo.templatePath,
                                    'aspnetcore/angularstarter/content/Views/Home/Index.cshtml'),
                                path.resolve(projectRoot, 'Views/Home/Index.cshtml'));
                        }

                        const aspAppendVersionAnswer = await inquirer.prompt([
                            {
                                type: 'confirm',
                                name: 'confirm',
                                message: colorize(
                                    `Add 'asp-append-version' custom attribute?`,
                                    'white'),
                                default: true
                            }
                        ]);
                        if (aspAppendVersionAnswer.confirm) {
                            currentAppConfig.htmlInjectOptions.customLinkAttributes = {
                                'asp-append-version': 'true'
                            };
                            currentAppConfig.htmlInjectOptions.customScriptAttributes = {
                                'asp-append-version': 'true'
                            };
                        }
                    }
                } else if (await fs.exists(path.resolve(srcDir, 'index.html'))) {
                    currentAppConfig.htmlInjectOptions.index = 'index.html';
                }
            } else if (await fs.exists(path.resolve(srcDir, 'index.html'))) {
                currentAppConfig.htmlInjectOptions.index = 'index.html';
            }
        }
    }

    // banner
    if (!currentAppConfig.banner && await fs.exists(path.resolve(srcDir, 'banner.txt'))) {
        currentAppConfig.banner = 'banner.txt';
    } else if (!currentAppConfig.banner && await fs.exists(path.resolve(projectRoot, 'banner.txt'))) {
        currentAppConfig.banner = normalizeRelativePath(path.relative(currentAppConfig.srcDir, 'banner.txt'));
    }

    // moduleReplacements
    const moduleReplacements: ModuleReplacementEntry[] = [];
    if (await fs.exists(path.resolve(srcDir, 'environments', 'environment.ts')) &&
        await fs.exists(path.resolve(srcDir, 'environments', 'environment.prod.ts'))) {
        moduleReplacements.push({
            resourcePath: 'environments/environment.ts',
            newResourcePath: 'environments/environment.prod.ts'
        });
    }

    // envOverrides
    const devBrowserPolyfills = ['zone.js/dist/long-stack-trace-zone'];
    if (await fs.exists(path.resolve(projectRoot, 'node_modules', 'event-source-polyfill'))) {
        devBrowserPolyfills.push('event-source-polyfill');
    }
    currentAppConfig.envOverrides = currentAppConfig.envOverrides ||
        {
            dev: {
                referenceDll: !!currentAppConfig.dlls && currentAppConfig.dlls.length > 0,
                polyfills: (currentAppConfig.polyfills as string[] || []).concat(currentAppConfig.platformTarget === 'node'
                    ? []
                    : devBrowserPolyfills)
            },
            dll: {
                provides: dllProvides || {}
            },
            prod: {
                moduleReplacements: moduleReplacements
            },
            aot: {},
            universal: {}
        };

    // universal skip
    if (index > 0 && currentAppConfig.platformTarget === 'node' && trackInfo.isUniversal) {
        if ((currentAppConfig.envOverrides as any).universal) {
            (currentAppConfig.envOverrides as any).universal.skip = false;
            currentAppConfig.skip = true;
        }
    }

    // webpack config
    if (index === 0 && await fs.exists(path.resolve(projectRoot, 'webpack.config.js'))) {
        const userWpConfigContent = await fs.readFile(path.resolve(projectRoot, 'webpack.config.js'), 'utf-8');
        const tplWpConfigContent =
            await fs.readFile(path.resolve(trackInfo.templatePath, 'webpack.config.js'), 'utf-8');
        if (userWpConfigContent !== tplWpConfigContent) {
            const answer = await inquirer.prompt([
                {
                    type: 'confirm',
                    name: 'confirm',
                    message: colorize(`Warning: Override 'webpack.config.js' with template one?`, 'yellow'),
                    default: true
                }
            ]);

            if (answer.confirm) {
                const webpackConfigBakPath = path.resolve(projectRoot, 'webpack.config.js.bak');
                if (! await fs.exists(webpackConfigBakPath)) {
                    await fs.copy(path.resolve(projectRoot, 'webpack.config.js'), webpackConfigBakPath);
                }
                await fs.copy(path.resolve(trackInfo.templatePath, 'webpack.config.js'),
                    path.resolve(projectRoot, 'webpack.config.js'));
                cfg.webpackConfigFileCreated = true;
            }
        }
    } else if (index === 0) {
        const answer = await inquirer.prompt([
            {
                type: 'confirm',
                name: 'confirm',
                message: colorize(`Create 'webpack.config.js' file?`, 'white'),
                default: cfg.isAspNetMvc
            }
        ]);
        if (answer.confirm) {
            await fs.copy(path.resolve(trackInfo.templatePath, 'webpack.config.js'),
                path.resolve(projectRoot, 'webpack.config.js'));
            cfg.webpackConfigFileCreated = true;
        }
    }

    // webpack vendor config
    if (index === 0 &&
        cfg.webpackConfigFileCreated &&
        await fs.exists(path.resolve(projectRoot, 'webpack.config.vendor.js'))) {
        const userWpConfigContent = await fs.readFile(path.resolve(projectRoot, 'webpack.config.vendor.js'), 'utf-8');
        const tplWpConfigContent = await fs.readFile(path.resolve(trackInfo.templatePath, 'webpack.config.vendor.js'),
            'utf-8');
        if (userWpConfigContent !== tplWpConfigContent) {
            const answer = await inquirer.prompt([
                {
                    type: 'confirm',
                    name: 'confirm',
                    message: colorize(`Warning: Override 'webpack.config.vendor.js' with template one?`, 'yellow'),
                    default: true
                }
            ]);

            if (answer.confirm) {
                const webpackConfigVendorBakPath = path.resolve(projectRoot, 'webpack.config.vendor.js.bak');
                if (! await fs.exists(webpackConfigVendorBakPath)) {
                    await fs.copy(path.resolve(projectRoot, 'webpack.config.vendor.js'), webpackConfigVendorBakPath);
                }
                await fs.copy(path.resolve(trackInfo.templatePath, 'webpack.config.vendor.js'),
                    path.resolve(projectRoot, 'webpack.config.vendor.js'));
            }
        }
    }

    // check for one more app
    if (index === 0 && currentAppConfig.platformTarget === 'web') {
        let foundNextEntry = '';
        for (let mainName of trackInfo.possibleMainServerEntryFiles) {
            const foundRelativePaths = await globPromise(mainName, { cwd: srcDir, nodir: true });
            if ((foundRelativePaths as string[]).length) {
                foundNextEntry = normalizeRelativePath((foundRelativePaths as string[])[0]);
                break;
            }
        }
        if (foundNextEntry) {
            logger.log('\n');
            const answer = await inquirer.prompt([
                {
                    type: 'confirm',
                    name: 'confirm',
                    message: colorize(`One more app config for '${foundNextEntry}'?`, 'white'),
                    default: true
                }
            ]);
            if (answer.confirm) {
                trackInfo.nextExpectedEntryFile = foundNextEntry;
                logger.log('\n');
                return true;
            }
        }
    }

    return false;
}

export async function mergeAppWithUserConfig(cfg: InitInfo, userConfig: AngularBuildConfig): Promise<void> {
    if ((!userConfig.apps && !userConfig.libs) ||
        (userConfig.apps && !Array.isArray(userConfig.apps)) ||
        (userConfig.libs && !Array.isArray(userConfig.libs))) {
        return;
    }

    cfg.angularBuildConfigToWrite = cfg.angularBuildConfigToWrite || {};

    if (userConfig.apps) {
        const tempAppConfig: AppProjectConfig = {};
        const userFirstAppConfig: AppProjectConfig = userConfig.apps[0];

        if (userFirstAppConfig.srcDir &&
            typeof userFirstAppConfig.srcDir === 'string' &&
            !path.isAbsolute(userFirstAppConfig.srcDir)) {
            tempAppConfig.srcDir = userFirstAppConfig.srcDir;
        }
        if (userFirstAppConfig.outDir &&
            typeof userFirstAppConfig.outDir === 'string' &&
            !path.isAbsolute(userFirstAppConfig.outDir)) {
            tempAppConfig.outDir = userFirstAppConfig.outDir;
        }
        if ((userFirstAppConfig as any).main &&
            typeof (userFirstAppConfig as any) === 'string' &&
            !path.isAbsolute((userFirstAppConfig as any))) {
            tempAppConfig.entry = (userFirstAppConfig as any);
        }
        if (userFirstAppConfig.entry &&
            typeof userFirstAppConfig.entry === 'string' &&
            !path.isAbsolute(userFirstAppConfig.entry)) {
            tempAppConfig.entry = userFirstAppConfig.entry;
        }
        if (userFirstAppConfig.tsconfig &&
            typeof userFirstAppConfig.tsconfig === 'string' &&
            !path.isAbsolute(userFirstAppConfig.tsconfig)) {
            tempAppConfig.tsconfig = userFirstAppConfig.tsconfig;
        }
        if (userFirstAppConfig.polyfills &&
            typeof userFirstAppConfig.polyfills === 'string') {
            tempAppConfig.polyfills = [userFirstAppConfig.polyfills as string];
        }
        if (userFirstAppConfig.polyfills &&
            Array.isArray(userFirstAppConfig.polyfills)) {
            tempAppConfig.polyfills = (userFirstAppConfig.polyfills as string[])
                .filter((p: any) => p && typeof p === 'string').map((p: string) => p);
        }
        if (userFirstAppConfig.assets &&
            Array.isArray(userFirstAppConfig.assets)) {
            tempAppConfig.assets = (userFirstAppConfig.assets as any[])
                .filter((p: any) => p && (typeof p === 'string' || (typeof p === 'object' && (p as any).from)))
                .map((p: any) => {
                    if (typeof p === 'string') {
                        return p;
                    } else {
                        return {
                            from: p.from,
                            to: p.to
                        };
                    }
                });
        }
        if (userFirstAppConfig.styles &&
            Array.isArray(userFirstAppConfig.styles)) {
            tempAppConfig.styles = (userFirstAppConfig.styles as any[])
                .filter((p: any) => p && (typeof p === 'string' || (typeof p === 'object' && (p as any).from)))
                .map((p: any) => {
                    if (typeof p === 'string') {
                        return p;
                    } else {
                        return {
                            from: p.from,
                            to: p.to
                        };
                    }
                });
        }

        if (Object.keys(tempAppConfig).length) {
            cfg.angularBuildConfigToWrite.apps = cfg.angularBuildConfigToWrite.apps || [];
            if (cfg.angularBuildConfigToWrite.apps.length) {
                cfg.angularBuildConfigToWrite.apps[0] =
                    Object.assign(cfg.angularBuildConfigToWrite.apps[0], tempAppConfig);
            } else {
                cfg.angularBuildConfigToWrite.apps.push(tempAppConfig);
            }
        }
    }
}

