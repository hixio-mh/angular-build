import { Logger, LoggerOptions } from '../../../utils/logger';

export interface BaseHrefHtmlWebpackPluginOptions {
    baseHref: string;
    isSeparateOutFunc?: (htmlOptionsId?: string) => boolean;
    targetHtmlWebpackPluginIds?: string[];
    loggerOptions?: LoggerOptions;
}

export class BaseHrefHtmlWebpackPlugin {
    private readonly logger: Logger;

    get name(): string {
        return 'BaseHrefHtmlWebpackPlugin';
    }

    constructor(private readonly options: BaseHrefHtmlWebpackPluginOptions) {
        const loggerOptions =
            Object.assign({ name: `[${this.name}]` }, this.options.loggerOptions || {}) as LoggerOptions;
        this.logger = new Logger(loggerOptions);
    }

    apply(compiler: any): void {
        if (!this.options.baseHref && this.options.baseHref !== '') {
            return;
        }

        compiler.plugin('compilation', (compilation: any) => {
            compilation.plugin('html-webpack-plugin-before-html-processing',
                (htmlPluginArgs: any, cb: (err?: Error, htmlPluginArgs?: any) => void) => {
                    const targetHtmlWebpackPluginIds = this.options.targetHtmlWebpackPluginIds || [];
                    if (!targetHtmlWebpackPluginIds.length ||
                        (targetHtmlWebpackPluginIds.length &&
                            targetHtmlWebpackPluginIds.indexOf(htmlPluginArgs.plugin.options.id) > -1)) {
                        const isSeparateOut = typeof this.options.isSeparateOutFunc === 'function' &&
                            this.options.isSeparateOutFunc(htmlPluginArgs.plugin.options.id);
                        const htmlOutFileName = htmlPluginArgs.outputName;

                        this.logger.debug(`Injecting base href tag${htmlOutFileName ? ` to ${htmlOutFileName}` : ''}`);

                        if (isSeparateOut) {
                            if (htmlPluginArgs.assets.chunks) {
                                htmlPluginArgs.assets.chunks = {};
                            }
                            if (htmlPluginArgs.assets.js) {
                                htmlPluginArgs.assets.js = [];
                            }
                            if (htmlPluginArgs.assets.css) {
                                htmlPluginArgs.assets.css = [];
                            }

                            const baseHrefHtml = `<base href="${this.options.baseHref}"/>`;
                            htmlPluginArgs.html = `${baseHrefHtml}`;
                        } else {
                            htmlPluginArgs.html = htmlPluginArgs.html || '';

                            if (htmlPluginArgs.html.match(/(<\/head>)/i)) {
                                const baseTagRegex = /<base.*?>/i;
                                const baseTagMatches = htmlPluginArgs.html.match(baseTagRegex);
                                if (!baseTagMatches) {
                                    // Insert it in top of the head if not exist
                                    htmlPluginArgs.html = htmlPluginArgs.html.replace(
                                        /<head>/i, `$&\n${`    <base href="${this.options.baseHref}"/>`}`
                                    );
                                } else {
                                    // Replace only href attribute if exists
                                    const modifiedBaseTag = baseTagMatches[0].replace(
                                        /href="\S+"/i, `href="${this.options.baseHref}"`
                                    );
                                    htmlPluginArgs.html = htmlPluginArgs.html.replace(baseTagRegex, modifiedBaseTag);
                                }
                            } else {
                                const baseHrefHtml = `<base href="${this.options.baseHref}"/>`;
                                htmlPluginArgs.html = `${htmlPluginArgs.html.trim()}\n${baseHrefHtml}\n`;
                            }
                        }
                    }

                    cb(undefined, htmlPluginArgs);
                }
            );

            compilation.plugin('html-webpack-plugin-alter-asset-tags',
                (htmlPluginArgs: any, cb: (err?: Error, htmlPluginArgs?: any) => void) => {
                    const targetHtmlWebpackPluginIds = this.options.targetHtmlWebpackPluginIds || [];
                    if (!targetHtmlWebpackPluginIds.length ||
                        (targetHtmlWebpackPluginIds.length &&
                            targetHtmlWebpackPluginIds.indexOf(htmlPluginArgs.plugin.options.id) > -1)) {
                        const isSeparateOut = typeof this.options.isSeparateOutFunc === 'function' &&
                            this.options.isSeparateOutFunc(htmlPluginArgs.plugin.options.id);
                        if (isSeparateOut) {
                            if (htmlPluginArgs.head) {
                                htmlPluginArgs.head = [];
                            }
                            if (htmlPluginArgs.body) {
                                htmlPluginArgs.body = [];
                            }
                        }
                    }

                    return cb(undefined, htmlPluginArgs);
                });
        });
    }
}
