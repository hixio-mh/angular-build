/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

// tslint:disable:no-any
// tslint:disable:no-unsafe-any
// tslint:disable:no-default-export

import { interpolateName } from 'loader-utils';
import * as postcss from 'postcss';
import * as url from 'url';
import * as webpack from 'webpack';

function wrapUrl(urlStr: string): string {
    let wrappedUrl: string;
    const hasSingleQuotes = urlStr.indexOf('\'') >= 0;

    if (hasSingleQuotes) {
        wrappedUrl = `"${urlStr}"`;
    } else {
        wrappedUrl = `'${urlStr}'`;
    }

    return `url(${wrappedUrl})`;
}

export interface PostcssCliResourcesOptions {
    baseHref?: string;
    deployUrl?: string;
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

// tslint:disable-next-line:max-func-body-length
export default postcss.plugin('postcss-cli-resources', ((options: PostcssCliResourcesOptions) => {
    const deployUrl = options.deployUrl || '';
    const baseHref = options.baseHref || '';
    const filename = options.filename;
    const loader = options.loader;

    const dedupeSlashes = (urlStr: string) => urlStr.replace(/\/\/+/g, '/');

    const process = async (inputUrl: string, resourceCache: Map<string, string>) => {
        // If root-relative or absolute, leave as is
        if (inputUrl.match(/^(?:\w+:\/\/|data:|chrome:|#)/)) {
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

        if (inputUrl.startsWith('~')) {
            inputUrl = inputUrl.substr(1);
        }

        if (inputUrl.startsWith('/') && !inputUrl.startsWith('//')) {
            let outputUrl: string;
            if (deployUrl.match(/:\/\//) || deployUrl.startsWith('/')) {
                // If deployUrl is absolute or root relative, ignore baseHref & use deployUrl as is.
                outputUrl = `${deployUrl.replace(/\/$/, '')}${inputUrl}`;
            } else if (baseHref.match(/:\/\//)) {
                // If baseHref contains a scheme, include it as is.
                outputUrl = baseHref.replace(/\/$/, '') + dedupeSlashes(`/${deployUrl}/${inputUrl}`);
            } else {
                // Join together base-href, deploy-url and the original URL.
                outputUrl = dedupeSlashes(`/${baseHref}/${deployUrl}/${inputUrl}`);
            }

            resourceCache.set(inputUrl, outputUrl);

            return outputUrl;
        }

        const urlWithStringQuery = url.parse(inputUrl.replace(/\\/g, '/'));
        const pathname = urlWithStringQuery.pathname;
        const hash = urlWithStringQuery.hash;
        const search = urlWithStringQuery.search;
        const resolver = async (file: string, base: string) => new Promise<string>((res, rej) => {
            loader.resolve(base, file, (err: any, r: any) => {
                if (err) {
                    rej(err);

                    return;
                }
                res(r);
            });
        });

        const result = await resolve(pathname as string, loader.context, resolver);

        return new Promise<string>((res, rej) => {
            loader.fs.readFile(result, (err: Error, content: Buffer) => {
                if (err) {
                    rej(err);

                    return;
                }

                const outputPath = interpolateName(
                    // tslint:disable-next-line:no-object-literal-type-assertion
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

                if (deployUrl && loader.loaders[loader.loaderIndex].options.ident !== 'extracted') {
                    outputUrl = url.resolve(deployUrl, outputUrl);
                }

                resourceCache.set(inputUrl, outputUrl);
                res(outputUrl);
            });
        });
    };

    return (root: postcss.Root) => {
        const urlDeclarations: postcss.Declaration[] = [];
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
            const urlRegex = /url\(\s*(?:"([^"]+)"|'([^']+)'|(.+?))\s*\)/g;
            const segments: string[] = [];

            let match = urlRegex.exec(value);
            let lastIndex = 0;
            let modified = false;
            while (match) {
                const originalUrl = match[1] || match[2] || match[3];
                let processedUrl: string;
                try {
                    const a = await process(originalUrl, resourceCache);
                    processedUrl = a;
                } catch (err) {
                    loader.emitError(decl.error(err.message, { word: originalUrl }).toString());
                    continue;
                }

                if (lastIndex < match.index) {
                    segments.push(value.slice(lastIndex, match.index));
                }

                if (!processedUrl || originalUrl === processedUrl) {
                    segments.push(match[0]);
                } else {
                    segments.push(wrapUrl(processedUrl));
                    modified = true;
                }

                lastIndex = match.index + match[0].length;

                match = urlRegex.exec(value);
            }

            if (lastIndex < value.length) {
                segments.push(value.slice(lastIndex));
            }

            if (modified) {
                decl.value = segments.join('');
            }
        }));
    };
}) as any);
