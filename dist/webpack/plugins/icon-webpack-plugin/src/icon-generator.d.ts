/// <reference types="node" />
import { IconOptions, IconResult } from './models';
export declare class IconGenerator {
    private readonly androidChromeDefault;
    private readonly iosDefault;
    private readonly desktopBrowserDefault;
    private readonly windowsDefault;
    private readonly safariPinnedTabDefault;
    private readonly firefoxAppDefault;
    private readonly yandexBrowserDefault;
    private readonly coastDefault;
    private readonly openGraphDefault;
    generateIcons(imageFileStream: Buffer, iconsPath: string, online: boolean, preferOnline: boolean, options: IconOptions, cb: (err?: Error, result?: IconResult) => void): void;
    private generateOffline(imageFileStream, iconsPath, options, cb);
    private prepareOfflineOptions(iconOptions);
    private generateRfgOnline(imageFileStream, iconsPath, preferOnline, options, cb);
    private fetchRfgIconPack(url, cb);
    private prepareRfgOnlineOptions(imageFileStream, iconOptions);
}
