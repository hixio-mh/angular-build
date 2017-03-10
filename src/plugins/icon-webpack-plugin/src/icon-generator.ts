// Ref: realfavicongenerator.net - http://realfavicongenerator.net/api/non_interactive_api#.WHMaFxt96Ul
// Ref: RealFaviconGenerator/rfg-api - https://github.com/RealFaviconGenerator/rfg-api
// Ref: jantimon/favicons-webpack-plugin - https://github.com/jantimon/favicons-webpack-plugin
// Ref: haydenbleasel/favicons - https://github.com/haydenbleasel/favicons

import * as color from 'tinycolor2';
import * as sizeOf from 'image-size';
import * as http from 'http';
import * as https from 'https';

// ReSharper disable InconsistentNaming
const favicons = require('favicons');
const Client = require('node-rest-client').Client;
const unzip = require('unzip2');
const rfg = require('rfg-api').init();
// ReSharper restore InconsistentNaming

import { FaviconConfig, IconResult, IconFileInfo } from './models';


// ReSharper disable InconsistentNaming
const API_KEY = 'eabf77c98d6bd1eea81fb58be7895c42dafc2b21';
const RFG_API_URL = 'https://realfavicongenerator.net/api/favicon';
// ReSharper restore InconsistentNaming

export class IconGenerator {

