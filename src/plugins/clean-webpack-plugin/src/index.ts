import * as path from 'path';

import { getSystemPath, join, normalize, Path, virtualFs } from '@angular-devkit/core';
import * as denodeify from 'denodeify';
import { pathExists, stat } from 'fs-extra';
import * as glob from 'glob';
import * as minimatch from 'minimatch';
import * as rimraf from 'rimraf';
import { concat, of } from 'rxjs';
import { concatMap, last } from 'rxjs/operators';
import * as webpack from 'webpack';

import { InternalError, InvalidConfigError } from '../../../error-models';
import { AfterEmitCleanOptions, BeforeBuildCleanOptions, CleanOptions } from '../../../interfaces';
import { isGlob, isInFolder, isSamePaths, Logger, LoggerOptions, normalizeRelativePath } from '../../../utils';

const globPromise = denodeify(glob) as (pattern: string, options?: glob.IOptions) => Promise<string[]>;

export interface CleanWebpackPluginOptions extends CleanOptions {
    workspaceRoot: string;
    outputPath?: string;
    forceCleanToDisk?: boolean;
    persistedOutputFileSystemNames?: string[];
    host?: virtualFs.Host<any>;
    loggerOptions?: LoggerOptions;
}

export class CleanWebpackPlugin {
    private readonly _options: CleanWebpackPluginOptions;
    private readonly _logger: Logger;
    private readonly _persistedOutputFileSystemNames = ['NodeOutputFileSystem'];
    private _beforeRunCleaned = false;
    private _afterEmitCleaned = false;
    private _isPersistedOutputFileSystem = true;

    get name(): string {
        return 'clean-webpack-plugin';
    }

    constructor(options: CleanWebpackPluginOptions) {
        if (!options) {
            throw new InternalError(`[${this.name}] The 'options' can't be null or empty.`);
        }

        this._options = options;

        this._logger = new Logger({ name: `[${this.name}]`, ...this._options.loggerOptions });

        if (this._options.persistedOutputFileSystemNames && this._options.persistedOutputFileSystemNames.length) {
            this._options.persistedOutputFileSystemNames
                .filter(pfs => !this._persistedOutputFileSystemNames.includes(pfs))
                .forEach(pfs => this._persistedOutputFileSystemNames.push(pfs));
        }
    }

    apply(compiler: webpack.Compiler): void {
        let outputPath = this._options.outputPath;
        if (!outputPath && compiler.options.output && compiler.options.output.path) {
            outputPath = compiler.options.output.path;
        }

        const workspaceRoot = this._options.workspaceRoot;

        if (!this._persistedOutputFileSystemNames.includes(compiler.outputFileSystem.constructor.name)) {
            this._isPersistedOutputFileSystem = false;
        }

        const beforeRunCleanTaskFn = (_: any, cb: (err?: Error) => void) => {
            const startTime = Date.now();

            if (this._beforeRunCleaned || !this._options.beforeBuild) {
                return cb();
            }

            const beforeBuildOptions = this._options.beforeBuild as BeforeBuildCleanOptions;

            if (!beforeBuildOptions.cleanOutDir &&
                (!beforeBuildOptions.paths || (beforeBuildOptions.paths && !beforeBuildOptions.paths.length))) {
                this._beforeRunCleaned = true;

                return cb();
            }

            if (!outputPath || outputPath === '/' || !path.isAbsolute(outputPath)) {
                throw new InternalError(
                    `[${this.name}] Absolute output path must be specified at webpack config -> output -> path.`);
            }

            this._logger.debug('The before build cleaning started');

            if (!this._isPersistedOutputFileSystem && !this._options.forceCleanToDisk && !this._options.host) {
                this._logger.debug(
                    `No persisted output file system: '${compiler.outputFileSystem.constructor.name}', skipping`);

                this._beforeRunCleaned = true;

                return cb();
            }

            this.cleanTask(beforeBuildOptions, outputPath, workspaceRoot)
                .then(() => {
                    this._beforeRunCleaned = true;
                    const duration = Date.now() - startTime;

                    this._logger.debug(`The before build cleaning completed in [${duration}ms]`);

                    return cb();
                })
                .catch(err => cb(err));
        };

        const afterEmitCleanTaskFn = (_: any, cb: (err?: Error) => void) => {
            const startTime = Date.now();

            if (this._afterEmitCleaned || !this._options.afterEmit) {
                return cb();
            }

            const afterEmitOptions = this._options.afterEmit as AfterEmitCleanOptions;

            if (!afterEmitOptions.paths || (afterEmitOptions.paths && !afterEmitOptions.paths.length)) {
                this._afterEmitCleaned = true;

                return cb();
            }

            if (!this._isPersistedOutputFileSystem && !this._options.forceCleanToDisk && !this._options.host) {
                this._logger.debug(
                    `No persisted output file system: '${compiler.outputFileSystem.constructor.name}', skipping`);

                this._afterEmitCleaned = true;

                return cb();
            }

            if (!outputPath || outputPath === '/' || !path.isAbsolute(outputPath)) {
                throw new InternalError(
                    `[${this.name}] Absolute output path must be specified at webpack config -> output -> path.`);
            }

            this._logger.debug('The after emit cleaning started');

            this.cleanTask(afterEmitOptions, outputPath, workspaceRoot)
                .then(() => {
                    const duration = Date.now() - startTime;

                    this._logger.debug(`The after emit cleaning completed in [${duration}ms]`);
                    this._afterEmitCleaned = true;

                    return cb();
                })
                .catch(err => {
                    return cb(err);
                });
        };

        compiler.hooks.beforeRun.tapAsync(this.name, beforeRunCleanTaskFn);
        compiler.hooks.afterEmit.tapAsync(this.name, afterEmitCleanTaskFn);
    }

