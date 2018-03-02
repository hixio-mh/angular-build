// Ref: angular-cli - https://github.com/angular/angular-cli

export interface SuppressEntryChunksWebpackPluginOptions {
    chunks?: string[];
    exclude?: string[];
    supressPattern?: RegExp;
}

export class SuppressEntryChunksWebpackPlugin {
    private readonly _options: SuppressEntryChunksWebpackPluginOptions;

    get name(): string {
        return 'suppress-entry-chunks-webpack-plugin';
    }

    constructor(options: Partial<SuppressEntryChunksWebpackPluginOptions>) {
        this._options = {
            ...options
        };
    }

    apply(compiler: any): void {
        const supressAssetsFn = (compilation: any, cb: any): void => {
            if (!this._options.chunks || !this._options.supressPattern) {
                return cb();
            }

            const options = this._options;

            compilation.chunks.filter((chunk: any) => options.chunks &&
                options.chunks.indexOf(chunk.name) !== -1 &&
                (!options.exclude || !options.exclude.includes(chunk.name)))
                .forEach((chunk: any) => {
                    const newFiles: string[] = [];
                    chunk.files.forEach((file: string) => {
                        if (options.supressPattern && file.match(options.supressPattern)) {
                            delete compilation.assets[file];
                        } else {
                            newFiles.push(file);
                        }
                    });
                    chunk.files = newFiles;
                });

            return cb();
        };

        if (compiler.hooks) {
            const plugin = { name: this.name };
            compiler.hooks.compilation.tap(plugin, (compilation: any) => {
                compilation.hooks.afterSeal.tapAsync(plugin, supressAssetsFn);
            });
        } else {
            compiler.plugin('compilation', (compilation: any) => {
                compilation.plugin('after-seal', supressAssetsFn);
            });
        }
    }
}
