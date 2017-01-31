export interface AddFileDepsPluginOptions {
  fileDependencies: string[];
}

export class AddFileDepsWebpackPlugin {
  constructor(public options: AddFileDepsPluginOptions) {
  }

  apply(compiler: any): void {
    compiler.plugin('empit', (compilation: any, callback: any) => {
      if (this.options && this.options.fileDependencies && this.options.fileDependencies.length > 0) {
        this.options.fileDependencies.forEach((fileDep: string) => {
          if (compilation.fileDependencies && compilation.fileDependencies.indexOf(fileDep) === -1) {
            compilation.fileDependencies.push(fileDep);
          }
        });
      }
      callback();
    });
  }
}