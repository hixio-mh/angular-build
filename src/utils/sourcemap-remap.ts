// ReSharper disable once CommonJsExternalModule
const sorcery = require('sorcery');

export async function remapSourcemap(sourceFile: string): Promise<any> {
    // Once sorcery loaded the chain of sourcemaps, the new sourcemap will be written asynchronously.
    return (await sorcery.load(sourceFile)).write();
}
