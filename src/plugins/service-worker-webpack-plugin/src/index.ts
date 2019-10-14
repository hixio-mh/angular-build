// tslint:disable:no-any
// tslint:disable:no-unsafe-any

import * as crypto from 'crypto';

import { dirname, join, normalize, Path, relative, tags, virtualFs } from '@angular-devkit/core';

import * as webpack from 'webpack';

import { InternalError } from '../../../models/errors';

// class CliFilesystem implements Filesystem
class CliFilesystem {
    constructor(private readonly _host: virtualFs.Host, private readonly _base: string) { }

    async list(path: string): Promise<string[]> {
        return this._recursiveList(this.resolve(path), []).catch(() => []);
    }

    async read(path: string): Promise<string> {
        return virtualFs.fileBufferToString(await this.readIntoBuffer(path));
    }

    async hash(path: string): Promise<string> {
        const sha1 = crypto.createHash('sha1');
        sha1.update(Buffer.from(await this.readIntoBuffer(path)));

        return sha1.digest('hex');
    }

    async write(path: string, content: string): Promise<void> {
        return this._host.write(this.resolve(path), virtualFs.stringToFileBuffer(content))
            .toPromise();
    }

    private async readIntoBuffer(path: string): Promise<ArrayBuffer> {
        return this._host.read(this.resolve(path)).toPromise();
    }

    private resolve(p: string): Path {
        return join(normalize(this._base), p);
    }


    private async _recursiveList(path: Path, items: string[]): Promise<string[]> {
        const fragments = await this._host.list(path).toPromise();

        for (const fragment of fragments) {
            const item = join(path, fragment);

            if (await this._host.isDirectory(item).toPromise()) {
                await this._recursiveList(item, items);
            } else {
                items.push(`/${relative(normalize(this._base), item)}`);
            }
        }

        return items;
    }
}

export interface ServiceWorkerWebpackPluginOptions {
    host: virtualFs.Host;
    workspaceRoot: string;
    projectRoot: string;
    outputPath: string;
    baseHref: string;
    ngswConfigPath?: string;
}

export class ServiceWorkerWebpackPlugin {
    private readonly _host: virtualFs.Host;

    get name(): string {
        return 'service-worker-webpack-plugin';
    }

    constructor(private readonly _options: ServiceWorkerWebpackPluginOptions) {
        if (!_options) {
            throw new InternalError(`[${this.name}] The 'options' can't be null or empty.`);
        }

        this._host = this._options.host;
    }

    apply(compiler: webpack.Compiler): void {
        compiler.hooks.afterEmit.tapPromise(this.name, async () => {
            await this.augmentAppWithServiceWorker(
                this._host,
                this._options.workspaceRoot,
                this._options.projectRoot,
                this._options.outputPath,
                this._options.baseHref,
                this._options.ngswConfigPath);
        });
    }

    private async augmentAppWithServiceWorker(
        host: virtualFs.Host,
        workspaceRoot: string,
        projectRoot: string,
        outputPath: string,
        baseHref: string,
        ngswConfigPath?: string
    ): Promise<void> {
        const distPath = normalize(outputPath);

        const workerPath = normalize(
            require.resolve('@angular/service-worker/ngsw-worker.js', { paths: [workspaceRoot] }),
        );

        const swConfigPath = require.resolve(
            '@angular/service-worker/config',
            { paths: [workspaceRoot] },
        );

        const configPath = ngswConfigPath as Path || join(normalize(projectRoot), 'ngsw-config.json');

        const configExists = await host.exists(configPath).toPromise();
        if (!configExists) {
            throw new Error(tags.oneLine`
  Error: Expected to find an ngsw-config.json configuration
  file in the ${projectRoot} folder. Either provide one or disable Service Worker
  in your angular.json configuration file.`,
            );
        }

        // Read the configuration file
        const config = JSON.parse(virtualFs.fileBufferToString(await host.read(configPath).toPromise()));

        // tslint:disable-next-line: non-literal-require variable-name
        const GeneratorConstructor = require(swConfigPath).Generator;
        const generator = new GeneratorConstructor(new CliFilesystem(host, outputPath), baseHref);

        const output = await generator.process(config);

        const manifest = JSON.stringify(output, null, 2);
        await host.write(join(distPath, 'ngsw.json'), virtualFs.stringToFileBuffer(manifest)).toPromise();

        const workerCode = await host.read(workerPath).toPromise();
        await host.write(join(distPath, 'ngsw-worker.js'), workerCode).toPromise();

        const safetyPath = join(dirname(workerPath), 'safety-worker.js');

        if (await host.exists(safetyPath).toPromise()) {
            const safetyCode = await host.read(safetyPath).toPromise();

            await host.write(join(distPath, 'worker-basic.min.js'), safetyCode).toPromise();
            await host.write(join(distPath, 'safety-worker.js'), safetyCode).toPromise();
        }
    }
}
