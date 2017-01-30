export interface AddFileDepsPluginOptions {
  fileDependencies: string[];
}

export class AddFileDepsWebpackPlugin {
  constructor(public options: AddFileDepsPluginOptions) {
  }

  apply(compiler: any) : void{
    compiler.plugin('emit', (compilation: any, callback: any) => {
      if (this.options && this.options.fileDependencies && this.options.fileDependencies.length > 0) {
        this.options.fileDependencies.forEach((fileDep: string) => {
          compilation.fileDependencies.push(fileDep);
        });
      }
      callback();
    });
  }
}