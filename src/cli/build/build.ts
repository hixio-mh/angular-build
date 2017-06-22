import * as fs from 'fs-extra';
import * as path from 'path';
import { CliOptions } from '../cli-options';

import { getAoTGenDir, prepareAngularBuildConfig, prepareBuildOptions, readAngularBuildConfig } from '../../helpers';
import { BuildOptions, ProjectConfig } from '../../models';
import { clean, colorize, Logger } from '../../utils';
import { getWebpackConfig } from '../../webpack-configs';

import { buildLib } from './build-lib';
import { webpackBundle } from './webpack-bundle';

export async function cliBuild(cliOptions: CliOptions, logger: Logger = new Logger()): Promise<number> {
    try {
        logger.logLine(`\n${colorize(
            `angular-build ${cliOptions.cliVersion} [${cliOptions.cliIsLocal ? 'Local' : 'Global'}]`,
            'green')}`);

        cliOptions.cwd = cliOptions.cwd ? path.resolve(cliOptions.cwd) : process.cwd();
        let projectRoot = cliOptions.cwd;
        const buildOptions: any = {};

        if (cliOptions.commandOptions && cliOptions.commandOptions.p) {
            projectRoot = path.isAbsolute(cliOptions.commandOptions.p)
                ? path.resolve(cliOptions.commandOptions.p)
                : path.resolve(cliOptions.cwd, cliOptions.commandOptions.p);
        }

        if (cliOptions.commandOptions && typeof cliOptions.commandOptions === 'object') {
            const commandOptions = cliOptions.commandOptions as any;

            // const buildOptionsSchema = schema.definitions.BuildOptions.properties;
            Object.keys(cliOptions.commandOptions)
                .filter((key: string) => typeof commandOptions[key] !== 'undefined' &&
                    commandOptions[key] !== null)
                .forEach((key: string) => {
                    buildOptions[key] = commandOptions[key];
                });

            if (typeof commandOptions.clean === 'boolean') {
                buildOptions.clean = commandOptions.clean;
            }
            if (typeof commandOptions.progress === 'boolean') {
                buildOptions.progress = commandOptions.progress;
            }
            if (typeof commandOptions.profile === 'boolean') {
                buildOptions.profile = commandOptions.profile;
            }
            if (typeof commandOptions.watch === 'boolean') {
                buildOptions.watch = commandOptions.watch;
            }
            if (typeof commandOptions.env === 'object') {
                buildOptions.environment = Object.assign(buildOptions.environment || {}, commandOptions.env);
            }
            if (typeof commandOptions.environment === 'object') {
                buildOptions.environment = Object.assign(buildOptions.environment || {}, commandOptions.environment);
            }
        }

        buildOptions.cliIsLocal = cliOptions.cliIsLocal;
        buildOptions.isAngularBuildCli = true;

        await build(projectRoot, buildOptions, logger);
    } catch (err) {
        if (err) {
            logger.errorLine(`An error occured during the build:\n${(err.stack) || err}${err.details
                ? `\n\nError details:\n${err.details}`
                : ''}`);
        }

        return -1;
    }

    return 0;
}

