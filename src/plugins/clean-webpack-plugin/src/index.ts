import * as path from 'path';

import * as denodeify from 'denodeify';
import * as glob from 'glob';
import * as minimatch from 'minimatch';
import * as rimraf from 'rimraf';

import { AfterEmitCleanOptions, BeforeRunCleanOptions, CleanOptions, InternalError, InvalidConfigError } from '../../../models';
import { Logger, LoggerOptions } from '../../../utils/logger';
import { isGlob } from '../../../utils/is-glob';
import { isInFolder, isSamePaths, normalizeRelativePath } from '../../../utils/path-helpers';

const globPromise = denodeify(glob) as (pattern: string, options?: glob.IOptions) => Promise<string[]>;

export type CleanWebpackPluginOptions = {
    projectRoot: string;
    outputPath?: string;
    forceCleanToDisk?: boolean;
    persistedOutputFileSystemNames?: string[];
    loggerOptions?: LoggerOptions;
} & CleanOptions;

export class CleanWebpackPlugin {
    private readonly _options: CleanWebpackPluginOptions;
    private readonly _logger: Logger;
    private readonly _persistedOutputFileSystemNames = ['NodeOutputFileSystem'];
    private _beforeRunCleaned = false;
    private _afterEmitCleaned = false;

    get name(): string {
        return 'clean-webpack-plugin';
    }

    constructor(options: CleanWebpackPluginOptions) {
        if (!options) {
            throw new InternalError(`[${this.name}] The 'options' can't be null or empty.`);
        }

        this._options = {
            ...options,
        };

        this._logger = new Logger({ name: `[${this.name}]`, ...this._options.loggerOptions });

        if (this._options.persistedOutputFileSystemNames && this._options.persistedOutputFileSystemNames.length) {
            this._options.persistedOutputFileSystemNames
                .filter(pfs => !this._persistedOutputFileSystemNames.includes(pfs))
                .forEach(pfs => this._persistedOutputFileSystemNames.push(pfs));
        }
    }

