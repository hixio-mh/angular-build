import * as webpack from 'webpack';

export class AddStaticAssetWebpackPlugin {

    constructor(private readonly name: string, private readonly content: string) { }

    apply(compiler: webpack.Compiler): void {
        compiler.plugin('emit', (compilation: any, cb: Function) => {
            compilation.assets[this.name] = {
                size: () => this.content.length,
                source: () => this.content
            };
            cb();
        });
    }
}
