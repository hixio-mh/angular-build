import * as path from 'path';
import * as chalk from 'chalk';
import * as glob from 'glob';

const webpackMerge = require('webpack-merge');

import { AppConfig, BuildOptions, TestOptions, AngularBuildConfig } from '../models';

// Configs
import { getCommonConfigPartial } from './common';
import { getAngularConfigPartial } from './angular';
import { getStylesConfigPartial } from './styles';
import { getNonDllConfigPartial } from './non-dll';
/**
 * Enumerate loaders and their dependencies from this file to let the dependency validator
 * know they are used.
 *
 * require('istanbul-instrumenter-loader')
 *
 */

export function getTestConfig(projectRoot: string, appConfig: AppConfig, buildOptions: BuildOptions, angularBuildConfig: AngularBuildConfig) {
    console.log(`\n${chalk.bgBlue('INFO:')} Getting test config, build env: ${JSON
        .stringify(buildOptions.environment)}, app name: ${appConfig.name}, app target: ${appConfig
            .target}, test entry: ${appConfig.test}\n`);

    const configs : any[] = [
        getCommonConfigPartial(projectRoot, appConfig, buildOptions),
        getAngularConfigPartial(projectRoot, appConfig, buildOptions),
        getTestConfigPartial(projectRoot, appConfig, angularBuildConfig.test),
        getStylesConfigPartial(projectRoot, appConfig, buildOptions)
    ];

    if (buildOptions.typescriptWebpackTool === '@ngtools/webpack') {
        configs.push(getNonDllConfigPartial(projectRoot, appConfig, angularBuildConfig.test));
    }

    return webpackMerge(configs);
}

export function getTestConfigPartial(projectRoot: string, appConfig: AppConfig, testOptions: TestOptions) {
    testOptions = testOptions || {};
    const extraRules: any[] = [];

    if (testOptions.codeCoverage) {
        let codeCoverageExclude: string[] = [];
        if (typeof testOptions.codeCoverage === 'object') {
            codeCoverageExclude = (<any>testOptions.codeCoverage).exclude || [];
        }

        let exclude: (string | RegExp)[] = [
            /\.(e2e|spec|e2e-spec)\.ts$/,
            /node_modules/
        ];

        if (codeCoverageExclude.length > 0) {
            codeCoverageExclude.forEach((excludeGlob: string) => {
                const excludeFiles = glob
                    .sync(path.join(projectRoot, excludeGlob), { nodir: true })
                    .map((file:string) => path.normalize(file));
                exclude.push(...excludeFiles);
            });
        }


        extraRules.push({
            test: /\.(js|ts)$/,
            loader: 'istanbul-instrumenter-loader',
            enforce: 'post',
            include: path.resolve(projectRoot, appConfig.root),
            exclude
        });
    }

    return {
        entry: {
            // appConfig.test
            test: path.resolve(projectRoot, appConfig.root, appConfig.test)
        },
        module: {
            rules: extraRules
        }
    };
}