    private readonly androidChromeDefault = {
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

    private readonly iosDefault = {
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

    private readonly desktopBrowserDefault = {

    };

    private readonly windowsDefault = {
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

    private readonly safariPinnedTabDefault = {
        pictureAspect: 'blackAndWhite',
        threshold: 60
    };

    private readonly firefoxAppDefault = {
        pictureAspect: 'circle',
        keep_pictureInCircle: 'true',
        manifest: {}
    };

    private readonly yandexBrowserDefault = {
        manifest: {
            showTitle: true,
            version: '1.0'
        }
    };

    private readonly coastDefault = {
        pictureAspect: 'backgroundAndMargin',
        margin: 0 //"12%"
    };

    private readonly openGraphDefault = {
        pictureAspect: 'backgroundAndMargin',
        margin: 0 // "12%"
    };

    generateIcons(imageFileStream: Buffer,
        iconsPath: string,
        online: boolean,
        preferOnline: boolean,
        options: FaviconConfig,
        cb: (err?: Error, result?: IconResult) => void) {
        if (online || preferOnline) {
            this.generateRfgOnline(imageFileStream, iconsPath, preferOnline, options, cb);
        } else {
            this.generateOffline(imageFileStream, iconsPath, options, cb);
        }
    }

    // Offline
    //
    private generateOffline(imageFileStream: Buffer,
        iconsPath: string,
        options: FaviconConfig,
        cb: (err?: Error, result?: IconResult) => void) {

        const offlineOptions = this.prepareOfflineOptions(options);

        favicons(imageFileStream,
            offlineOptions,
            (err: any, result: any) => {
                if (err) {
                    cb(err);
                    return;
                }

                const html = (<string[]>result.html).filter(entry => entry.indexOf('manifest') === -1)
                    .map(entry => entry.replace(/(href=[""])/g, `$1${iconsPath}`));

                const iconResult: IconResult = {
                    iconsPath: iconsPath,
                    html: html,
                    files: []
                };

                result.images.forEach((file: any) => {
                    const f: IconFileInfo = {
                        name: file.name,
                        size: Buffer.byteLength(file.contents),
                        contents: file.contents
                    };
                    iconResult.files.push(f);
                });
                result.files.forEach((file: any) => {
                    const f: IconFileInfo = {
                        name: file.name,
                        size: Buffer.byteLength(file.contents),
                        contents: file.contents
                    };
                    iconResult.files.push(f);
                });
                cb(null, iconResult);
            });
    }

    private prepareOfflineOptions(iconOptions: FaviconConfig): FaviconConfig {
        const options = <any>Object.assign({}, iconOptions);

        if (options.background) {
            options.background = `#${color(options.background).toHex()}`;
        }

        options['url'] = '';
        options['path'] = '';

        if (options['developerUrl'] && !options['developerURL']) {
            options['developerURL'] = options['developerUrl'];
        }
        if (options['startUrl'] && !options['start_url']) {
            options['start_url'] = options['startUrl'];
        }

        const designDefault = {
            android: true,
            appleIcon: true,
            appleStartup: true,
            windows: true,
            firefox: true,
            favicons: true,
            coast: false,
            yandex: false
        };

        if (!options.design) {
            if (options['icons']) {
                options.design = Object.assign({}, designDefault, options['icons']);
            } else {
                options.design = Object.assign({}, designDefault);
            }
        } else {
            options.design = Object.assign({}, designDefault, options.design);
        }

        // android
        if (options.design.androidChrome) {
            if (!options.design['android']) {
                options.design['android'] = true;
            }

            if (options.design.androidChrome.themeColor && !options.background) {
                options.background = options.design.androidChrome.themeColor;
            }
            if (options.design.androidChrome.manifest && options.design.androidChrome.manifest.name && !options.appName) {
                options.appName = options.design.androidChrome.manifest.name;
            }
            if (options.design.androidChrome.manifest && options.design.androidChrome.manifest.display && !options.display) {
                options.display = options.design.androidChrome.manifest.display;
            }
            if (options.design.androidChrome.manifest &&
                options.design.androidChrome.manifest.orientation &&
                !options.orientation) {
                options.orientation = options.design.androidChrome.manifest.orientation;
            }
            if (options.design.androidChrome.manifest &&
                options.design.androidChrome.manifest.startUrl &&
                !options.startUrl) {
                options.startUrl = options['start_url'] = options.design.androidChrome.manifest.startUrl;
            }
        }

        // apple
        if (options.design.ios) {
            if (!options.design['appleIcon'] || typeof options.design['appleIcon'] !== 'object') {
                options.design['appleIcon'] = { offset: undefined };
            }
            if (options.design.ios.startupImage && !options.design['appleStartup']) {
                options.design['appleStartup'] = true;
            }
            if (options.design.ios.backgroundColor && !options.background) {
                options.background = options.design.ios.backgroundColor;
            }
            if (options.design.ios.margin && !options.design['appleIcon'].offset) {
                options.design['appleIcon'].offset = Math.round(60 / 100 * options.design.ios.margin);
            }
        }

        // favicons
        if (options.design.desktopBrowser) {
            if (!options.design['favicons']) {
                options.design['favicons'] = true;
            }
        }

        // firefox
        if (options.design.firefoxApp) {
            if (!options.design['firefox'] || typeof options.design['firefox'] !== 'object') {
                options.design['firefox'] = { offset: undefined };
            }
            if (options.design.firefoxApp.margin && !options.design['firefox'].offset) {
                options.design['firefox'].offset = Math.round(60 / 100 * options.design.firefoxApp.margin);
            }
            if (options.design.firefoxApp.backgroundColor && !options.background) {
                options.background = options.design.firefoxApp.backgroundColor;
            }
            if (options.design.firefoxApp.manifest && options.design.firefoxApp.manifest.appName && !options.appName) {
                options.appName = options.design.firefoxApp.manifest.appName;
            }
            if (options.design.firefoxApp.manifest &&
                options.design.firefoxApp.manifest.appDescription &&
                !options.appDescription) {
                options.appDescription = options.design.firefoxApp.manifest.appDescription;
            }
            if (options.design.firefoxApp.manifest &&
                options.design.firefoxApp.manifest.developerName &&
                !options.developerName) {
                options.developerName = options.design.firefoxApp.manifest.developerName;
            }
            if (options.design.firefoxApp.manifest &&
                options.design.firefoxApp.manifest.developerUrl &&
                !options.developerUrl) {
                options.developerUrl = options['developerURL'] = options.design.firefoxApp.manifest.developerUrl;
            }
        }

        // coast
        if (options.design.coast) {
            if (typeof options.design['coast'] !== 'object') {
                options.design['coast'] = Object.assign({}, { offset: undefined });
            }

            if (options.design.coast.margin && !options.design.coast['offset']) {
                options.design.coast['offset'] = Math.round(228 / 100 * options.design.coast.margin);
            }
            if (options.design.coast.backgroundColor && !options.background) {
                options.background = options.design.coast.backgroundColor;
            }
        }

        // yandex
        if (options.design.yandexBrowser) {
            if (!options.design['yandex']) {
                options.design['yandex'] = true;
            }
            if (options.design.yandexBrowser.backgroundColor && !options.background) {
                options.background = options.design.yandexBrowser.backgroundColor;
            }
        }


        options['icons'] = Object.assign({}, options.design);
        delete options.design;

        return options;
    }

    // Online
    //
    private generateRfgOnline(imageFileStream: Buffer,
        iconsPath: string,
        preferOnline: boolean,
        options: FaviconConfig,
        cb: (err?: Error, result?: IconResult) => void) {

        const rfgOptions: any = this.prepareRfgOnlineOptions(imageFileStream, options);
        const requestData = rfg.createRequest({
            apiKey: rfgOptions.apiKey || API_KEY,
            masterPicture: rfgOptions['masterPicture'],
            iconsPath: iconsPath,
            design: rfgOptions.design,
            settings: rfgOptions.settings,
            versioning: rfgOptions['versioning']
        });

        const args = {
            data: {
                "favicon_generation": requestData
            },
            headers: {
                "Content-Type": 'application/json'
            }
        };

        const client = new Client();

        client.post(RFG_API_URL,
            args,
            (data: any, response: any) => {
                if (response.statusCode !== 200) {
                    const err = (
                        data &&
                        data.favicon_generation_result &&
                        data.favicon_generation_result.result &&
                        data.favicon_generation_result.result.error_message)
                        ? data.favicon_generation_result.result.error_message
                        : data;
                    if (preferOnline) {
                        console.warn(`Error in generating favicons from online. Trying to offline generating. Error details: ${err}`);
                        this.generateOffline(imageFileStream, iconsPath, options, cb);
                        return;
                    }
                    cb(err);
                    return;
                }

                const html = <string[]>data.favicon_generation_result.favicon.html_code.split('\n');
                //filesUrls: result.favicon.files_urls
                const iconResult: IconResult = {
                    iconsPath: iconsPath,
                    html: html,
                    files: []
                };

                const fetchCallBack = (err?: Error, files?: IconFileInfo[]) => {
                    if (err) {
                        if (preferOnline) {
                            console.warn(`Error in generating favicons from online. Trying to offline generating. Error details: ${err}`);
                            this.generateOffline(imageFileStream, iconsPath, options, cb);
                            return;
                        }
                        cb(err);
                        return;
                    }
                    iconResult.files = files;
                    return cb(null, iconResult);
                };

                this.fetchRfgIconPack(data.favicon_generation_result.favicon.package_url, fetchCallBack);
            });
    }

    private fetchRfgIconPack(url: string, cb: (err?: Error, files?: IconFileInfo[]) => void) {
        const files: IconFileInfo[] = [];
        https.get(url,
            (res: http.IncomingMessage) =>
                res.pipe(unzip.Parse())
                    .on('entry',
                    (entry: any) => {
                        const fileName = entry.path;
                        const size = entry.size;
                        const bufs: any[] = [];
                        entry
                            .on('data', (d: any) => bufs.push(d))
                            .on('end', () => files.push({ name: fileName, size: size, contents: Buffer.concat(bufs) }))
                            .on('error', (err: Error) => cb(err));
                        // Important: If you do not intend to consume an entry stream's raw data, call autodrain() to dispose of the entry's contents.
                        entry.autodrain();
                    })
                    .on('close', () => cb(null, files))
                    .on('error', (err: Error) => cb(err))
        )
            .on('error', (err: Error) => cb(err));
    }

    private prepareRfgOnlineOptions(imageFileStream: Buffer, iconOptions: FaviconConfig): FaviconConfig {

        const options = <any>Object.assign({}, iconOptions);

        options.apiKey = options.apiKey || API_KEY;

        const source = { size: sizeOf(imageFileStream), file: imageFileStream };
        options['masterPicture'] = {
            //content: source.size.type === 'svg' ? source : source.file.toString('base64')
            content: source.file.toString('base64')
        };

        //options['filesLocation'] = {
        //  path: ''
        //};

        // desktopBrower
        if (options.design['favicons'] && !options.design.desktopBrowser) {
            options.design.desktopBrowser = Object.assign({}, this.desktopBrowserDefault);
        }
        if (options.design.desktopBrowser && typeof options.design.desktopBrowser !== 'object') {
            options.design.desktopBrowser = Object.assign({}, this.desktopBrowserDefault);
        }


        // androidChrome
        if (options.design['android'] && !options.design.androidChrome) {
            options.design.androidChrome = Object.assign({}, this.androidChromeDefault);
        }
        if (options.design.androidChrome && typeof options.design.androidChrome !== 'object') {
            options.design.androidChrome = Object.assign({}, this.androidChromeDefault);
        }
        if (options.design.androidChrome) {
            if (options.appName && !options.design.androidChrome.manifest.name) {
                options.design.androidChrome.manifest.name = options.appName;
            }
            if (options.display && !options.design.androidChrome.manifest.display) {
                options.design.androidChrome.manifest.display = options.display;
            }
            if (options.orientation && !options.design.androidChrome.manifest.orientation) {
                options.design.androidChrome.manifest.orientation = options.orientation;
            }
            if (options.startUrl && !options.design.androidChrome.manifest.startUrl) {
                options.design.androidChrome.manifest.startUrl = options.startUrl;
            }
            if (options.background && !options.design.androidChrome.themeColor) {
                options.design.androidChrome.themeColor = options.background;
            }
        }

        // apple - ios
        if (options.design['appleIcon'] && !options.design.ios) {
            options.design.ios = Object.assign({}, this.iosDefault);
        }
        if (options.design.ios && typeof options.design.ios !== 'object') {
            options.design.ios = Object.assign({}, this.iosDefault);
        }
        if (options.design.ios) {
            if (options.background && !options.design.ios.backgroundColor) {
                options.design.ios.backgroundColor = options.background;
            }
            if (options.design.ios['offset'] && !options.design.ios.margin) {
                options.design.ios.margin = Math.round(57 / 100 * options.design.ios['offset']);
                delete options.design.ios['offset'];
            }
        }

        // apple - startupImage
        if (options.design['appleStartup'] && options.design.ios && !options.design.ios.startupImage) {
            options.design.ios.startupImage = {};
        }
        if (options.design.ios && options.design.ios.startupImage && typeof options.design.ios.startupImage !== 'object') {
            options.design.ios.startupImage = {};
        }
        if (options.design.ios.startupImage) {
            if (options.background && !options.design.ios.startupImage.backgroundColor) {
                options.design.ios.startupImage.backgroundColor = options.background;
            }
        }

        // apple - safariPinnedTab
        if (options.design.safariPinnedTab && typeof options.design.safariPinnedTab !== 'object') {
            options.design.safariPinnedTab = Object.assign({}, this.safariPinnedTabDefault);
        }
        if (options.design.safariPinnedTab) {
            if (options.background && !options.design.safariPinnedTab.themeColor) {
                options.design.safariPinnedTab.themeColor = options.background;
            }
        }

        // firefoxApp
        if (options.design['firefox'] && !options.design.firefoxApp) {
            options.design.firefoxApp = Object.assign({}, this.firefoxAppDefault);
        }
        if (options.design.firefoxApp && typeof options.design.firefoxApp !== 'object') {
            options.design.firefoxApp = Object.assign({}, this.firefoxAppDefault);
        }
        if (options.design.firefoxApp) {
            if (options.background && !options.design.firefoxApp.backgroundColor) {
                options.design.firefoxApp.backgroundColor = options.background;
            }
            if (options.appName && !options.design.firefoxApp.manifest.appName) {
                options.design.firefoxApp.manifest.appName = options.appName;
            }
            if (options.appDescription && !options.design.firefoxApp.manifest.appDescription) {
                options.design.firefoxApp.manifest.appDescription = options.appDescription;
            }
            if (options.developerName && !options.design.firefoxApp.manifest.developerName) {
                options.design.firefoxApp.manifest.developerName = options.developerName;
            }
            if ((options.developerUrl) &&
                !options.design.firefoxApp.manifest.developerUrl) {
                options.design.firefoxApp.manifest
                    .developerUrl = options.developerUrl;
            }
            if (options.design.firefoxApp['offset'] && !options.design.firefoxApp.margin) {
                options.design.firefoxApp.margin = Math.round(60 / 100 * options.design.firefoxApp['offset']);
                delete options.design.firefoxApp['offset'];
            }
        }

        // yandexBrowser
        if (options.design['yandex'] && !options.design.yandexBrowser) {
            options.design.yandexBrowser = Object.assign({}, this.yandexBrowserDefault);
        }
        if (options.design.yandexBrowser && typeof options.design.yandexBrowser !== 'object') {
            options.design.yandexBrowser = Object.assign({}, this.yandexBrowserDefault);
        }
        if (options.design.yandexBrowser) {
            if (options.background && !options.design.yandexBrowser.backgroundColor) {
                options.design.yandexBrowser.backgroundColor = options.background;
            }
            if (options.version && !options.design.yandexBrowser.manifest.version) {
                options.design.yandexBrowser.manifest.version = options.version;
            }
        }

        // windows
        if (options.design.windows && typeof options.design.windows !== 'object') {
            options.design.windows = Object.assign({}, this.windowsDefault);
        }
        if (options.design.windows) {
            if (options.background && !options.design.windows.backgroundColor) {
                options.design.windows.backgroundColor = options.background;
            }
        }

        // coast
        if (options.design.coast && typeof options.design.coast !== 'object') {
            options.design.coast = Object.assign({}, this.coastDefault);
        }
        if (options.design.coast) {
            if (options.design.coast['offset'] && !options.design.coast.margin) {
                options.design.coast.margin = Math.round(228 / 100 * options.design.coast['offset']);
                delete options.design.coast['offset'];
            }
            if (options.background && !options.design.coast.backgroundColor) {
                options.design.coast.backgroundColor = options.background;
            }
        }

        // openGraph
        if (options.design.openGraph && typeof options.design.openGraph !== 'object') {
            options.design.openGraph = Object.assign({}, this.openGraphDefault);
        }
        if (options.design.openGraph) {
            if (options.background && !options.design.openGraph.backgroundColor) {
                options.design.openGraph.backgroundColor = options.background;
            }
        }

        return options;
    }
}
