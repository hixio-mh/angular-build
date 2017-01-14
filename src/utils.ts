import * as path from 'path';
import * as fs from 'fs';

// ReSharper disable once InconsistentNaming
const ExtractTextPlugin = require('extract-text-webpack-plugin');

import { ExtraEntry } from './models';

// create array of css loaders
// Ref: https://github.com/angular/angular-cli
export function makeCssLoaders(stylePaths: string[] = []) {
  const baseRules = [
    { test: /\.css$/, loaders: [] },
    { test: /\.scss$|\.sass$/, loaders: ['sass-loader'] },
    { test: /\.less$/, loaders: ['less-loader'] },
    { test: /\.styl$/, loaders: ['stylus-loader'] }
  ];

  const commonLoaders = ['postcss-loader'];

  // load component css as raw strings
  const cssLoaders: any = baseRules.map(({test, loaders}) => ({
    exclude: stylePaths, test, loaders: ['raw-loader'].concat(commonLoaders).concat(loaders)
  }));

  if (stylePaths && stylePaths.length > 0) {
    // load global css as css files
    cssLoaders.push(...baseRules.map(({test, loaders}) => ({
      include: stylePaths, test, loaders: ExtractTextPlugin.extract({
        remove: false,
        loader: ['css-loader'].concat(commonLoaders).concat(loaders),
        fallbackLoader: 'style-loader'
      })
    })));
  }

  return cssLoaders;
}

// convert all extra entries into the object representation, fill in defaults
// Ref: https://github.com/angular/angular-cli
export function extraEntryParser(
  extraEntries: (string | ExtraEntry)[],
  appRoot: string,
  defaultEntry: string
): ExtraEntry[] {
  if (!extraEntries || !extraEntries.length) {
    return [];
  }
  return extraEntries
    .map((extraEntry: string | ExtraEntry) =>
      typeof extraEntry === 'string' ? { input: extraEntry } : extraEntry)
    .map((extraEntry: ExtraEntry) => {
      extraEntry.path = path.resolve(appRoot, extraEntry.input);
      if (extraEntry.output) {
        extraEntry.entry = extraEntry.output.replace(/\.(js|css)$/i, '');
      } else if (extraEntry.lazy) {
        extraEntry.entry = extraEntry.input.replace(/\.(js|css|scss|sass|less|styl)$/i, '');
      } else {
        extraEntry.entry = defaultEntry;
      }
      return extraEntry;
    });
}

export function parseDllEntryValues(baseDir: string, entryValue: any, env: string): string[] {
  const dllList: string[] = [];

  if (Array.isArray(entryValue)) {
    entryValue.forEach((value) => {
      const list = parseDllEntryValue(baseDir, value, env);
      dllList.push(...list);
    });
  } else if (typeof entryValue === 'string' && entryValue.length) {
    let list = parseDllEntryValue(baseDir, entryValue, env);
    dllList.push(...list);
  }
  return dllList;
}

function parseDllEntryValue(baseDir: string, entryValue: string, env: string): string[] {
  const dllPath = path.resolve(baseDir, entryValue);
  if (fs.existsSync(dllPath)) {
    if (dllPath.match(/\.json$/)) {
      const dataArray = readJsonSync(dllPath);
      if (Array.isArray(dataArray)) {
        return dataArray;
      } else {
        throw new Error(`Invalid 'entry' value in dllEntry, file: ${dllPath}.`);
      }
    }
    if (dllPath.match(/\.(js|ts)$/)) {
      try {
        const data = require(dllPath);

        if (data && data.default && typeof data.default === 'function') {
          //return data.default(env);
          const dataArray = data.default(env);
          if (Array.isArray(dataArray)) {
            return dataArray;
          } else {
            throw new Error(`Invalid 'entry' value in dllEntry, file: ${dllPath}.`);
          }
        }
        if (data && typeof data === 'function') {
          const dataArray = data(env);
          if (Array.isArray(dataArray)) {
            return dataArray;
          } else {
            throw new Error(`Invalid 'entry' value in dllEntry, file: ${dllPath}.`);
          }
        }

        if (Array.isArray(data)) {
          return data;
        } else {
          return [entryValue];
        }
      } catch (ex) {
        return [entryValue];
      }
    }

  } else {
    return [entryValue];
  }
  throw new Error(`Invalid 'entry' value in dllEntry.`);
}

// Ref: https://github.com/angular/angular-cli
export function packageChunkSort(packages: string[]) {
  return (left: any, right: any) => {
    const leftIndex = packages.indexOf(left.names[0]);
    const rightindex = packages.indexOf(right.names[0]);

    if (leftIndex < 0 || rightindex < 0) {
      // Unknown packages are loaded last
      return 1;
    }

    if (leftIndex > rightindex) {
      return 1;
    }

    return -1;
  };
}

export function findNpmScriptCommandName(baseDir: string, keyFilter: RegExp, valueFilter?: RegExp): string {
  let pkgConfigPath = path.resolve(baseDir, 'package.json');
  if (!fs.existsSync(pkgConfigPath)) {
    pkgConfigPath = path.resolve(baseDir, '../package.json');
  }
  if (!fs.existsSync(pkgConfigPath)) {
    return null;
  }

  const pkgConfig = readJsonSync(pkgConfigPath);
  if (!pkgConfig.scripts) {
    return null;
  }
  const foundKey = Object.keys(pkgConfig.scripts).find((key: string) => {
    return keyFilter.test(key) && (!valueFilter || (valueFilter && valueFilter.test(pkgConfig.scripts[key])));
  });

  return foundKey;
}

