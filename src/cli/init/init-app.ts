import * as fs from 'fs-extra';
import * as glob from 'glob';
import * as inquirer from 'inquirer';
import * as denodeify from 'denodeify';
import * as path from 'path';

import { colorize, isInFolder, isSamePaths, normalizeRelativePath, readJson } from '../../utils';
import { AngularBuildConfig, AppProjectConfig, ModuleReplacementEntry } from '../../models';
import { FaviconConfig } from '../../plugins/icon-webpack-plugin';

import { InitInfo } from './init-info';

const globPromise = denodeify(glob) as any;

type AppCreateTrackInfo = {
    index: number,
    expectedEntryFile?: string;
};

export async function initAppProjects(cfg: InitInfo): Promise<void> {
    let hasNext = true;
    const trackInfo: AppCreateTrackInfo = {
        index: 0
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

    const templateAbsolutePath = path.resolve(__dirname, templateRelativePath);

    cfg.angularBuildConfigToWrite = cfg.angularBuildConfigToWrite || {};
    cfg.angularBuildConfigToWrite.apps = cfg.angularBuildConfigToWrite.apps || [];
    let currentAppConfig: AppProjectConfig = {};
    if (cfg.angularBuildConfigToWrite.apps.length && index < cfg.angularBuildConfigToWrite.apps.length) {
        currentAppConfig = cfg.angularBuildConfigToWrite.apps[index];
    } else {
        cfg.angularBuildConfigToWrite.apps.push(currentAppConfig);
    }

    // name
    currentAppConfig.name = currentAppConfig.name || '';

    // platform target
    if (!currentAppConfig.platformTarget) {
        if (trackInfo.expectedEntryFile && /(server|node)/i.test(trackInfo.expectedEntryFile)) {
            currentAppConfig.platformTarget = 'node';
        } else if (trackInfo.expectedEntryFile && /(browser|web|app[\.\-])/i.test(trackInfo.expectedEntryFile)) {
            currentAppConfig.platformTarget = 'web';
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
    if (!currentAppConfig.name) {
        currentAppConfig.name = currentAppConfig.platformTarget === 'node' ? 'server-app' : 'browser-app';
    }

    // srcDir
    if (index > 0) {
        currentAppConfig.srcDir = currentAppConfig.srcDir || cfg.angularBuildConfigToWrite.apps[index - 1].srcDir;
    }
    if (!currentAppConfig.srcDir || !await fs.exists(path.resolve(projectRoot, currentAppConfig.srcDir))) {
        currentAppConfig.srcDir = '';
        const possibleSrcNames = ['src', 'Client', 'ClientApp', 'client-app', 'AngularApp', 'angular-app'];
        let foundSrcPath = '';
        for (let src of possibleSrcNames) {
            const foundSrcPaths = await globPromise(src, { cwd: projectRoot, nocase: true });
            if ((foundSrcPaths as string[]).length) {
                foundSrcPath = path.resolve(projectRoot, (foundSrcPaths as string[])[0]);
                break;
            }
        }
        if (foundSrcPath) {
            currentAppConfig.srcDir = normalizeRelativePath(path.relative(projectRoot, foundSrcPath));
        }
    }
    if (index === 0 || !currentAppConfig.srcDir) {
        const srcDirAnswer = await inquirer.prompt([
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
        currentAppConfig.srcDir = normalizeRelativePath(srcDirAnswer.input);
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
    if (index === 0) {
        if (!currentAppConfig.assets || !currentAppConfig.assets.length) {
            currentAppConfig.assets = [
                {
                    from: 'assets/**/*',
                    to: 'assets'
                }
            ];
        }
    } else {
        currentAppConfig.assets = cfg.angularBuildConfigToWrite.apps[index - 1].assets;
    }

    // styles
    if (currentAppConfig.platformTarget === 'node') {
        if (currentAppConfig.styles) {
            delete currentAppConfig.styles;
        }
    } else if (!currentAppConfig.styles || !currentAppConfig.styles.length) {
        currentAppConfig.styles = [];
        if (await fs.exists(path.resolve(srcDir, 'styles.scss'))) {
            currentAppConfig.styles.push('styles.scss');
        } else if (await fs.exists(path.resolve(srcDir, 'styles.less'))) {
            currentAppConfig.styles.push('styles.less');
        } else if (await fs.exists(path.resolve(srcDir, 'styles.css'))) {
            currentAppConfig.styles.push('styles.css');
        }
    }

    // scripts
    if (currentAppConfig.platformTarget === 'node') {
        if (currentAppConfig.scripts) {
            delete currentAppConfig.scripts;
        }
    } else if (!currentAppConfig.scripts || !currentAppConfig.scripts.length) {
        currentAppConfig.scripts = [];
    }

    // entry
    if (trackInfo.expectedEntryFile && await fs.exists(path.resolve(srcDir, trackInfo.expectedEntryFile))) {
        currentAppConfig.entry = trackInfo.expectedEntryFile;
    }
    if (!currentAppConfig.entry || !await fs.exists(path.resolve(srcDir, currentAppConfig.entry))) {
        currentAppConfig.entry = '';
        if (currentAppConfig.platformTarget === 'node') {
            if (await fs.exists(path.resolve(srcDir, 'main.server.ts'))) {
                currentAppConfig.entry = 'main.server.ts';
            } else if (await fs.exists(path.resolve(srcDir, 'server.main.ts'))) {
                currentAppConfig.entry = 'server.main.ts';
            } else if (await fs.exists(path.resolve(srcDir, 'main-server.ts'))) {
                currentAppConfig.entry = 'main-server.ts';
            } else if (await fs.exists(path.resolve(srcDir, 'server-main.ts'))) {
                currentAppConfig.entry = 'server-main.ts';
            } else if (await fs.exists(path.resolve(srcDir, 'main.node.ts'))) {
                currentAppConfig.entry = 'main.node.ts';
            } else if (await fs.exists(path.resolve(srcDir, 'node-main.ts'))) {
                currentAppConfig.entry = 'node-main.ts';
            }
        } else {
            if (await fs.exists(path.resolve(srcDir, 'main.browser.ts'))) {
                currentAppConfig.entry = 'main.browser.ts';
            } else if (await fs.exists(path.resolve(srcDir, 'browser.main.ts'))) {
                currentAppConfig.entry = 'browser.main.ts';
            } else if (await fs.exists(path.resolve(srcDir, 'main-browser.ts'))) {
                currentAppConfig.entry = 'main-browser.ts';
            } else if (await fs.exists(path.resolve(srcDir, 'browser-main.ts'))) {
                currentAppConfig.entry = 'browser-main.ts';
            } else if (await fs.exists(path.resolve(srcDir, 'main.app.ts'))) {
                currentAppConfig.entry = 'main.app.ts';
            } else if (await fs.exists(path.resolve(srcDir, 'app-main.ts'))) {
                currentAppConfig.entry = 'app-main.ts';
            }
        }

        if (!currentAppConfig.entry && await fs.exists(path.resolve(srcDir, 'main.ts'))) {
            currentAppConfig.entry = 'main.ts';
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

    // tsconfig
    if (!currentAppConfig.tsconfig || !await fs.exists(path.resolve(srcDir, currentAppConfig.tsconfig))) {
        currentAppConfig.tsconfig = '';
        let tempTsConfigFile = '';
        if (currentAppConfig.platformTarget === 'node') {
            if (await fs.exists(path.resolve(srcDir, 'tsconfig.server.json'))) {
                tempTsConfigFile = 'tsconfig.server.json';
            } else if (await fs.exists(path.resolve(srcDir, 'tsconfig.node.json'))) {
                tempTsConfigFile = 'tsconfig.node.json';
            } else if (await fs.exists(path.resolve(projectRoot, 'tsconfig.server.json'))) {
                tempTsConfigFile = normalizeRelativePath(path.relative(currentAppConfig.srcDir, 'tsconfig.server.json'));
            } else if (await fs.exists(path.resolve(projectRoot, 'tsconfig.node.json'))) {
                tempTsConfigFile = normalizeRelativePath(path.relative(currentAppConfig.srcDir, 'tsconfig.node.json'));
            }
        } else {
            if (await fs.exists(path.resolve(srcDir, 'tsconfig.browser.json'))) {
                tempTsConfigFile = 'tsconfig.browser.json';
            } else if (await fs.exists(path.resolve(srcDir, 'tsconfig.app.json'))) {
                tempTsConfigFile = 'tsconfig.app.json';
            } else if (await fs.exists(path.resolve(projectRoot, 'tsconfig.browser.json'))) {
                tempTsConfigFile = normalizeRelativePath(path.relative(currentAppConfig.srcDir, 'tsconfig.browser.json'));
            } else if (await fs.exists(path.resolve(projectRoot, 'tsconfig.app.json'))) {
                tempTsConfigFile = normalizeRelativePath(path.relative(currentAppConfig.srcDir, 'tsconfig.app.json'));
            }
        }

        if (!tempTsConfigFile && await fs.exists(path.resolve(srcDir, 'tsconfig.build.json'))) {
            tempTsConfigFile = 'tsconfig.build.json';
        } else if (!tempTsConfigFile && await fs.exists(path.resolve(srcDir, 'tsconfig-build.json'))) {
            tempTsConfigFile = 'tsconfig-build.json';
        } else if (!tempTsConfigFile && await fs.exists(path.resolve(srcDir, 'tsconfig.json'))) {
            tempTsConfigFile = 'tsconfig.json';
        } else if (!tempTsConfigFile && await fs.exists(path.resolve(projectRoot, 'tsconfig.build.json'))) {
            tempTsConfigFile = normalizeRelativePath(path.relative(currentAppConfig.srcDir, 'tsconfig.build.json'));
        } else if (!tempTsConfigFile && await fs.exists(path.resolve(projectRoot, 'tsconfig.build-json'))) {
            tempTsConfigFile = normalizeRelativePath(path.relative(currentAppConfig.srcDir, 'tsconfig-build.json'));
        } else if (!tempTsConfigFile && await fs.exists(path.resolve(projectRoot, 'tsconfig.json'))) {
            tempTsConfigFile = normalizeRelativePath(path.relative(currentAppConfig.srcDir, 'tsconfig.json'));
        }

        let confirmed = false;
        if (!tempTsConfigFile) {
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
                await fs.copy(path.resolve(templateAbsolutePath, 'tsconfig.json'),
                    path.resolve(projectRoot, 'tsconfig.json'));
                await fs.copy(path.resolve(templateAbsolutePath, tsConfigFileName),
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
                    default: tempTsConfigFile || undefined,
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

    // polyfills
    if (currentAppConfig.platformTarget === 'node') {
        currentAppConfig.polyfills = currentAppConfig.polyfills || [];
    } else if (!currentAppConfig.polyfills || !currentAppConfig.polyfills.length) {
        let polyfillsFile = '';
        if (await fs.exists(path.resolve(srcDir, 'polyfills.browser.ts'))) {
            polyfillsFile = 'polyfills.browser.ts';
        } else if (await fs.exists(path.resolve(srcDir, 'browser.polyfills.ts'))) {
            polyfillsFile = 'browser.polyfills.ts';
        } else if (await fs.exists(path.resolve(srcDir, 'polyfills.app.ts'))) {
            polyfillsFile = 'polyfills.app.ts';
        } else if (await fs.exists(path.resolve(srcDir, 'app.polyfills.ts'))) {
            polyfillsFile = 'app.polyfills.ts';
        } else if (await fs.exists(path.resolve(srcDir, 'polyfill.browser.ts'))) {
            polyfillsFile = 'polyfill.browser.ts';
        } else if (await fs.exists(path.resolve(srcDir, 'browser.polyfill.ts'))) {
            polyfillsFile = 'browser.polyfill.ts';
        } else if (await fs.exists(path.resolve(srcDir, 'polyfill.app.ts'))) {
            polyfillsFile = 'polyfill.app.ts';
        } else if (await fs.exists(path.resolve(srcDir, 'app.polyfill.ts'))) {
            polyfillsFile = 'app.polyfill.ts';
        } else if (await fs.exists(path.resolve(srcDir, 'polyfills.ts'))) {
            polyfillsFile = 'polyfills.ts';
        } else if (await fs.exists(path.resolve(srcDir, 'polyfill.ts'))) {
            polyfillsFile = 'polyfill.ts';
        }

        if (!polyfillsFile) {
            polyfillsFile = 'polyfills.browser.ts';
            const answer = await inquirer.prompt([
                {
                    type: 'confirm',
                    name: 'confirm',
                    message: colorize(`We can't find polyfills file, create one ('${polyfillsFile}') for you?`,
                        'white'),
                    default: true
                }
            ]);
            const confirmed = !!answer.confirm;
            if (confirmed) {
                await fs.ensureDir(srcDir);
                await fs.copy(path.resolve(templateAbsolutePath, polyfillsFile), path.resolve(srcDir, polyfillsFile));
                currentAppConfig.polyfills = [polyfillsFile];
            }
        } else {
            currentAppConfig.polyfills = [polyfillsFile];
        }
    }

    // dlls
    if (!currentAppConfig.dlls || !currentAppConfig.dlls.length) {
        currentAppConfig.dlls = [
            {
                entry: normalizeRelativePath(path.relative(srcDir, 'package.json')),
                excludes: [],
                includeDefaultExcludes: true
            }
        ];
    }

    // public path
    if (currentAppConfig.platformTarget === 'node') {
        if (currentAppConfig.publicPath) {
            delete currentAppConfig.publicPath;
        }
    } else {
        currentAppConfig.publicPath = currentAppConfig.publicPath || '/';
    }


    // faviconConfig
    if (currentAppConfig.platformTarget === 'node') {
        if (currentAppConfig.faviconConfig) {
            delete currentAppConfig.faviconConfig;
        }
    } else {
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
                currentFaviconConfig = await readJson(path.resolve(templateAbsolutePath, faviconConfigFile));
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
        if (index === 0 &&
            currentAppConfig.assets &&
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
    } else {
        if (index > 0 && !currentAppConfig.htmlInjectOptions) {
            currentAppConfig.htmlInjectOptions =
                cfg.angularBuildConfigToWrite.apps
                    .filter((app: AppProjectConfig) => app.htmlInjectOptions && app.platformTarget === 'web')
                    .map((app: AppProjectConfig) => JSON.parse(JSON.stringify(app.htmlInjectOptions)));
        }
        currentAppConfig.htmlInjectOptions = currentAppConfig.htmlInjectOptions || {};

        if (!currentAppConfig.htmlInjectOptions.index &&
            !currentAppConfig.htmlInjectOptions.indexOut &&
            !currentAppConfig.htmlInjectOptions.scriptsOut) {
            let isAspNet = false;
            if (await fs.exists(path.resolve(projectRoot, 'Views'))) {
                const foundPaths = await globPromise('**/*.cshtml',
                    { cwd: path.resolve(projectRoot, 'Views'), noDir: true });
                isAspNet = (foundPaths as string[]).length > 0;
            }
            if (isAspNet) {
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
                const scriptsOutAnswer = await inquirer.prompt([
                    {
                        type: 'confirm',
                        name: 'confirm',
                        message: colorize(`Inject bundled script tags to '${scriptsOutFile}'?`, 'white'),
                        default: true
                    }
                ]);
                if (scriptsOutAnswer.confirm) {
                    hasAnyAnswer = true;
                    currentAppConfig.htmlInjectOptions.scriptsOut = scriptsOutFile;
                }

                const stylesOutAnswer = await inquirer.prompt([
                    {
                        type: 'confirm',
                        name: 'confirm',
                        message: colorize(`Inject bundled style tags to '${stylesOutFile}'?`, 'white'),
                        default: true
                    }
                ]);
                if (stylesOutAnswer.confirm) {
                    hasAnyAnswer = true;
                    currentAppConfig.htmlInjectOptions.stylesOut = stylesOutFile;
                }

                if (scriptsOutAnswer.confirm || stylesOutAnswer.confirm) {
                    const iconsOutAnswer = await inquirer.prompt([
                        {
                            type: 'confirm',
                            name: 'confirm',
                            message: colorize(`Inject generated icon tags to '${iconsOutFile}'?`, 'white'),
                            default: true
                        }
                    ]);
                    if (iconsOutAnswer.confirm) {
                        currentAppConfig.htmlInjectOptions.iconsOut = iconsOutFile;
                    }

                    currentAppConfig.htmlInjectOptions.customTagAttributes = [
                        {
                            tagName: 'link',
                            attribute: {
                                'asp-append-version': true
                            }
                        },
                        {
                            tagName: 'script',
                            attribute: {
                                'asp-append-version': true
                            }
                        }
                    ];
                    if (currentAppConfig.htmlInjectOptions.index) {
                        currentAppConfig.htmlInjectOptions.index = '';
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
                referenceDll: false,
                polyfills: (currentAppConfig.polyfills as string[]).concat(currentAppConfig.platformTarget === 'node'
                    ? []
                    : devBrowserPolyfills)
            },
            prod: {
                moduleReplacements: moduleReplacements
            },
            aot: {},
            universal: {}
        };

    // universal
    if (index > 0 && currentAppConfig.platformTarget === 'node') {
        if ((currentAppConfig.envOverrides as any).universal) {
            (currentAppConfig.envOverrides as any).universal.skip = false;
            currentAppConfig.skip = true;
        }
    }

    // check for one more app
    if (index === 0 && currentAppConfig.platformTarget === 'web') {
        // universal
        const serverMainFiles = [
            'main.server.ts', 'main-server.ts', 'server.main.ts', 'server-main.ts', 'main.node.ts', 'node.main.ts'
        ];
        let foundNextEntry = '';
        for (let mainName of serverMainFiles) {
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
            if (!!answer.confirm) {
                trackInfo.expectedEntryFile = foundNextEntry;
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
