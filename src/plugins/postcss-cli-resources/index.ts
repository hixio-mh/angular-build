/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { interpolateName } from 'loader-utils';
import * as postcss from 'postcss';
import * as url from 'url';
import * as webpack from 'webpack';

function wrapUrl(url: string): string {
    let wrappedUrl: string;
    const hasSingleQuotes = url.indexOf('\'') >= 0;

    if (hasSingleQuotes) {
        wrappedUrl = `"${url}"`;
    } else {
        wrappedUrl = `'${url}'`;
    }

    return `url(${wrappedUrl})`;
}

export interface PostcssCliResourcesOptions {
    deployUrl: string;
    filename: string;
    loader: webpack.loader.LoaderContext;
}

async function resolve(
    file: string,
    base: string,
    resolver: (file: string, base: string) => Promise<string>
): Promise<string> {
    try {
        return await resolver(`./${file}`, base);
    } catch (err) {
        return resolver(file, base);
    }
}

export default postcss.plugin('postcss-cli-resources',
    ((options?: PostcssCliResourcesOptions) => {
        if (!options) {
            throw new Error(`The 'options' is required.`);
        }

        const deployUrl = options.deployUrl;
        const filename = options.filename;
        const loader = options.loader;

        const process = async (inputUrl: string, resourceCache: Map<string, string>) => {
            // If root-relative or absolute, leave as is
            if (inputUrl.match(/^(?:\w+:\/\/|data:|chrome:|#|\/)/)) {
                return inputUrl;
            }
            // If starts with a caret, remove and return remainder
            // this supports bypassing asset processing
            if (inputUrl.startsWith('^')) {
                return inputUrl.substr(1);
            }

            const cachedUrl = resourceCache.get(inputUrl);
            if (cachedUrl) {
                return cachedUrl;
            }

            const urlWithStringQuery = url.parse(inputUrl.replace(/\\/g, '/'));
            const pathname = urlWithStringQuery.pathname;
            const hash = urlWithStringQuery.hash;
            const search = urlWithStringQuery.search;

            const resolver = (file: string, base: string) => new Promise<string>((resolve, reject) => {
                loader.resolve(base,
                    file,
                    (err, result) => {
                        if (err) {
                            reject(err);
                            return;
                        }
                        resolve(result);
                    });
            });

            const result = await resolve(pathname || '', loader.context, resolver);

            return new Promise<string>((resolve, reject) => {
                loader.fs.readFile(result,
                    (err: Error, data: Buffer) => {
                        if (err) {
                            reject(err);
                            return;
                        }

                        const content = data.toString();
                        const outputPath = interpolateName(
                            { resourcePath: result } as webpack.loader.LoaderContext,
                            filename,
                            { content },
                        );

                        loader.addDependency(result);
                        loader.emitFile(outputPath, content, undefined);

                        let outputUrl = outputPath.replace(/\\/g, '/');
                        if (hash || search) {
                            outputUrl = url.format({ pathname: outputUrl, hash, search });
                        }

                        if (deployUrl) {
                            outputUrl = url.resolve(deployUrl, outputUrl);
                        }

                        resourceCache.set(inputUrl, outputUrl);

                        resolve(outputUrl);
                    });
            });
        };

        return (root: postcss.Root) => {
            const urlDeclarations: Array<postcss.Declaration> = [];
            root.walkDecls(decl => {
                if (decl.value && decl.value.includes('url')) {
                    urlDeclarations.push(decl);
                }
            });

            if (urlDeclarations.length === 0) {
                return Promise.resolve();
            }

            const resourceCache = new Map<string, string>();

            return Promise.all(urlDeclarations.map(async decl => {
                const value = decl.value;
                const urlRegex = /url\(\s*['"]?([ \S]+?)['"]??\s*\)/g;
                const segments: string[] = [];

                let match = urlRegex.exec(value);
                let lastIndex = 0;
                let modified = false;
                // tslint:disable-next-line:no-conditional-assignment
                while (match) {
                    let processedUrl: string;
                    try {
                        const a = await process(match[1], resourceCache);
                        processedUrl = a as string;
                    } catch (err) {
                        loader.emitError(decl.error(err.message, { word: match[1] }).toString());
                        continue;
                    }

                    if (lastIndex !== match.index) {
                        segments.push(value.slice(lastIndex, match.index));
                    }

                    if (!processedUrl || match[1] === processedUrl) {
                        segments.push(match[0]);
                    } else {
                        segments.push(wrapUrl(processedUrl));
                        modified = true;
                    }

                    lastIndex = urlRegex.lastIndex;

                    match = urlRegex.exec(value);
                }

                if (modified) {
                    decl.value = segments.join('');
                }
            }));
        };
    }) as any);
