import * as crypto from 'crypto';

import { Filesystem } from '@angular/service-worker/config';
import { Path, join, normalize, virtualFs, dirname, tags } from '@angular-devkit/core';
import * as resolve from 'resolve';
import { from, merge, Observable, of } from 'rxjs';
import { concatMap, map, mergeMap, reduce, switchMap, toArray } from 'rxjs/operators';
import * as webpack from 'webpack';

import { InternalError } from '../../../error-models';

class CliFilesystem implements Filesystem {
  constructor(private readonly _host: virtualFs.Host, private readonly _base: string) { }

  list(p: string): Promise<string[]> {
    const recursiveList = (p1: Path): Observable<Path> => this._host.list(p1).pipe(
      // Emit each fragment individually.
      concatMap(fragments => from(fragments)),
      // Join the path with fragment.
      map(fragment => join(p1, fragment)),
      // Emit directory content paths instead of the directory path.
      mergeMap(p2 => this._host.isDirectory(p2).pipe(
        concatMap(isDir => isDir ? recursiveList(p2) : of(p2))
      )
      )
    );

    return recursiveList(this.res(p)).pipe(
      map(p2 => p2.replace(this._base, '')),
      toArray(),
    ).toPromise().then(x => x, () => []);
  }

  read(path: string): Promise<string> {
    return this._host.read(this.res(path))
      .toPromise()
      .then(content => virtualFs.fileBufferToString(content));
  }

  hash(path: string): Promise<string> {
    const sha1 = crypto.createHash('sha1');

    return this.read(path)
      .then(content => sha1.update(content))
      .then(() => sha1.digest('hex'));
  }

  write(path: string, content: string): Promise<void> {
    return this._host.write(this.res(path), virtualFs.stringToFileBuffer(content))
      .toPromise();
  }

  private res(p: string): Path {
    return join(normalize(this._base), p);
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
  get name(): string {
    return 'service-worker-webpack-plugin';
  }

  constructor(private readonly _options: ServiceWorkerWebpackPluginOptions) {
    if (!_options) {
      throw new InternalError(`[${this.name}] The 'options' can't be null or empty.`);
    }
  }

  apply(compiler: webpack.Compiler): void {
    compiler.hooks.afterEmit.tapPromise(this.name, async () => {
      await this.augmentAppWithServiceWorker(this._options.host,
        this._options.workspaceRoot,
        this._options.projectRoot,
        this._options.outputPath,
        this._options.baseHref,
        this._options.ngswConfigPath);
    });
  }

  private resolveProjectModule(root: string, moduleName: string): string {
    return resolve.sync(moduleName, { basedir: root });
  }

  private augmentAppWithServiceWorker(
    host: virtualFs.Host,
    workspaceRoot: string,
    projectRoot: string,
    outputPath: string,
    baseHref: string,
    ngswConfigPath?: string
  ): Promise<void> {
    // Path to the worker script itself.
    const distPath = normalize(outputPath);
    const workerPath = normalize(
      this.resolveProjectModule(workspaceRoot, '@angular/service-worker/ngsw-worker.js'),
    );

    const swConfigPath = this.resolveProjectModule(
      workspaceRoot,
      '@angular/service-worker/config',
    );

    const safetyPath = join(dirname(workerPath), 'safety-worker.js');
    const configPath = ngswConfigPath as Path || join(normalize(projectRoot), 'ngsw-config.json');

    return host.exists(configPath).pipe(
      switchMap(exists => {
        if (!exists) {
          throw new Error(tags.oneLine`
          Error: Expected to find an ngsw-config.json configuration
          file in the ${projectRoot} folder. Either provide one or disable Service Worker
          in your angular.json configuration file.`,
          );
        }

        return host.read(configPath) as Observable<virtualFs.FileBuffer>;
      }),
      map(content => JSON.parse(virtualFs.fileBufferToString(content))),
      switchMap(configJson => {
        const Generator = require(swConfigPath).Generator;
        const gen = new Generator(new CliFilesystem(host, outputPath), baseHref);

        return gen.process(configJson);
      }),
      switchMap(output => {
        const manifest = JSON.stringify(output, null, 2);
        return host.read(workerPath).pipe(
          switchMap(workerCode => {
            return merge(
              host.write(join(distPath, 'ngsw.json'), virtualFs.stringToFileBuffer(manifest)),
              host.write(join(distPath, 'ngsw-worker.js'), workerCode),
            ) as Observable<void>;
          }),
        );
      }),
      switchMap(() => host.exists(safetyPath)),
      // If @angular/service-worker has the safety script, copy it into two locations.
      switchMap(exists => {
        if (!exists) {
          return of<void>(undefined);
        }

        return host.read(safetyPath).pipe(
          switchMap(safetyCode => {
            return merge(
              host.write(join(distPath, 'worker-basic.min.js'), safetyCode),
              host.write(join(distPath, 'safety-worker.js'), safetyCode),
            ) as Observable<void>;
          }),
        );
      }),

      // Remove all elements, reduce them to a single emit.
      reduce(() => { }),
    ).toPromise();
  }
}
