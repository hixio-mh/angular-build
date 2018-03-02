/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { Compiler, loader } from 'webpack';
import { CachedSource, ConcatSource, OriginalSource, RawSource, Source } from 'webpack-sources';
import { interpolateName } from 'loader-utils';
import * as path from 'path';

const Chunk = require('webpack/lib/Chunk');
const EntryPoint = require('webpack/lib/Entrypoint');

export interface ScriptsWebpackPluginOptions {
    name: string;
    scripts: string[];
    filename: string;
    context: string;
    sourceMap?: boolean;
}

interface ScriptOutput {
    filename: string;
    source: CachedSource;
}

function addDependencies(compilation: any, scripts: string[]): void {
    if (compilation.fileDependencies.add) {
        // Webpack 4+ uses a Set
        for (const script of scripts) {
            compilation.fileDependencies.add(script);
        }
    } else {
        // Webpack 3
        compilation.fileDependencies.push(...scripts);
    }
}

function hook(compiler: any, action: (compilation: any, callback: (err?: Error) => void) => void): void {
    if (compiler.hooks) {
        // Webpack 4
        compiler.hooks.thisCompilation.tap('scripts-webpack-plugin', (compilation: any) => {
            compilation.hooks.additionalAssets.tapAsync(
                'scripts-webpack-plugin',
                (callback: (err?: Error) => void) => action(compilation, callback),
            );
        });
    } else {
        // Webpack 3
        compiler.plugin('this-compilation', (compilation: any) => {
            compilation.plugin(
                'additional-assets',
                (callback: (err?: Error) => void) => action(compilation, callback),
            );
        });
    }
}

export class ScriptsWebpackPlugin {
    private _lastBuildTime?: number;
    private _cachedOutput?: ScriptOutput;

    constructor(private readonly _options: ScriptsWebpackPluginOptions) { }

    apply(compiler: Compiler): void {
        if (!this._options.scripts || this._options.scripts.length === 0) {
            return;
        }

        const scripts = this._options.scripts
            .filter(script => !!script);

        hook(compiler, (compilation, callback) => {
            if (this.shouldSkip(compilation, scripts)) {
                if (this._cachedOutput) {
                    this.insertOutput(compilation, this._cachedOutput, true);
                }

                addDependencies(compilation, scripts);
                callback();

                return;
            }

            const sourceGetters = scripts.map(fullPath => {
                return new Promise<Source>((resolve, reject) => {
                    compilation.inputFileSystem.readFile(fullPath, (err: Error, data: Buffer) => {
                        if (err) {
                            reject(err);
                            return;
                        }

                        const content = data.toString();

                        let source: any;
                        if (this._options.sourceMap) {
                            // TODO: Look for source map file (for '.min' scripts, etc.)

                            let adjustedPath = fullPath;
                            if (this._options.context) {
                                adjustedPath = path.relative(this._options.context, fullPath);
                            }
                            source = new OriginalSource(content, adjustedPath);
                        } else {
                            source = new RawSource(content);
                        }

                        resolve(source);
                    });
                });
            });

            Promise.all(sourceGetters)
                .then(sources => {
                    const concatSource = new ConcatSource();
                    sources.forEach(source => {
                        concatSource.add(source);
                        concatSource.add('\n;');
                    });

                    const combinedSource = new CachedSource(concatSource);
                    const filename = interpolateName(
                        { resourcePath: 'scripts.js' } as loader.LoaderContext,
                        this._options.filename,
                        { content: combinedSource.source() },
                    );

                    const output = { filename, source: combinedSource };
                    this.insertOutput(compilation, output);
                    this._cachedOutput = output;
                    addDependencies(compilation, scripts);

                    callback();
                })
                .catch((err: Error) => callback(err));
        });
    }


    private shouldSkip(compilation: any, scripts: string[]): boolean {
        if (this._lastBuildTime == null) {
            this._lastBuildTime = Date.now();
            return false;
        }

        for (let i = 0; i < scripts.length; i++) {
            let scriptTime: any;
            if (compilation.fileTimestamps.get) {
                // Webpack 4+ uses a Map
                scriptTime = compilation.fileTimestamps.get(scripts[i]);
            } else {
                // Webpack 3
                scriptTime = compilation.fileTimestamps[scripts[i]];
            }
            if (!scriptTime || scriptTime > this._lastBuildTime) {
                this._lastBuildTime = Date.now();
                return false;
            }
        }

        return true;
    }

    private insertOutput(compilation: any, { filename, source }: ScriptOutput, cached: boolean = false): void {
        const chunk = new Chunk(this._options.name);
        chunk.rendered = !cached;
        chunk.id = this._options.name;
        chunk.ids = [chunk.id];
        chunk.files.push(filename);

        const entrypoint = new EntryPoint(this._options.name);
        entrypoint.pushChunk(chunk);

        compilation.entrypoints.set(this._options.name, entrypoint);
        compilation.chunks.push(chunk);
        compilation.assets[filename] = source;
    }
}