export async function build(projectRoot: string,
    buildOptions: BuildOptions,
    logger: Logger = new Logger()): Promise<any> {
    let angularBuildConfigPath = path.resolve(projectRoot, 'angular-build.json');
    const angularBuildConfig = await readAngularBuildConfig(angularBuildConfigPath);
    buildOptions = buildOptions || {};

    // merge buildOptions
    if (angularBuildConfig.buildOptions) {
        Object.keys(angularBuildConfig.buildOptions)
            .filter((key: string) => !(key in buildOptions) &&
                typeof (angularBuildConfig.buildOptions as any)[key] !== 'undefined')
            .forEach((key: string) => {
                (buildOptions as any)[key] = (angularBuildConfig.buildOptions as any)[key];
            });
    }
    prepareBuildOptions(buildOptions);
    prepareAngularBuildConfig(projectRoot, angularBuildConfig, buildOptions);

    const libConfigs = angularBuildConfig.libs || [];
    const appConfigs = angularBuildConfig.apps || [];

    // filter
    const filterProjects: string[] = [];
    if (buildOptions.filter) {
        filterProjects.push(...Array.isArray(buildOptions.filter) ? buildOptions.filter : [buildOptions.filter]);
    }

    if (appConfigs.length === 0 && libConfigs.length === 0) {
        throw new Error('No project config is available.');
    }

    // build libs
    if (libConfigs.length) {
        const filteredLibConfigs = libConfigs
            .filter((projectConfig: ProjectConfig) =>
                !projectConfig.skip &&
                (filterProjects.length === 0 ||
                    (filterProjects.length > 0 &&
                        projectConfig.name &&
                        filterProjects.indexOf(projectConfig.name) > -1)));

        for (let libConfig of filteredLibConfigs) {
            // validation
            await validateProjectConfig(projectRoot, libConfig);

            // clean outDir
            if ((buildOptions as any).clean) {
                await cleanOutDirs(projectRoot, libConfig, buildOptions, logger);
            }

            // build lib
            await buildLib(projectRoot,
                libConfig,
                buildOptions,
                angularBuildConfig,
                logger);
        }
    }

    // build apps
    if (appConfigs.length) {
        const webpackWatchOptions = angularBuildConfig && angularBuildConfig.webpackWatchOptions
            ? angularBuildConfig.webpackWatchOptions
            : {};

        const filteredAppConfigs = appConfigs
            .filter((projectConfig: ProjectConfig) =>
                !projectConfig.skip &&
                (filterProjects.length === 0 ||
                    (filterProjects.length > 0 &&
                        projectConfig.name &&
                        filterProjects.indexOf(projectConfig.name) > -1)));

        for (let appConfig of filteredAppConfigs) {
            // validation
            await validateProjectConfig(projectRoot, appConfig);

            // clean outDir
            if ((buildOptions as any).clean) {
                await cleanOutDirs(projectRoot, appConfig, buildOptions, logger);
            }
        }

        const webpackConfigs = filteredAppConfigs.map((projectConfig: ProjectConfig) => getWebpackConfig({
            projectRoot,
            projectConfig,
            buildOptions,
            angularBuildConfig,
            logger
        }));

        if (!webpackConfigs || webpackConfigs.length === 0) {
            throw new Error('No webpack config available.');
        }

        const firstConfig = Array.isArray(webpackConfigs) ? webpackConfigs[0] : webpackConfigs;
        const watch = (buildOptions as any).watch || firstConfig.watch;
        if (watch || !Array.isArray(webpackConfigs)) {
            await webpackBundle(webpackConfigs, buildOptions, watch, webpackWatchOptions, logger);
        } else {
            for (let i = 0; i < webpackConfigs.length; i++) {
                const webpackConfig = webpackConfigs[i];
                await webpackBundle(webpackConfig, buildOptions, watch, webpackWatchOptions, logger);
            }
        }
    }
}

async function validateProjectConfig(projectRoot: string, projectConfig: ProjectConfig): Promise<any> {
    if (projectConfig.srcDir && path.isAbsolute(projectConfig.srcDir)) {
        throw new Error(`The 'srcDir' must be relative path to project root.`);
    }
    if (projectConfig.outDir && path.isAbsolute(projectConfig.outDir)) {
        throw new Error(`The 'outDir' must be relative path to project root.`);
    }

    const srcDir = path.resolve(projectRoot, projectConfig.srcDir || '');
    if (!await fs.exists(srcDir)) {
        throw new Error(`The 'srcDir' - ${srcDir} doesn't exist.`);
    }

    if (projectConfig.entry && path.isAbsolute(projectConfig.entry)) {
        throw new Error(`The 'entry' must be relative path to 'srcDir' in project config.`);
    }

    if (projectConfig.outDir) {
        const outDir = path.isAbsolute(projectConfig.outDir)
            ? projectConfig.outDir
            : path.resolve(projectRoot, projectConfig.outDir);

        if (outDir === projectRoot) {
            throw new Error(`The 'outDir' and 'projectRoot' must NOT be the same folder.`);
        }
        if (outDir === srcDir) {
            throw new Error(`The 'outDir' and 'srcDir' must NOT be the same folder.`);
        }
        if (outDir === path.parse(outDir).root || outDir === '.') {
            throw new Error(`The 'outDir' must NOT be root folder: ${path.parse(outDir).root}.`);
        }

        const srcDirHomeRoot = path.parse(srcDir).root;
        if (outDir === srcDirHomeRoot) {
            throw new Error(`The 'outDir' must NOT be 'srcDir''s root folder: ${srcDirHomeRoot}.`);
        }

        let tempSrcDir = srcDir;
        let prevTempSrcDir = '';
        while (tempSrcDir && tempSrcDir !== srcDirHomeRoot && tempSrcDir !== '.' && tempSrcDir !== prevTempSrcDir) {
            prevTempSrcDir = tempSrcDir;
            tempSrcDir = path.dirname(tempSrcDir);
            if (outDir === tempSrcDir) {
                throw new Error(`The 'srcDir' must NOT be inside 'outDir'.`);
            }
        }
    }
}