    apply(compiler: any): void {
        const outputPath = this._options.outputPath || compiler.outputPath;
        const projectRoot = this._options.projectRoot || process.cwd();

        const beforeRunCleanTaskFn = (_: any, cb: (err?: Error) => void) => {
            const startTime = Date.now();

            if (this._beforeRunCleaned || !this._options.beforeRun) {
                return cb();
            }

            const beforeRunOptions = this._options.beforeRun as BeforeRunCleanOptions;

            if (!beforeRunOptions.cleanOutDir &&
                (!beforeRunOptions.paths || (beforeRunOptions.paths && !beforeRunOptions.paths.length))) {
                this._beforeRunCleaned = true;
                return cb();
            }

            if (!outputPath || outputPath === '/' || !path.isAbsolute(outputPath)) {
                throw new InternalError(
                    `[${this.name}] Absolute output path must be specified at webpack config -> output -> path.`);
            }

            this._logger.debug('The before run cleaning started');

            if (!this._persistedOutputFileSystemNames.includes(compiler.outputFileSystem.constructor.name) &&
                !this._options.forceCleanToDisk) {
                this._logger.debug(
                    `No persisted output file system: '${compiler.outputFileSystem.constructor.name}', skipping`);
                this._beforeRunCleaned = true;
                return cb();
            }

            this.cleanTask(beforeRunOptions, outputPath, projectRoot)
                .then(() => {
                    this._beforeRunCleaned = true;
                    const duration = Date.now() - startTime;

                    this._logger.debug(`The before run cleaning completed in [${duration}ms]`);
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

            if (!this._persistedOutputFileSystemNames.includes(compiler.outputFileSystem.constructor.name) &&
                !this._options.forceCleanToDisk) {
                this._afterEmitCleaned = true;
                return cb();
            }

            this._logger.debug('The after emit cleaning started');

            this.cleanTask(afterEmitOptions, outputPath || '', projectRoot)
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

        const plugin = { name: this.name };
        compiler.hooks.beforeRun.tapAsync(plugin, beforeRunCleanTaskFn);
        compiler.hooks.afterEmit.tapAsync(plugin, afterEmitCleanTaskFn);
    }

    private async cleanTask(cleanOptions: BeforeRunCleanOptions, outputPath: string, projectRoot: string): Promise<void> {
        const cwd = process.cwd();

        const pathsToClean: string[] = [];

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

        if (isSamePaths(cwd, outputPath)) {
            throw new InternalError(
                `The output path must not be the current working directory, outputPath: ${outputPath}.`);
        }

        if (isInFolder(outputPath, cwd)) {
            throw new InternalError(
                `The current working directory must not be inside the output path, outputPath: ${outputPath}.`);
        }

        if (projectRoot && isInFolder(outputPath, projectRoot)) {
            throw new InternalError(
                `The project root path must not be inside the output path, outputPath: ${outputPath}, context: ${
                projectRoot}.`);
        }

        if (projectRoot && isSamePaths(outputPath, projectRoot)) {
            throw new InternalError(
                `The project root path must not be the output directory, outputPath: ${outputPath}, context: ${
                projectRoot}.`);
        }

        if (cleanOptions.cleanOutDir) {
            if (!isInFolder(cwd, outputPath) && this._options.allowOutsideWorkingDir === false) {
                throw new InternalError(
                    `Cleaning outside of the working directory is disabled, outputPath: ${outputPath}.` +
                    " To enable cleaning, please set 'allowOutsideWorkingDir = true' in clean option.");
            }

            pathsToClean.push(path.join(outputPath, '**/*'));
        }

        if (cleanOptions.paths && cleanOptions.paths.length) {
            cleanOptions.paths.forEach(p => {
                pathsToClean.push(p);
            });
        }

        const filesToClean: string[] = [];

        const excludedfiles: string[] = [];
        const excludeFilePaths: string[] = [];
        const excludePatterns: string[] = [];
        const excludes = cleanOptions.exclude || [];
        excludes.forEach(e => {
            if (!isGlob(e)) {
                excludeFilePaths.push(path.isAbsolute(e) ? path.resolve(e) : path.resolve(outputPath, e));
            } else {
                excludePatterns.push(e);
            }
        });

        if (excludes.length) {
            await Promise.all(excludes.map(async (excludePath: string) => {
                const foundExcludePaths =
                    await globPromise(excludePath, { cwd: outputPath, dot: true, absolute: true });
                foundExcludePaths.forEach(p => {
                    const absPath = path.isAbsolute(p) ? path.resolve(p) : path.resolve(outputPath, p);
                    if (!excludeFilePaths.includes(absPath)) {
                        excludeFilePaths.push(absPath);
                    }
                });
            }));
        }

        await Promise.all(pathsToClean.map(async (cleanPattern: string) => {
            const foundPaths =
                await globPromise(cleanPattern, { cwd: outputPath, dot: true });

            foundPaths.forEach((foundPath: string) => {
                const absolutePath = path.isAbsolute(foundPath)
                    ? path.resolve(foundPath)
                    : path.resolve(outputPath, foundPath);
                const relativePath = normalizeRelativePath(path.relative(outputPath, absolutePath));

                if (filesToClean.includes(absolutePath)) {
                    return;
                }

                if (filesToClean.filter(c => isInFolder(c, absolutePath)).length > 0) {
                    return;
                }

                if (!isSamePaths(absolutePath, outputPath)) {
                    if (isSamePaths(path.parse(absolutePath).root, absolutePath)) {
                        throw new InvalidConfigError(
                            `Cleaning the root directory is not permitted, path: ${absolutePath}.`);
                    }

                    if (isInFolder(absolutePath, cwd) || isSamePaths(absolutePath, cwd)) {
                        throw new InvalidConfigError(
                            `The current working directory must not be inside the path to be deleted, path: ${
                            absolutePath
                            }.`);
                    }

                    if (projectRoot && isInFolder(absolutePath, projectRoot)) {
                        throw new InvalidConfigError(
                            `The project root path must not be inside the path to be deleted, path: ${absolutePath
                            }, context: ${
                            projectRoot}.`);
                    }

                    if (projectRoot && isSamePaths(absolutePath, projectRoot)) {
                        throw new InvalidConfigError(
                            `The webpack context path must not be the path to be deleted, path: ${outputPath
                            }, context: ${
                            projectRoot}.`);
                    }

                    if (!isInFolder(cwd, absolutePath) && this._options.allowOutsideWorkingDir === false) {
                        throw new InternalError(
                            `Cleaning outside of the working directory is disabled, outputPath: ${absolutePath}.` +
                            " To enable cleaning, please set 'allowOutsideWorkingDir = true' in clean option.");
                    }

                    if ((!isInFolder(outputPath, absolutePath) || isSamePaths(outputPath, absolutePath)) &&
                        !this._options.allowOutsideOutputDir) {
                        throw new InvalidConfigError(
                            `By default, cleaning outside of output directory is disabled, path to clean: ${absolutePath
                            }.` +
                            " To enable cleaning, please set 'allowOutsideOutputDir = true' in clean option.");
                    }
                }

                if (excludedfiles.includes(absolutePath)) {
                    return;
                }

                if (excludeFilePaths.includes(absolutePath)) {
                    if (!excludedfiles.includes(absolutePath)) {
                        // this.logger.debug(`Skipping delete - ${relativePath}`);
                        excludedfiles.push(absolutePath);
                    }
                    return;
                }

                let il = excludePatterns.length;
                while (il--) {
                    const ignoreGlob = excludePatterns[il];
                    if (minimatch(relativePath, ignoreGlob, { dot: true, matchBase: true })) {
                        if (!excludedfiles.includes(absolutePath)) {
                            // this.logger.debug(`Skipping delete - ${relativePath}`);
                            excludedfiles.push(absolutePath);
                        }
                        return;
                    }
                }

                const isDirectory = path.extname(absolutePath) === '';
                if (isDirectory &&
                    (excludeFilePaths.find(e => isInFolder(absolutePath, e)) ||
                        excludedfiles.find(e => isInFolder(absolutePath, e)))) {
                    if (!excludedfiles.includes(absolutePath)) {
                        // this.logger.debug(`Skipping delete - ${relativePath}`);
                        excludedfiles.push(absolutePath);
                    }
                    return;
                }

                filesToClean.push(absolutePath);
            });
        }));

        if (!filesToClean.length) {
            this._logger.debug('No file to clean');
            return;
        }

        await Promise.all(filesToClean.map(async (f: string) => {
            const fileRel = path.relative(projectRoot, f);
            this._logger.debug(`Deleting ${fileRel}`);

            await new Promise((resolve: any, reject: any) => rimraf(f,
                (err: Error) => err ? reject(err) : resolve())
            );
        }));
    }
}