export function tryBuildDll(manifestFiles: string[], debug: boolean, baseDir: string, command?: string, commandArgs?: string[]): void {
  try {
    manifestFiles
      .forEach((manifestFile: string) => {
        fs.accessSync(manifestFile);
      });
  } catch (err) {

    if (!command) {
      const npmScriptName = findNpmScriptCommandName(baseDir, /(dll([:\-]build)?)|((build[:\-])?dll)/i, /\s*webpack\s*/i);
      if (npmScriptName) {
        // 'npm', ['run', 'build:dll']
        command = 'npm';
        commandArgs = ['run', npmScriptName];
      } else {
        let webpackConfigFile = null;
        if (fs.existsSync(path.resolve(baseDir, 'webpack.config.dll.js'))) {
          webpackConfigFile = 'webpack.config.dll.js';
        } else if (fs.existsSync(path.resolve(baseDir, 'webpack.dll.js'))) {
          webpackConfigFile = 'webpack.dll.js';
        } else if (fs.existsSync(path.resolve(baseDir, 'webpackfile.dll.js'))) {
          webpackConfigFile = 'webpackfile.dll.js';
        } else if (fs.existsSync(path.resolve(baseDir, 'webpack.config.vendor.js'))) {
          webpackConfigFile = 'webpack.config.vendor.js';
        } else if (fs.existsSync(path.resolve(baseDir, 'webpack.vendor.js'))) {
          webpackConfigFile = 'webpack.vendor.js';
        } else if (fs.existsSync(path.resolve(baseDir, 'webpackfile.vendor.js'))) {
          webpackConfigFile = 'webpackfile.vendor.js';
        } else if (fs.existsSync(path.resolve(baseDir, 'webpack.config.dll.ts'))) {
          webpackConfigFile = 'webpack.config.dll.ts';
        } else if (fs.existsSync(path.resolve(baseDir, 'webpack.dll.ts'))) {
          webpackConfigFile = 'webpack.dll.ts';
        } else if (fs.existsSync(path.resolve(baseDir, 'webpackfile.dll.ts'))) {
          webpackConfigFile = 'webpackfile.dll.ts';
        } else if (fs.existsSync(path.resolve(baseDir, 'webpack.config.vendor.ts'))) {
          webpackConfigFile = 'webpack.config.vendor.ts';
        } else if (fs.existsSync(path.resolve(baseDir, 'webpack.vendor.ts'))) {
          webpackConfigFile = 'webpack.vendor.ts';
        } else if (fs.existsSync(path.resolve(baseDir, 'webpackfile.vendor.ts'))) {
          webpackConfigFile = 'webpackfile.vendor.ts';
        }

        if (webpackConfigFile) {
          command = 'node';
          const env = debug ? '--env.dev' : '--env.prod';
          commandArgs = ['node_modules/webpack/bin/webpack.js', '--config', webpackConfigFile, env];
        }

      }
    }

    tryToSpawn(command, commandArgs);
  }
}

export function tryToSpawn(command: string, commandArgs: string[]) {
  const spawn: any = require('cross-spawn');
  spawn.sync(command, commandArgs, { stdio: 'inherit' });
  return;
}

// Ref: https://github.com/AngularClass/angular2-webpack-starter
export function isWebpackDevServer(): boolean {
  return process.argv[1] && !!(/webpack-dev-server/.exec(process.argv[1]));
}

export function isDevelopmentBuild(): boolean {
  return !(
    (process.env.ASPNETCORE_ENVIRONMENT && process.env.ASPNETCORE_ENVIRONMENT.toLowerCase() === 'production') ||
    process.argv.indexOf('--env.prod') > -1 ||
    process.argv.indexOf('--env.production') > -1 ||
    process.argv.indexOf('--env.Production') > -1 ||
    (process.env.NODE_ENV && (process.env.NODE_ENV.toLowerCase() === 'prod' ||
      process.env.NODE_ENV.toLowerCase() === 'production')));
}

export function isDllBuildFromNpmEvent(eventName?: string): boolean {
  const lcEvent = process.env.npm_lifecycle_event;
  if (!lcEvent) {
    return false;
  }

  if (eventName) {
    return lcEvent.includes(eventName);
  } else {
    return lcEvent.includes('build:dll') ||
      lcEvent.includes('dll:build') ||
      lcEvent.includes(':dll') ||
      lcEvent === 'dll';
  }
}

export function isAoTBuildFromNpmEvent(eventName?: string): boolean {
  const lcEvent = process.env.npm_lifecycle_event;
  if (!lcEvent) {
    return false;
  }

  if (eventName) {
    return lcEvent.includes(eventName);
  } else {
    return lcEvent.includes('build:aot') ||
      lcEvent.includes('aot:build') ||
      lcEvent.includes(':aot') ||
      lcEvent === 'aot';
  }
}

export function stripComments(content: string): string {
  /**
   * First capturing group matches double quoted string
   * Second matches single quotes string
   * Third matches block comments
   * Fourth matches line comments
   */
  const regexp = /("(?:[^\\\"]*(?:\\.)?)*")|('(?:[^\\\']*(?:\\.)?)*')|(\/\*(?:\r?\n|.)*?\*\/)|(\/{2,}.*?(?:(?:\r?\n)|$))/g;
  const result = content.replace(regexp, (match, m1, m2, m3, m4) => {
    // Only one of m1, m2, m3, m4 matches
    if (m3) {
      // A block comment. Replace with nothing
      return "";
    } else if (m4) {
      // A line comment. If it ends in \r?\n then keep it.
      let length = m4.length;
      if (length > 2 && m4[length - 1] === "\n") {
        return m4[length - 2] === "\r" ? "\r\n" : "\n";
      } else {
        return "";
      }
    } else {
      // We match a string
      return match;
    }
  });
  return result;
};

export function readJsonSync(filePath: string) {
  const context = stripComments(fs.readFileSync(filePath).toString().replace(/^\uFEFF/, ''));
  return JSON.parse(context);
}
