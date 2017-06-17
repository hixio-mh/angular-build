import * as path from 'path';
import { CliOptions } from '../cli-options';

import { getAoTGenDir, prepareBuildOptions, prepareAngularBuildConfig, readAngularBuildConfig } from '../../helpers';
import { BuildOptions, ProjectConfig } from '../../models';
import { clean, colorize, Logger } from '../../utils';
import { getWebpackConfig } from '../../webpack-configs';

import { buildLib } from './build-lib';
import { webpackBundle } from './webpack-bundle';

export async function build(cliOptions: CliOptions, logger: Logger = new Logger()): Promise<number> {
    try {
        await buildInternal(cliOptions, logger);
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

async function buildInternal(cliOptions: CliOptions, logger: Logger = new Logger()): Promise<any> {
    logger.logLine(`\n${colorize(
        `angular-build ${cliOptions.cliVersion} [${cliOptions.cliIsLocal ? 'Local' : 'Global'}]`,
        'green')}`);

    cliOptions.cwd = cliOptions.cwd ? path.resolve(cliOptions.cwd) : process.cwd();
    let cleanOutDir = false;
    const projectRoot = cliOptions.cwd;
    let angularBuildConfigPath = path.resolve(projectRoot, 'angular-build.json');
    const cliBuildOptions: any = {};

    if (cliOptions.commandOptions && cliOptions.commandOptions.p) {
        angularBuildConfigPath = path.isAbsolute(cliOptions.commandOptions.p)
            ? path.resolve(cliOptions.commandOptions.p)
            : path.resolve(projectRoot, cliOptions.commandOptions.p);
    }

    const angularBuildConfig = await readAngularBuildConfig(angularBuildConfigPath);

    if (cliOptions.commandOptions && typeof cliOptions.commandOptions === 'object') {
        cleanOutDir = (cliOptions.commandOptions as any).clean;

        const buildOptionsSchema = (angularBuildConfig as any).schema.definitions.BuildOptions.properties;
        Object.keys(cliOptions.commandOptions)
            .filter((key: string) => buildOptionsSchema[key] &&
                typeof (cliOptions as any).commandOptions[key] !== 'undefined' &&
                (cliOptions as any).commandOptions[key] !== 'clean' &&
                (cliOptions as any).commandOptions[key] !== null &&
                (cliOptions as any).commandOptions[key] !== '')
            .forEach((key: string) => {
                cliBuildOptions[key] = (cliOptions as any).commandOptions[key];
            });
    }

    cliBuildOptions.cliIsLocal = cliOptions.cliIsLocal;


    const buildOptions: BuildOptions = Object.assign({}, cliBuildOptions);
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
            // clean outDir
            if (cleanOutDir) {
                await cleanOutDirs(projectRoot, libConfig, buildOptions, logger);
            }

            // bundle
            await buildLib(projectRoot, libConfig, buildOptions, angularBuildConfig, cliOptions.cliIsLocal, logger);
        }
    }

    // build apps
    if (appConfigs.length) {
        const webpackIsGlobal = !cliOptions.cliIsLocal;
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
        const webpackConfigs = filteredAppConfigs.map((projectConfig: ProjectConfig) => getWebpackConfig({
            projectRoot,
            projectConfig,
            buildOptions,
            angularBuildConfig,
            logger,
            webpackIsGlobal
        }));
        if (!webpackConfigs || webpackConfigs.length === 0) {
            throw new Error('No webpack config available.');
        }
        const firstConfig = Array.isArray(webpackConfigs) ? webpackConfigs[0] : webpackConfigs;
        const watch = cliOptions.commandOptions.watch || firstConfig.watch;
        if (watch || !Array.isArray(webpackConfigs)) {
            // clean outDir
            if (cleanOutDir) {
                await cleanOutDirs(projectRoot, filteredAppConfigs[0], buildOptions, logger);
            }

            await webpackBundle(webpackConfigs, buildOptions, watch, webpackWatchOptions, logger);
        } else {
            for (let i = 0; i < webpackConfigs.length; i++) {
                const mappedAppConfig = filteredAppConfigs[i];
                const webpackConfig = webpackConfigs[i];

                // clean outDir
                if (cleanOutDir) {
                    await cleanOutDirs(projectRoot, mappedAppConfig, buildOptions, logger);
                }

                await webpackBundle(webpackConfig, buildOptions, watch, webpackWatchOptions, logger);
            }
        }
    }
}

async function cleanOutDirs(projectRoot: string,
    projectConfig: ProjectConfig,
    buildOptions: BuildOptions,
    logger: Logger): Promise<any> {
    const srcDir = path.resolve(projectRoot, projectConfig.srcDir);
    const outDir = path.resolve(projectRoot, projectConfig.outDir);

    if (outDir !== srcDir && outDir !== projectRoot) {
        logger.logLine(`\nCleaning ${outDir}`);
        if (/wwwroot$/g.test(outDir)) {
            await clean(outDir + '/**/*');
        } else {
            await clean(outDir);
        }
    }

    if (projectConfig.tsconfig) {
        const tsConfigPath = path.resolve(projectRoot, projectConfig.srcDir || '', projectConfig.tsconfig);
        const aotGenDir = await getAoTGenDir(tsConfigPath);
        if (buildOptions.environment &&
            buildOptions.environment.aot &&
            aotGenDir &&
            aotGenDir !== srcDir &&
            aotGenDir !== projectRoot) {
            await clean(aotGenDir);
        }
    }
}