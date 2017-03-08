// Fork from angular-cli
export class StaticAssetWebpackPlugin {

    constructor(private readonly name: string, private readonly contents: string) { }

    apply(compiler: any): void {
        compiler.plugin('emit', (compilation: any, cb: Function) => {
            compilation.assets[this.name] = {
                size: () => this.contents.length,
                source: () => this.contents
            };
            cb();
        });
    }
}