async function cleanOutDirs(projectRoot: string,
    projectConfig: ProjectConfig,
    buildOptions: BuildOptions,
    logger: Logger): Promise<any> {
    if (!projectConfig.outDir) {
        return;
    }

    const srcDir = path.resolve(projectRoot, projectConfig.srcDir || '');
    const outDir = path.isAbsolute(projectConfig.outDir)
        ? projectConfig.outDir
        : path.resolve(projectRoot, projectConfig.outDir);

    if (outDir === projectRoot) {
        throw new Error(`The 'outDir' and 'projectRoot' must NOT be the same folder.`);
    }
    if (outDir === srcDir) {
        throw new Error(`The 'outDir' and 'srcDir' must NOT be the same folder.`);
    }
    if (outDir === path.parse(outDir).root || outDir === '.') {
        throw new Error(`The 'outDir' must NOT be root folder: ${path.parse(outDir).root}.`);
    }

    const srcDirHomeRoot = path.parse(srcDir).root;
    if (outDir === srcDirHomeRoot) {
        throw new Error(`The 'outDir' must NOT be 'srcDir''s root folder: ${srcDirHomeRoot}.`);
    }

    let tempSrcDir = srcDir;
    let prevTempSrcDir = '';
    while (tempSrcDir && tempSrcDir !== srcDirHomeRoot && tempSrcDir !== '.' && tempSrcDir !== prevTempSrcDir) {
        prevTempSrcDir = tempSrcDir;
        tempSrcDir = path.dirname(tempSrcDir);
        if (outDir === tempSrcDir) {
            throw new Error(`The 'srcDir' must NOT be inside 'outDir'.`);
        }
    }

    logger.logLine(`Cleaning ${outDir}`);
    if (/wwwroot$/g.test(outDir)) {
        await clean(path.join(outDir, '**/*'));
    } else {
        await clean(outDir);
    }

    if (projectConfig.tsconfig) {
        const tsConfigPath = path.resolve(projectRoot, projectConfig.srcDir || '', projectConfig.tsconfig);
        if (!await fs.exists(tsConfigPath)) {
            return;
        }

        const aotGenDir = await getAoTGenDir(tsConfigPath);
        if (buildOptions.environment &&
            buildOptions.environment.aot &&
            aotGenDir &&
            aotGenDir !== srcDir &&
            aotGenDir !== projectRoot) {

            if (aotGenDir === path.parse(aotGenDir).root || aotGenDir === '.') {
                throw new Error(`The aot 'genDir' must NOT be root folder: ${path.parse(aotGenDir).root}.`);
            }

            tempSrcDir = srcDir;
            prevTempSrcDir = '';
            while (tempSrcDir && tempSrcDir !== srcDirHomeRoot && tempSrcDir !== '.' && tempSrcDir !== prevTempSrcDir) {
                prevTempSrcDir = tempSrcDir;
                tempSrcDir = path.dirname(tempSrcDir);
                if (aotGenDir === tempSrcDir) {
                    throw new Error(`The 'srcDir' must NOT be inside aot 'genDir'.`);
                }
            }
            await clean(aotGenDir);
        }
    }
}
