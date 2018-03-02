// Ref: realfavicongenerator.net - http://realfavicongenerator.net/api/non_interactive_api#.WHMaFxt96Ul
// Ref: RealFaviconGenerator/rfg-api - https://github.com/RealFaviconGenerator/rfg-api
// Ref: evilebottnawi/favicons - https://github.com/evilebottnawi/favicons (http://favicons.io/)

import * as https from 'https';
import * as path from 'path';

import * as color from 'tinycolor2';

import {
    AndroidChromeDesign,
    CoastDesign,
    FaviconsConfig,
    FirefoxAppDesign,
    IoSDesign,
    IconDesign,
    OpenGraphDesign,
    SafariPinnedTabDesign,
    WindowsDesign,
    YandexBrowserDesign
} from '../../../models';
import { Logger } from '../../../utils/logger';
import { camelCaseToUnderscore } from '../../../utils/camel-case-to-underscore';
import { isBase64 } from '../../../utils/is-base64';
import { isUrl } from '../../../utils/is-url';


const favicons = require('favicons');
const unzip = require('unzip2');

const API_KEY = 'eabf77c98d6bd1eea81fb58be7895c42dafc2b21';

interface OfflineIconDesign {
    android?: boolean;
    appleIcon?: boolean | { offset?: number; };
    appleStartup?: boolean;
    windows?: boolean;
    firefox?: boolean | { offset?: number; };
    favicons?: boolean;
    coast?: boolean | { offset?: number; };
    yandex?: boolean;
}

interface OfflineOptions {
    appName: string;
    online: boolean;
    preferOnline: boolean;
    url: string;
    path: string;
    icons: OfflineIconDesign;
    logging: boolean;

    appDescription?: string;
    developerName?: string;
    developerUrl?: string;
    background?: string;
    themeColor?: string;
    display?: string;
    orientation?: string;
    startUrl?: string;
    version?: string;
}

export interface IconGenerateResult {
    iconsPath: string;
    htmls: string[];
    files: IconFileInfo[];
}

export interface IconFileInfo {
    name: string;
    size: number;
    content: Buffer;
}

export class IconGenerator {
    private readonly _androidChromeDefault: AndroidChromeDesign = {
        pictureAspect: 'noChange',
        manifest: {
            onConflict: 'override',
            declared: true
        },
        assets: {
            legacyIcon: false,
            lowResolutionIcons: false
        }
    };

    private readonly _iosDefault: IoSDesign = {
        pictureAspect: 'backgroundAndMargin',
        margin: 0, // Default 4
        assets: {
            ios6AndPriorIcons: false,
            ios7AndLaterIcons: true,
            precomposedIcons: false,
            declareOnlyDefaultIcon: true
        },
        startupImage: {}
    };

    private readonly _desktopBrowserDefault = {};

    private readonly _windowsDefault: WindowsDesign = {
        pictureAspect: 'noChange',
        onConflict: 'override',
        assets: {
            windows80Ie10Tile: false,
            windows10Ie11EdgeTiles: {
                small: true,
                medium: true,
                big: true,
                rectangle: false
            }
        }
    };

    private readonly _safariPinnedTabDefault: SafariPinnedTabDesign = {
        pictureAspect: 'blackAndWhite',
        threshold: 60
    };

    private readonly _firefoxAppDefault: FirefoxAppDesign = {
        pictureAspect: 'circle',
        keepPictureInCircle: 'true',
        manifest: {}
    };

    private readonly _yandexBrowserDefault: YandexBrowserDesign = {
        manifest: {
            showTitle: true,
            version: '1.0'
        }
    };

    private readonly _coastDefault: CoastDesign = {
        pictureAspect: 'backgroundAndMargin',
        margin: 0 // "12%"
    };

    private readonly _openGraphDefault: OpenGraphDesign = {
        pictureAspect: 'backgroundAndMargin',
        margin: 0 // "12%"
    };

    private readonly _offlineDesignDefault: OfflineIconDesign = {
        android: true,
        appleIcon: true,
        appleStartup: true,
        windows: true,
        firefox: true,
        favicons: true,
        coast: false,
        yandex: false
    };

    constructor(private readonly _options: FaviconsConfig,
        private readonly _baseDir: string,
        private readonly _masterPictureFilesMap: { [key: string]: Buffer },
        private readonly _iconsPath: string,
        private readonly _logger: Logger) {
    }

