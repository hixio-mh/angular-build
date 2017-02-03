import * as path from 'path';
import * as fs from 'fs';

// ReSharper disable once InconsistentNaming
const HtmlWebpackPlugin = require('html-webpack-plugin');

import { AppConfig, BuildOptions } from '../models';
import { IconWebpackPlugin, IconPluginOptions } from '../plugins/icon-webpack-plugin';

import { readJsonSync } from '../utils';

export function getFaviconPlugins(projectRoot: string, appConfig: AppConfig, defaultTargetHtmlWebpackPluginId?: string) {
    const plugins: any[] = [];
    const appRoot = path.resolve(projectRoot, appConfig.root);
    let iconOptions: IconPluginOptions = null;
    const hashFormat = `-[hash:${20}]`;

    if (typeof appConfig.faviconConfig === 'string' && appConfig.faviconConfig.match(/\.json$/i)) {
        iconOptions = readJsonSync(path.resolve(appRoot, appConfig.faviconConfig));
    }

    if (!iconOptions || !iconOptions.masterPicture) {
        return plugins;
    }

    iconOptions.masterPicture = path.resolve(appRoot, iconOptions.masterPicture);
    if (!iconOptions.iconsPath) {
        iconOptions.iconsPath = appConfig.appendOutputHash
            ? `icons-${hashFormat}/`
            : 'icons/';
    }
    if (!iconOptions.statsFilename) {
        iconOptions.statsFilename = appConfig.appendOutputHash
            ? `iconstats-${hashFormat}.json`
            : 'iconstats.json';
    }
    if (typeof iconOptions.emitStats === 'undefined') {
        iconOptions.emitStats = false;
    }

    let iconsInjectOutFileName: string = null;
    if (appConfig.htmlInjectOptions && appConfig.htmlInjectOptions.iconsOutFileName) {
        iconsInjectOutFileName = appConfig.htmlInjectOptions.iconsOutFileName;
    }

    const iconHtmlSeparateOut = iconsInjectOutFileName !== null &&
        ((iconsInjectOutFileName !== appConfig.htmlInjectOptions.indexOutFileName) ||
            (iconsInjectOutFileName !== appConfig.index));

    if (typeof iconOptions.inject === 'undefined') {
        if (appConfig.index || appConfig.htmlInjectOptions.indexOutFileName || iconHtmlSeparateOut) {
            iconOptions.inject = true;
        } else {
            iconOptions.inject = true;
        }
    }

    const iconsHtmlWebpackPluginId = (iconOptions.inject && iconHtmlSeparateOut)
        ? 'IconsHtmlWebpackPlugin'
        : defaultTargetHtmlWebpackPluginId;

    let seperateOutput = false;
    // Seperate inject output
    if (iconOptions.inject && iconHtmlSeparateOut) {
        seperateOutput = true;

        plugins.push(new HtmlWebpackPlugin({
            templateContent: ' ',
            filename: path.resolve(projectRoot, appConfig.outDir, iconsInjectOutFileName),
            chunks: [],
            title: '',
            customAttributes: appConfig.htmlInjectOptions.customTagAttributes,
            inject: true,
            id: iconsHtmlWebpackPluginId
        }));
    }

    iconOptions.targetHtmlWebpackPluginId = iconsHtmlWebpackPluginId;
    iconOptions.seperateOutput = seperateOutput;

    plugins.push(
        new IconWebpackPlugin(iconOptions)
    );

    return plugins;
}