    private async cleanTask(cleanOptions: BeforeBuildCleanOptions | AfterEmitCleanOptions,
        outputPath: string,
        workspaceRoot: string): Promise<void> {
        const rawPathsToClean: string[] = [];

        if (!outputPath) {
            throw new InternalError("The 'outputPath' options is required.");
        }

        if (!path.isAbsolute(outputPath) || outputPath === '/' || isGlob(outputPath)) {
            throw new InternalError("The absolute path is required for 'outputPath' options.");
        }

        if (isSamePaths(path.parse(outputPath).root, outputPath)) {
            throw new InternalError(
                `The output path must not be the root directory, outputPath: ${outputPath}.`);
        }

        if (isSamePaths(workspaceRoot, outputPath)) {
            throw new InternalError(
                `The output path must not be the workspace root directory, outputPath: ${outputPath}.`);
        }

        if (isInFolder(outputPath, workspaceRoot)) {
            throw new InternalError(
                `The workspace root directory must not be inside the output path, outputPath: ${outputPath}.`);
        }

        if ((cleanOptions as BeforeBuildCleanOptions).cleanOutDir) {
            if (!isInFolder(workspaceRoot, outputPath) && this._options.allowOutsideWorkspaceRoot === false) {
                throw new InternalError(
                    `Cleaning outside of the workspace root directory is disabled, outputPath: ${outputPath}.` +
                    " To enable cleaning, please set 'allowOutsideWorkspaceRoot = true' in clean option.");
            }

            rawPathsToClean.push(outputPath);
            rawPathsToClean.push('**/*');
        }

        if (cleanOptions.paths && cleanOptions.paths.length) {
            cleanOptions.paths.forEach(p => {
                rawPathsToClean.push(p);
            });
        }

        const outputPathFragements: Path[] = [];
        const outputDirFragements: Path[] = [];
        let outputPathFragementsInitialized = false;

        // calculate excludes
        const patternsToExclude: string[] = [];
        const pathsToExclude: string[] = [];
        const existedFilesToExclude: string[] = [];
        const existedDirsToExclude: string[] = [];

        if (cleanOptions.exclude) {
            cleanOptions.exclude.forEach(excludePath => {
                if (isGlob(excludePath)) {
                    if (!patternsToExclude.includes(excludePath)) {
                        patternsToExclude.push(excludePath);
                    }
                } else {
                    const absPath = path.isAbsolute(excludePath)
                        ? path.resolve(excludePath)
                        : path.resolve(outputPath, excludePath);
                    if (!pathsToExclude.includes(absPath)) {
                        pathsToExclude.push(absPath);
                    }
                }
            });
        } else {
            pathsToExclude.push(path.resolve(outputPath, '.gitkeep'));
        }

        if (pathsToExclude.length > 0) {
            await Promise.all(pathsToExclude.map(async (excludePath: string) => {
                if (this._isPersistedOutputFileSystem || this._options.forceCleanToDisk) {
                    const isExists = await pathExists(excludePath);
                    if (isExists) {
                        const statInfo = await stat(excludePath);
                        if (statInfo.isDirectory()) {
                            if (!existedDirsToExclude.includes(excludePath)) {
                                existedDirsToExclude.push(excludePath);
                            }
                        } else {
                            if (!existedFilesToExclude.includes(excludePath)) {
                                existedFilesToExclude.push(excludePath);
                            }
                        }
                    }
                } else if (this._options.host) {
                    const host = this._options.host;
                    const resolvedPath = normalize(excludePath);
                    await host.exists(resolvedPath).pipe(
                        concatMap(exists => {
                            if (exists) {
                                return host.isDirectory(resolvedPath).pipe(concatMap(isDir => {
                                    if (isDir) {
                                        if (!existedDirsToExclude.includes(excludePath)) {
                                            existedDirsToExclude.push(excludePath);
                                        }
                                    } else {
                                        if (!existedFilesToExclude.includes(excludePath)) {
                                            existedFilesToExclude.push(excludePath);
                                        }
                                    }

                                    return of(null);
                                }));
                            } else {
                                return of(null);
                            }
                        }),
                    ).toPromise();
                }
            }));
        }

        if (patternsToExclude.length > 0) {
            if ((this._isPersistedOutputFileSystem || this._options.forceCleanToDisk)) {
                await Promise.all(patternsToExclude.map(async (excludePattern: string) => {
                    const foundExcludePaths =
                        await globPromise(excludePattern, { cwd: outputPath, dot: true, absolute: true });
                    for (const p of foundExcludePaths) {
                        const absPath = path.isAbsolute(p) ? path.resolve(p) : path.resolve(outputPath, p);
                        const statInfo = await stat(absPath);
                        if (statInfo.isDirectory()) {
                            if (!existedDirsToExclude.includes(absPath)) {
                                existedDirsToExclude.push(absPath);
                            }
                        } else {
                            if (!existedFilesToExclude.includes(absPath)) {
                                existedFilesToExclude.push(absPath);
                            }
                        }
                    }
                }));
            } else if (this._options.host) {
                const host = this._options.host;
                if (!outputPathFragementsInitialized) {
                    await this.calculateOutputPathRecursive(host, outputPathFragements, outputDirFragements, normalize(outputPath));
                    outputPathFragementsInitialized = true;
                }

                if (outputPathFragements.length > 0) {
                    for (const p of outputPathFragements) {
                        const sysPath = getSystemPath(p);
                        const absPath = path.isAbsolute(sysPath)
                            ? path.resolve(sysPath)
                            : path.resolve(outputPath, sysPath);
                        const relToOutDir = normalizeRelativePath(path.relative(outputPath, absPath));

                        if (relToOutDir) {
                            let il = patternsToExclude.length;
                            let found = false;

                            while (il--) {
                                const ignoreGlob = patternsToExclude[il];
                                if (minimatch(relToOutDir, ignoreGlob, { dot: true, matchBase: true })) {
                                    found = true;
                                    break;
                                }
                            }

                            if (found) {
                                if (outputDirFragements.includes(p)) {
                                    if (!existedDirsToExclude.includes(absPath)) {
                                        existedDirsToExclude.push(absPath);
                                    }
                                } else {
                                    if (!existedFilesToExclude.includes(absPath)) {
                                        existedFilesToExclude.push(absPath);
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        const pathsToClean: string[] = [];

        await Promise.all(rawPathsToClean.map(async (cleanPattern: string) => {
            if (!isGlob(cleanPattern)) {
                const absolutePath = path.isAbsolute(cleanPattern)
                    ? path.resolve(cleanPattern)
                    : path.resolve(outputPath, cleanPattern);

                if (!pathsToClean.includes(absolutePath)) {
                    pathsToClean.push(absolutePath);
                }
            } else {
                if (this._isPersistedOutputFileSystem || this._options.forceCleanToDisk) {
                    const foundPaths =
                        await globPromise(cleanPattern, { cwd: outputPath, dot: true });
                    foundPaths.forEach(p => {
                        const absolutePath = path.isAbsolute(p)
                            ? path.resolve(p)
                            : path.resolve(outputPath, p);
                        if (!pathsToClean.includes(absolutePath)) {
                            pathsToClean.push(absolutePath);
                        }
                    });
                } else if (this._options.host) {
                    const host = this._options.host;

                    if (!outputPathFragementsInitialized) {
                        await this.calculateOutputPathRecursive(host, outputPathFragements, outputDirFragements, normalize(outputPath));
                        outputPathFragementsInitialized = true;
                    }

                    if (outputPathFragements.length > 0) {
                        outputPathFragements.forEach(p => {
                            const sysPath = getSystemPath(p);
                            const absPath = path.isAbsolute(sysPath)
                                ? path.resolve(sysPath)
                                : path.resolve(outputPath, sysPath);
                            const relToOutDir = normalizeRelativePath(path.relative(outputPath, absPath));
                            if (relToOutDir) {
                                if (minimatch(relToOutDir, cleanPattern, { dot: true, matchBase: true })) {
                                    if (!pathsToClean.includes(absPath)) {
                                        pathsToClean.push(absPath);
                                    }
                                }
                            }
                        });
                    }
                }
            }
        }));

        for (const pathToClean of pathsToClean) {
            if (existedFilesToExclude.includes(pathToClean) ||
                existedDirsToExclude.includes(pathToClean) ||
                pathsToExclude.includes(pathToClean) ||
                existedDirsToExclude.find(e => isInFolder(e, pathToClean))) {
                continue;
            }

            const relToOutDir = normalizeRelativePath(path.relative(outputPath, pathToClean));
            if (relToOutDir) {
                let il = patternsToExclude.length;
                let foundExclude = false;
                while (il--) {
                    const ignoreGlob = patternsToExclude[il];
                    if (minimatch(relToOutDir, ignoreGlob, { dot: true, matchBase: true })) {
                        foundExclude = true;
                        break;
                    }
                }

                if (foundExclude) {
                    continue;
                }
            }

            const isDirectory = path.extname(pathToClean) === '';
            if (isDirectory &&
                (existedFilesToExclude.find(e => isInFolder(pathToClean, e)) ||
                    existedDirsToExclude.find(e => isInFolder(pathToClean, e)))) {
                continue;
            }

            // validation
            if (!isSamePaths(pathToClean, outputPath)) {
                if (isSamePaths(path.parse(pathToClean).root, pathToClean)) {
                    throw new InvalidConfigError(
                        `Cleaning the root directory is not permitted, path: ${pathToClean}.`);
                }

                if (workspaceRoot && isInFolder(pathToClean, workspaceRoot)) {
                    throw new InvalidConfigError(
                        `The workspace root path must not be inside the path to be deleted, path: ${pathToClean
                        }, context: ${
                        workspaceRoot}.`);
                }

                if (workspaceRoot && isSamePaths(pathToClean, workspaceRoot)) {
                    throw new InvalidConfigError(
                        `The path to be deleted must not be the same as workspace root path, path: ${outputPath
                        }, context: ${
                        workspaceRoot}.`);
                }

                if (!isInFolder(workspaceRoot, pathToClean) && this._options.allowOutsideWorkspaceRoot === false) {
                    throw new InternalError(
                        `Cleaning outside of the workspace root directory is disabled, outputPath: ${pathToClean
                        }.` +
                        " To enable cleaning, please set 'allowOutsideWorkspaceRoot = true' in clean option.");
                }

                if ((!isInFolder(outputPath, pathToClean) || isSamePaths(outputPath, pathToClean)) &&
                    !this._options.allowOutsideOutDir) {
                    throw new InvalidConfigError(
                        `By default, cleaning outside of output directory is disabled, path to clean: ${pathToClean
                        }.` +
                        " To enable cleaning, please set 'allowOutsideOutDir = true' in clean option.");
                }
            }

            const relToWorkspace = normalizeRelativePath(path.relative(workspaceRoot, pathToClean));

            if (this._options.host) {
                const host = this._options.host;
                const resolvedPath = normalize(pathToClean);

                await host.exists(resolvedPath).pipe(
                    concatMap(exists => {
                        if (exists) {

                            this._logger.debug(`Deleting ${relToWorkspace}`);

                            return concat(host.delete(resolvedPath), of(null)).pipe(last());
                        } else {
                            return of(null);
                        }
                    }),
                ).toPromise();
            } else if (this._isPersistedOutputFileSystem || this._options.forceCleanToDisk) {
                const exists = await pathExists(pathToClean);
                if (exists) {
                    this._logger.debug(`Deleting ${relToWorkspace}`);

                    await new Promise((resolve: any, reject: any) => rimraf(pathToClean,
                        (err: Error) => err ? reject(err) : resolve())
                    );
                }
            }
        }
    }

    private async calculateOutputPathRecursive(host: virtualFs.Host<any>,
        pathFragements: Path[], dirFragements: Path[], basePath: Path): Promise<void> {
        const paths = await host.list(basePath).toPromise();
        for (const p of paths) {
            const resolvedPath = join(basePath, p);
            pathFragements.push(resolvedPath);
            const isDir = await host.isDirectory(resolvedPath).toPromise();
            if (isDir) {
                dirFragements.push(resolvedPath);
                await this.calculateOutputPathRecursive(host, pathFragements, dirFragements, resolvedPath);
            }
        }
    }
}