    // Offline
    generateOffline(isFallback?: boolean): Promise<IconGenerateResult> {
        const startTime = Date.now();

        const offlineOptions = this.getOfflineOptions();
        const firstKey = Object.keys(this._masterPictureFilesMap)[0];
        const imageFileStream = this._masterPictureFilesMap[firstKey];

        if (isFallback) {
            this._logger.debug('Trying generating icons using offline option');
        } else {
            this._logger.debug('Generating icons using offline option');
        }

        return new Promise<IconGenerateResult>((resolve, reject) => {
            favicons(imageFileStream,
                offlineOptions,
                (err: any, result: any) => {
                    if (err) {
                        return reject(err);
                    }

                    const htmls = (result.html as string[]).filter(entry => entry.indexOf('manifest') === -1)
                        .map(entry => entry.replace(/(href=[""])/g, `$1${this._iconsPath || ''}`)
                            .replace(/\"\>$/, '"/>'));

                    const iconResult: IconGenerateResult = {
                        iconsPath: this._iconsPath || '',
                        htmls: htmls,
                        files: []
                    };

                    result.images.forEach((file: any) => {
                        const f: IconFileInfo = {
                            name: file.name,
                            size: Buffer.byteLength(file.contents),
                            content: file.contents
                        };
                        iconResult.files.push(f);
                    });

                    result.files.forEach((file: any) => {
                        const f: IconFileInfo = {
                            name: file.name,
                            size: Buffer.byteLength(file.contents),
                            content: file.contents
                        };
                        iconResult.files.push(f);
                    });

                    const duration = Date.now() - startTime;
                    this._logger.debug(
                        `Offline icons generation success in [${duration}ms], total files: ${iconResult.files.length}`);

                    resolve(iconResult);
                });
        });
    }

    // Online
    async generateRfgOnline(): Promise<IconGenerateResult> {
        const startTime = Date.now();
        const rfgRequestData = this.getRfgRequestData();

        this._logger.debug('Generating icons using online option');

        const data = await this.performRfgRequest(rfgRequestData);
        const htmls = data.favicon_generation_result.favicon.html_code.split('\n')
            .map((html: string) => html.replace(/\"\>$/, '"/>'));

        const iconResult: IconGenerateResult = {
            iconsPath: this._iconsPath || '',
            htmls: htmls,
            files: []
        };

        const files = await this.fetchRfgIconPack(data.favicon_generation_result.favicon.package_url);
        iconResult.files = files;

        const duration = Date.now() - startTime;
        this._logger.debug(
            `Online icons generation success in [${duration}ms], total files: ${iconResult.files.length}`);

        return iconResult;
    }

    private getOfflineOptions(): OfflineOptions {
        const options = JSON.parse(JSON.stringify(this._options)) as FaviconsConfig;

        const offlineOptions: OfflineOptions = {
            appName: options.appName || '',
            url: '',
            path: '',
            online: false,
            preferOnline: false,
            icons: {} as OfflineIconDesign,
            logging: false
        };

        if (!options.design || !Object.keys(options.design).length) {
            offlineOptions.icons = Object.assign({}, this._offlineDesignDefault) as OfflineIconDesign;
        }

        const design = options.design || {} as IconDesign;

        if (options.backgroundColor) {
            offlineOptions.background = `#${color(options.backgroundColor).toHex()}`;
        }

        if (options.developerUrl) {
            offlineOptions.developerUrl = options.developerUrl;
        }

        // Android
        if (design.androidChrome) {
            offlineOptions.icons.android = true;
            if (typeof design.androidChrome !== 'boolean') {
                const androidChrome = design.androidChrome as AndroidChromeDesign;
                if (androidChrome.themeColor && !offlineOptions.background) {
                    offlineOptions.background = androidChrome.themeColor;
                }
                if (androidChrome.manifest && androidChrome.manifest.name && !offlineOptions.appName) {
                    offlineOptions.appName = androidChrome.manifest.name;
                }
                if (androidChrome.manifest && androidChrome.manifest.display && !offlineOptions.display) {
                    offlineOptions.display = androidChrome.manifest.display;
                }
                if (androidChrome.manifest &&
                    androidChrome.manifest.orientation &&
                    !offlineOptions.orientation) {
                    offlineOptions.orientation = androidChrome.manifest.orientation;
                }
                if (androidChrome.manifest &&
                    androidChrome.manifest.startUrl &&
                    !offlineOptions.startUrl) {
                    offlineOptions.startUrl = androidChrome.manifest.startUrl;
                }
            }
        }

        // Apple
        if (design.ios) {
            offlineOptions.icons.appleIcon = { offset: undefined };

            if (typeof design.ios !== 'boolean') {
                const ios = design.ios as IoSDesign;
                if (ios.startupImage) {
                    offlineOptions.icons.appleStartup = true;
                }
                if (ios.backgroundColor && !offlineOptions.background) {
                    offlineOptions.background = ios.backgroundColor;
                }
                if (ios.margin) {
                    const margin = typeof ios.margin === 'number'
                        ? ios.margin
                        : Number(ios.margin);
                    (offlineOptions.icons.appleIcon as any).offset = Math.round(60 / 100 * margin);
                }
            }
        }

        // Favicons
        if (design.desktopBrowser) {
            offlineOptions.icons.favicons = true;
        }

        // Firefox
        if (design.firefoxApp) {
            offlineOptions.icons.firefox = { offset: undefined };

            if (typeof design.firefoxApp !== 'boolean') {
                const firefoxApp = design.firefoxApp as FirefoxAppDesign;
                if (firefoxApp.margin) {
                    const margin = typeof firefoxApp.margin === 'number'
                        ? firefoxApp.margin
                        : Number(firefoxApp.margin);
                    (offlineOptions.icons.firefox as any).offset = Math.round(60 / 100 * margin);
                }
                if (firefoxApp.backgroundColor && !offlineOptions.background) {
                    offlineOptions.background = firefoxApp.backgroundColor;
                }
                if (firefoxApp.manifest && firefoxApp.manifest.appName && !offlineOptions.appName) {
                    offlineOptions.appName = firefoxApp.manifest.appName;
                }
                if (firefoxApp.manifest && firefoxApp.manifest.appDescription &&
                    !offlineOptions.appDescription) {
                    offlineOptions.appDescription = firefoxApp.manifest.appDescription;
                }
                if (firefoxApp.manifest &&
                    firefoxApp.manifest.developerName &&
                    !offlineOptions.developerName) {
                    offlineOptions.developerName = firefoxApp.manifest.developerName;
                }
                if (firefoxApp.manifest &&
                    firefoxApp.manifest.developerUrl &&
                    !offlineOptions.developerUrl) {
                    offlineOptions.developerUrl = firefoxApp.manifest.developerUrl;
                }
            }
        }

        // Coast
        if (design.coast) {
            if (typeof offlineOptions.icons.coast !== 'object') {
                offlineOptions.icons.coast = { offset: undefined };
            }

            if (typeof design.coast !== 'boolean') {
                const coast = design.coast as CoastDesign;

                if (coast.margin) {
                    const margin = typeof coast.margin === 'number' ? coast.margin : Number(coast.margin);
                    (offlineOptions.icons.coast as any).offset =
                        Math.round(228 / 100 * margin);
                }
                if (coast.backgroundColor && !offlineOptions.background) {
                    offlineOptions.background = coast.backgroundColor;
                }
            }
        }

        // Yandex
        if (design.yandexBrowser) {
            offlineOptions.icons.yandex = true;

            if (typeof design.yandexBrowser !== 'boolean') {
                const yandexBrowser = design.yandexBrowser as YandexBrowserDesign;
                if (yandexBrowser.backgroundColor && !offlineOptions.background) {
                    offlineOptions.background = yandexBrowser.backgroundColor;
                }
            }
        }

        return offlineOptions;
    }

    private fetchRfgIconPack(url: string): Promise<IconFileInfo[]> {
        return new Promise<IconFileInfo[]>((resolve, reject) => {
            const files: IconFileInfo[] = [];
            https.get(url,
                res =>
                    res.pipe(unzip.Parse())
                        .on('entry',
                            (entry: any) => {
                                const fileName = entry.path;
                                const size = entry.size;
                                const bufs: any[] = [];
                                entry
                                    .on('data', (d: any) => bufs.push(d))
                                    .on('end',
                                        () => files.push({ name: fileName, size: size, content: Buffer.concat(bufs) }))
                                    .on('error', (err: Error) => reject(err));
                                // Important: If you do not intend to consume an entry stream's raw data, call autodrain() to
                                // dispose of the entry's contents.
                                entry.autodrain();
                            })
                        .on('close', () => resolve(files))
                        .on('error', (err: Error) => reject(err))
            )
                .on('error', (err: Error) => reject(err));
        });
    }

    private getRfgRequestData(): any {
        const options = JSON.parse(JSON.stringify(this._options)) as FaviconsConfig;
        options.apiKey = options.apiKey || (options as any).api_key || API_KEY;

        // masterPicture
        options.masterPicture = this.normalizeMasterPicture(options.masterPicture);

        // design
        if (!options.design || !Object.keys(options.design).length) {
            options.design = {
                desktopBrowser: {},
                androidChrome: Object.assign({}, this._androidChromeDefault),
                coast: Object.assign({}, this._coastDefault),
                firefoxApp: Object.assign({}, this._firefoxAppDefault),
                ios: Object.assign({}, this._iosDefault),
                openGraph: Object.assign({}, this._openGraphDefault),
                safariPinnedTab: Object.assign({}, this._safariPinnedTabDefault),
                windows: Object.assign({}, this._windowsDefault),
                yandexBrowser: Object.assign({}, this._yandexBrowserDefault)
            };
        }

        // desktopBrower
        if (options.design.desktopBrowser && typeof options.design.desktopBrowser !== 'object') {
            options.design.desktopBrowser = Object.assign({}, this._desktopBrowserDefault);
        }

        // androidChrome
        let androidChrome: AndroidChromeDesign | undefined;
        if (options.design.androidChrome && typeof options.design.androidChrome !== 'object') {
            androidChrome = Object.assign({}, this._androidChromeDefault);
            options.design.androidChrome = androidChrome;
        } else if (options.design.androidChrome) {
            androidChrome =
                Object.assign({}, this._androidChromeDefault, options.design.androidChrome);
            options.design.androidChrome = androidChrome;
        }
        if (androidChrome) {
            androidChrome.manifest = androidChrome.manifest || {};
            if (options.appName && !androidChrome.manifest.name) {
                androidChrome.manifest.name = options.appName;
            } else if (!options.appName && androidChrome.manifest.name) {
                options.appName = androidChrome.manifest.name;
            }
            if (options.backgroundColor && !androidChrome.themeColor) {
                androidChrome.themeColor = options.backgroundColor;
            }
        }

        // ios
        let ios: IoSDesign | undefined;
        if (options.design.ios && typeof options.design.ios !== 'object') {
            ios = Object.assign({}, this._iosDefault);
            options.design.ios = ios;
        } else if (options.design.ios) {
            ios = Object.assign({}, this._iosDefault, options.design.ios);
            options.design.ios = ios;
        }
        if (ios) {
            if (options.backgroundColor && !ios.backgroundColor) {
                ios.backgroundColor = options.backgroundColor;
            }
            if ((ios as any).offset && !ios.margin) {
                ios.margin = Math.round(57 / 100 * (ios as any).offset);
                delete (ios as any).offset;
            }

            // apple - startupImage
            if (ios.startupImage && typeof ios.startupImage !== 'object') {
                ios.startupImage = {};
            }
            if (ios.startupImage) {
                if (options.backgroundColor && !ios.startupImage.backgroundColor) {
                    ios.startupImage.backgroundColor = options.backgroundColor;
                }
            }
        }

        // safariPinnedTab
        let safariPinnedTab: SafariPinnedTabDesign | undefined;
        if (options.design.safariPinnedTab && typeof options.design.safariPinnedTab !== 'object') {
            safariPinnedTab = Object.assign({}, this._safariPinnedTabDefault);
            options.design.safariPinnedTab = safariPinnedTab;
        } else if (options.design.safariPinnedTab) {
            safariPinnedTab = Object.assign({}, this._safariPinnedTabDefault, options.design.safariPinnedTab);
            options.design.safariPinnedTab = safariPinnedTab;
        }
        if (safariPinnedTab) {
            if (options.backgroundColor && !safariPinnedTab.themeColor) {
                safariPinnedTab.themeColor = options.backgroundColor;
            }
        }

        // firefoxApp
        let firefoxApp: FirefoxAppDesign | undefined;
        if (options.design.firefoxApp && typeof options.design.firefoxApp !== 'object') {
            firefoxApp = Object.assign({}, this._firefoxAppDefault);
            options.design.firefoxApp = firefoxApp;
        } else if (options.design.firefoxApp) {
            firefoxApp = Object.assign({}, this._firefoxAppDefault, options.design.firefoxApp);
            options.design.firefoxApp = firefoxApp;
        }
        if (firefoxApp) {
            firefoxApp.manifest = firefoxApp.manifest || {};

            if (options.backgroundColor && !firefoxApp.backgroundColor) {
                firefoxApp.backgroundColor = options.backgroundColor;
            }
            if (options.appName && !firefoxApp.manifest.appName) {
                firefoxApp.manifest.appName = options.appName;
            }
            if (options.appDescription && !firefoxApp.manifest.appDescription) {
                firefoxApp.manifest.appDescription = options.appDescription;
            }
            if (options.developerName && !firefoxApp.manifest.developerName) {
                firefoxApp.manifest.developerName = options.developerName;
            }
            if (options.developerUrl && !firefoxApp.manifest.developerUrl) {
                firefoxApp.manifest.developerUrl = options.developerUrl;
            }
            if ((options.design.firefoxApp as any).offset && !firefoxApp.margin) {
                firefoxApp.margin = Math.round(60 / 100 * (options.design.firefoxApp as any).offset);
                delete (options.design.firefoxApp as any).offset;
            }
        }

        // yandexBrowser
        let yandexBrowser: YandexBrowserDesign | undefined;
        if (options.design.yandexBrowser && typeof options.design.yandexBrowser !== 'object') {
            yandexBrowser = Object.assign({}, this._yandexBrowserDefault);
            options.design.yandexBrowser = yandexBrowser;
        } else if (options.design.yandexBrowser) {
            yandexBrowser = Object.assign({}, this._yandexBrowserDefault, options.design.yandexBrowser);
            options.design.yandexBrowser = yandexBrowser;
        }
        if (yandexBrowser) {
            yandexBrowser.manifest = yandexBrowser.manifest || {};

            if (options.backgroundColor && !yandexBrowser.backgroundColor) {
                yandexBrowser.backgroundColor = options.backgroundColor;
            }
            if (options.version && !yandexBrowser.manifest.version) {
                yandexBrowser.manifest.version = options.version;
            }
        }

        // windows
        let windows: WindowsDesign | undefined;
        if (options.design.windows && typeof options.design.windows !== 'object') {
            windows = Object.assign({}, this._windowsDefault);
            options.design.windows = windows;
        } else if (options.design.windows) {
            windows = Object.assign({}, this._windowsDefault, options.design.windows);
            options.design.windows = windows;
        }
        if (windows) {
            if (options.backgroundColor && !windows.backgroundColor) {
                windows.backgroundColor = options.backgroundColor;
            }
        }

        // coast
        let coast: CoastDesign | undefined;
        if (options.design.coast && typeof options.design.coast !== 'object') {
            coast = Object.assign({}, this._coastDefault);
            options.design.coast = coast;
        } else if (options.design.coast) {
            coast = Object.assign({}, this._coastDefault, options.design.coast);
            options.design.coast = coast;
        }
        if (coast) {
            if ((options.design.coast as any).offset && !coast.margin) {
                coast.margin = Math.round(228 / 100 * (options.design.coast as any).offset);
                delete (options.design.coast as any).offset;
            }
            if (options.backgroundColor && !coast.backgroundColor) {
                coast.backgroundColor = options.backgroundColor;
            }
        }

        // openGraph
        let openGraph: OpenGraphDesign | undefined;
        if (options.design.openGraph && typeof options.design.openGraph !== 'object') {
            openGraph = Object.assign({}, this._openGraphDefault);
            options.design.openGraph = openGraph;
        } else if (options.design.openGraph) {
            openGraph = Object.assign({}, this._openGraphDefault, options.design.openGraph);
            options.design.openGraph = openGraph;
        }
        if (openGraph) {
            if (options.backgroundColor && !openGraph.backgroundColor) {
                openGraph.backgroundColor = options.backgroundColor;
            }
        }

        const rfgRequestOptions: any = {
            api_key: options.apiKey,
            master_picture: options.masterPicture,
            files_location: {
                type: this._iconsPath === undefined ? 'root' : 'path'
            },
            favicon_design: this.normalizeAllMasterPictures(
                this.camelCaseToUnderscoreRequest(options.design)),
            settings: this.camelCaseToUnderscoreRequest(options.settings),
            versioning: this.camelCaseToUnderscoreRequest(options.versioning)
        };

        // path
        if (typeof this._iconsPath !== 'undefined') {
            rfgRequestOptions.files_location.path = this._iconsPath;
        }

        return {
            favicon_generation: rfgRequestOptions
        };
    }

    private normalizeMasterPicture(masterPicture: any): { content: string; type?: 'inline' | 'url', url?: string } {
        const masterPictureObject: { content: string; type?: 'inline' | 'url', url?: string } = { content: '' };
        if (!masterPicture) {
            return masterPictureObject;
        }

        if (typeof masterPicture === 'string') {
            if (isUrl(masterPicture)) {
                masterPictureObject.type = 'url';
                masterPictureObject.url = masterPicture;
            } else {
                const masterPicturePath = path.isAbsolute(masterPicture)
                    ? path.resolve(masterPicture)
                    : path.resolve(this._baseDir, masterPicture);

                masterPictureObject.type = 'inline';
                masterPictureObject.content = this._masterPictureFilesMap[masterPicturePath].toString('base64');
            }
        } else {
            if (masterPicture.type === 'inline' || masterPicture.content !== undefined) {
                masterPictureObject.type = 'inline';
                if (!isBase64(masterPicture.content)) {
                    const masterPicturePath = path.isAbsolute(masterPicture.content)
                        ? path.resolve(masterPicture.content)
                        : path.resolve(this._baseDir, masterPicture.content);
                    masterPictureObject.content = this._masterPictureFilesMap[masterPicturePath].toString('base64');
                }
            } else if (masterPicture.url) {
                masterPictureObject.type = 'url';
                masterPictureObject.url = masterPicture.url;
            }
        }

        return masterPictureObject;
    }

    private normalizeAllMasterPictures(request: any): any {
        if (request.constructor === Array) {
            for (let i = 0; i < request.length; i++) {
                request[i] = this.normalizeAllMasterPictures(request[i]);
            }
            return request;
        } else if (request.constructor === Object) {
            const keys = Object.keys(request);
            for (let j = 0; j < keys.length; j++) {
                if (keys[j] === 'master_picture' || keys[j] === 'masterPicture') {
                    request[keys[j]] = this.normalizeMasterPicture(request[keys[j]]);
                } else {
                    request[keys[j]] = this.normalizeAllMasterPictures(request[keys[j]]);
                }
            }
            return request;
        } else {
            return request;
        }
    }

    private camelCaseToUnderscoreRequest(request: any): any {
        if (request === undefined) {
            return undefined;
        }

        if (Array.isArray(request)) {
            for (let i = 0; i < request.length; i++) {
                request[i] = this.camelCaseToUnderscoreRequest(request[i]);
            }
        } else if (typeof request === 'string') {
            return camelCaseToUnderscore(request);
        } else if (request.constructor === Object) {
            const keys = Object.keys(request);
            for (let j = 0; j < keys.length; j++) {
                const key = keys[j];
                const uKey = camelCaseToUnderscore(keys[j]);

                // Special case for some keys: content should be passed as is
                const keysToIgnore = [
                    'scaling_algorithm',
                    'name',
                    'content',
                    'param_name',
                    'param_value',
                    'description',
                    'app_description',
                    'developer_name',
                    'app_name',
                    'existing_manifest'];
                const newContent = (keysToIgnore.indexOf(uKey) >= 0)
                    ? request[key]
                    : this.camelCaseToUnderscoreRequest(request[key]);

                if (key !== uKey) {
                    request[uKey] = newContent;
                    delete request[key];
                } else {
                    request[key] = newContent;
                }
            }
        }

        return request;
    }

    private performRfgRequest(requestData: any): Promise<any> {
        const reqestDataStr = JSON.stringify(requestData);

        const options = {
            hostname: 'realfavicongenerator.net',
            path: '/api/favicon',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': reqestDataStr.length
            }
        };

        return new Promise((resolve, reject) => {
            const req = https.request(options as any, res => {
                // Temporary data holder
                const resposeBuffer: any[] = [];

                // On every content chunk, push it to the data array
                res.on('data', (chunk) => resposeBuffer.push(chunk));

                // Resolve on end
                res.on('end', () => {
                    const responseStr = resposeBuffer.length > 0 ? Buffer.concat(resposeBuffer).toString('utf8') : '';
                    if (!responseStr) {
                        return reject('No data received.');
                    }

                    let jsonResult: any = null;

                    try {
                        jsonResult = JSON.parse(responseStr);
                    } catch (e) { /* Do nothing */ }

                    if (!jsonResult) {
                        return reject(responseStr);
                    }

                    if (res.statusCode && res.statusCode !== 200) {
                        const err = (
                            jsonResult.favicon_generation_result &&
                            jsonResult.favicon_generation_result.result &&
                            jsonResult.favicon_generation_result.result.error_message)
                            ? jsonResult.favicon_generation_result.result.error_message
                            : `statusCode=${res.statusCode}`;
                        return reject(err);
                    }

                    return resolve(jsonResult);
                });
            });

            // Handle connection errors of the request
            req.on('error', (err) => {
                reject(new Error(`Connection problem, ${err.message}.`));
            });

            req.write(reqestDataStr);
            req.end();
        });
    }
}
