import * as webpack from 'webpack';

export interface RemoveHashWebpackPluginOptions {
  chunkNames: string[];
  hashFormats: string[];
}

export class RemoveHashWebpacklugin {

  constructor(private options: RemoveHashWebpackPluginOptions) { }

  apply(compiler: webpack.Compiler): void {
    compiler.hooks.compilation.tap('remove-hash-webpack-plugin', (compilation: any) => {
      const mainTemplate = compilation.mainTemplate as webpack.compilation.MainTemplate & {
        hooks: webpack.compilation.CompilationHooks;
      };

      mainTemplate.hooks.assetPath.tap('remove-hash-webpack-plugin',
        (path: string, data: { chunk?: { name: string } }) => {
          const chunkName = data.chunk && data.chunk.name;
          const { chunkNames, hashFormats } = this.options;

          if (chunkName && chunkNames.includes(chunkName)) {
            let newPath = path;
            hashFormats.forEach(hashFormat => {
              newPath = newPath.replace(hashFormat, '');
            });

            return newPath;
          }

          return path;
        },
      );
    });
  }
}
