// Add assets from `ConcatPlugin` to index.html.
// Ref: angular-cli - https://github.com/angular/angular-cli

export class InsertConcatAssetsWebpackPlugin {

    constructor(private readonly entryNames: string[]) { }

    apply(compiler: any): void {
        compiler.plugin('compilation', (compilation: any) => {
            compilation.plugin('html-webpack-plugin-before-html-generation',
                (htmlPluginData: any, callback: any) => {

                    const fileNames = this.entryNames.map((entryName) => {
                        const fileName = htmlPluginData.assets.webpackConcat
                            && htmlPluginData.assets.webpackConcat[entryName];

                        if (!fileName) {
                            // Something went wrong and the asset was not correctly added.
                            throw new Error(`Cannot find file for ${entryName} script.`);
                        }

                        return fileName;
                    });

                    htmlPluginData.assets.js.splice(0, 0, ...fileNames);
                    callback(null, htmlPluginData);
                });
        });
    }
}
