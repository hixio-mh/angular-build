// Ref: https://github.com/cebor/rollup-plugin-angular
// Ref: https://github.com/angular/material2

import * as path from 'path';
import * as fs from 'fs-extra';
import * as rollup from 'rollup';

// ReSharper disable CommonJsExternalModule
var rollupPluginutils = require('rollup-pluginutils');
// ReSharper disable once InconsistentNaming
const MagicString = require('magic-string');
// ReSharper restore CommonJsExternalModule

export interface ResourceInlineOptions {
    processTemplateUrl?: (url: string, resourceId: string) => Promise<string|null>;
    processStyleUrls?: (urls: string[], resourceId: string) => Promise<string[]|null>;
    include: string[];
    exclude?: string[];
    sourceMap?: boolean;
}

export interface AsyncPlugins {
    name?: string;
    transform?(source: string, id: string): Promise<string | { code: string, map: rollup.SourceMap }>;
}

// const componentRegex = /[\s\S]*(\.|@)?\s*Component\s*(\(|(,?[\S\s]*\[))\s*{([\s\S]*)}\s*(\)|(,\]\s*\}))(,)?/gm;
const moduleIdRegex = /moduleId:\s*module\.id\s*,?\s*/g;
const templateUrlRegex = /templateUrl:\s*['"`]([^'"`]+?\.[a-zA-Z]+)['"`]/g;
const styleUrlsRegex = /styleUrls:\s*(\[[^\]]*?\])/gm;

async function processUrl(url: string | string[],
    resourceId: string,
    isTemplate: boolean,
    options: ResourceInlineOptions): Promise<string | null> {
    if (isTemplate) {
        let templateContent: string | null;
        if (options.processTemplateUrl) {
            templateContent = await options.processTemplateUrl(url as string, resourceId);
        } else {
            const dir = path.parse(resourceId).dir;
            const templateFilePath = path.resolve(dir, url);
            templateContent = await fs.readFile(templateFilePath, 'utf-8');
            templateContent = templateContent || '';
        }

        if (templateContent === null || typeof templateContent === 'undefined') {
            return null;
        }

        const shortenedTemplate = templateContent
            .replace(/([\n\r]\s*)+/gm, ' ').trim();
            // .replace(/"/g, '\\"');
        return `template: \`${shortenedTemplate}\``;
    } else {
        const styleUrls = url as string[];
        let stylesContents: string[] | null;
        if (options.processStyleUrls) {
            stylesContents = await options.processStyleUrls(styleUrls, resourceId);
        } else {
            stylesContents = await Promise.all(styleUrls.map(async (styleUrl: string) => {
                const dir = path.parse(resourceId).dir;
                let styleContent = await fs.readFile(path.resolve(dir, styleUrl), 'utf-8');
                styleContent = styleContent || '';
                return styleContent;
            }));
        }

        if (stylesContents === null || typeof stylesContents === 'undefined') {
            return null;
        }

        const shortenedStyleContents = stylesContents.map(
            (styleContent) => {
                const shortenedStyle = styleContent
                    .replace(/([\n\r]\s*)+/gm, ' ');
                // .replace(/"/g, '\\"');
                return `\`${shortenedStyle}\``;
            });
        return `styles: [${shortenedStyleContents.join(',')}]`;
    }
}

type FoundUrlInfo = {
    url: string|string[];
    start: number;
    end: number;
};

export default function (options: ResourceInlineOptions): AsyncPlugins {
    options = options || { include: [] };

    // ignore @angular/** modules
    options.exclude = options.exclude || [];
    if (options.exclude.indexOf('node_modules/@angular/**') === -1) {
        options.exclude.push('node_modules/@angular/**');
    }

    var filter = rollupPluginutils.createFilter(options.include, options.exclude);

    return {
        name: 'ng-resource-inline',
        async transform(source: string, id: string): Promise<string | { code: string, map: rollup.SourceMap }> {
            if (!filter(id)) {
                return null as any;
            }

            const magicString = new MagicString(source);
            let hasReplacements = false;

            // templateUrl
            let templateUrlMatch: RegExpExecArray | null;
            const foundTemplateUrls: FoundUrlInfo[] = [];
            while ((templateUrlMatch = templateUrlRegex.exec(source)) != null) {
                const start = templateUrlMatch.index;
                const end = start + templateUrlMatch[0].length;
                const url = templateUrlMatch[1];
                foundTemplateUrls.push({ start: start, end: end, url: url });
            }
            for (let foundUrl of foundTemplateUrls) {
                const processedResult = await processUrl(foundUrl.url, id, true, options);
                if (processedResult !== null) {
                    hasReplacements = true;
                    magicString.overwrite(foundUrl.start, foundUrl.end, processedResult);
                }
            }

            // styleUrls
            let styleUrlsMatch: RegExpExecArray | null;
            const foundStyleUrls: FoundUrlInfo[] = [];
            while ((styleUrlsMatch = styleUrlsRegex.exec(source)) != null) {
                const start = styleUrlsMatch.index;
                const end = start + styleUrlsMatch[0].length;
                const rawStr = styleUrlsMatch[1];
                // tslint:disable-next-line:no-eval
                const urls: string[] = eval(rawStr);
                foundStyleUrls.push({ start: start, end: end, url: urls });
            }
            for (let foundUrl of foundStyleUrls) {
                const processedResult = await processUrl(foundUrl.url, id, false, options);
                if (processedResult !== null) {
                    hasReplacements = true;
                    magicString.overwrite(foundUrl.start, foundUrl.end, processedResult);
                }
            }

            // moduleId
            let moduleIdMatch: RegExpExecArray | null;
            while ((moduleIdMatch = moduleIdRegex.exec(source)) != null) {
                const start = moduleIdMatch.index;
                const end = start + moduleIdMatch[0].length;
                hasReplacements = true;
                magicString.overwrite(start, end, '');
            }

            if (!hasReplacements) {
                return null as any;
            }

            const result: any = { code: magicString.toString() };
            if (options.sourceMap !== false) {
                result.map = magicString.generateMap({ hires: true });
            }

            return result;
        }
    };
}
