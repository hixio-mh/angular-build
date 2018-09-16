// tslint:disable:no-any
// tslint:disable:no-unsafe-any
// tslint:disable:no-var-requires
// tslint:disable:no-require-imports

import * as path from 'path';

import * as appInsights from 'applicationinsights';
import * as webpack from 'webpack';

import { AngularBuildContext } from '../../../build-context';

const uuidv4 = require('uuid/v4');
const uuidv5 = require('uuid/v5');

const ANGULAR_BUILD_APPINSIGHTS_INSTRUMENTATIONKEY = '110b2760-eac4-48ba-8a0f-3c9648c6e051';

// tslint:disable-next-line:no-typeof-undefined
const g: any = typeof global !== 'undefined' ? global : {};

export class TelemetryWebpackPlugin {
    private static _telemetryInitialized = false;
    private static _telemetryFlushQueued = false;
    private static _counter = 0;
    private static _buildSuccess = true;

    get name(): string {
        return 'telemetry-webpack-plugin';
    }

    apply(compiler: webpack.Compiler): void {
        compiler.hooks.beforeRun.tap(this.name, () => {
            TelemetryWebpackPlugin.initAppInsights();
        });

        compiler.hooks.done.tap(this.name, (stats: webpack.Stats) => {
            if (AngularBuildContext.telemetryDisabled) {
                return;
            }

            TelemetryWebpackPlugin._buildSuccess = TelemetryWebpackPlugin._buildSuccess && stats.hasErrors();

            TelemetryWebpackPlugin._counter = TelemetryWebpackPlugin._counter + 1;
            const totalCount = AngularBuildContext.libCount + AngularBuildContext.appCount;

            if (TelemetryWebpackPlugin._counter !== totalCount) {
                return;
            }

            if (g._telemetryFlushQueued || TelemetryWebpackPlugin._telemetryFlushQueued) {
                return;
            }

            TelemetryWebpackPlugin._telemetryFlushQueued = true;
            g._telemetryFlushQueued = true;

            const duration = Date.now() - AngularBuildContext.startTime;
            const status = TelemetryWebpackPlugin._buildSuccess ? 'failing' : 'passing';

            const customProps = {
                libs: `${AngularBuildContext.libCount}`,
                apps: `${AngularBuildContext.appCount}`,
                duration: `${duration}`,
                status: status
            };

            appInsights.defaultClient.trackEvent({
                name: 'build',
                properties: customProps
            });

            appInsights.defaultClient.flush();
            g._telemetryFlushStartTime = Date.now();

            setImmediate(() => {
                const telemetryVerbose = process.argv.indexOf('--telemetry-verbose') > -1;
                if (telemetryVerbose) {
                    const identifier = g._angular_build_telemetry_identifier as string;

                    // tslint:disable-next-line:no-console
                    console.log(`\nIdentifier: ${identifier}\n`);
                }
            });
        });
    }

    static initAppInsights(): void {
        if (g._angular_build_telemetry_initialized || TelemetryWebpackPlugin._telemetryInitialized) {
            return;
        }

        g._angular_build_telemetry_initialized = true;
        TelemetryWebpackPlugin._telemetryInitialized = true;

        const identifier = `${uuidv5(`${uuidv4()}`, ANGULAR_BUILD_APPINSIGHTS_INSTRUMENTATIONKEY).substr(0, 8)}`;
        g._angular_build_telemetry_identifier = identifier;

        if (!process.env.ANGULAR_BUILD_APPINSIGHTS_INSTRUMENTATIONKEY) {
            process.env.ANGULAR_BUILD_APPINSIGHTS_INSTRUMENTATIONKEY = ANGULAR_BUILD_APPINSIGHTS_INSTRUMENTATIONKEY;
        }

        const telemetryVerbose = process.argv.indexOf('--telemetry-verbose') > -1;
        const cliVersion = AngularBuildContext.cliVersion;
        const cliName = path.parse(process.argv[1]).name;

        const angularVersion = AngularBuildContext.angularVersion;
        const webpackVersion = AngularBuildContext.webpackVersion;

        let commonAppInsightsProps: { [key: string]: string } = {};
        const rawCommonAppInsightsProps = process.env.ANGULAR_BUILD_APPINSIGHTS_COMMON_PROPS ||
            process.env.ANGULAR_BUILD_APPINSIGHTS_commonAppInsightsProps;
        if (rawCommonAppInsightsProps && typeof rawCommonAppInsightsProps === 'string') {
            if ((rawCommonAppInsightsProps).trim()[0] === '{') {
                try {
                    commonAppInsightsProps = JSON.parse(rawCommonAppInsightsProps);
                } catch (err) {
                    // do nothing
                }
            } else {
                const props = rawCommonAppInsightsProps.split(';');
                props.forEach(s => {
                    if (s && s.length >= 3) {
                        const items = s.split('=');
                        if (items.length === 2) {
                            commonAppInsightsProps[items[0].trim()] = items[1].trim();
                        }
                    }
                });
            }
        } else if (rawCommonAppInsightsProps && typeof rawCommonAppInsightsProps === 'object') {
            commonAppInsightsProps = rawCommonAppInsightsProps;
        }

        commonAppInsightsProps = {
            ...commonAppInsightsProps,
            Identifier: identifier,
            command: 'build',
            'angular-build version': `${cliVersion}`,
            cli: `${cliName}`,
            'angular version': `${angularVersion}`,
            'webpack version': `${webpackVersion}`
        };

        appInsights.setup(process.env.ANGULAR_BUILD_APPINSIGHTS_INSTRUMENTATIONKEY)
            .setUseDiskRetryCaching(true, 100)
            .setAutoCollectPerformance(false)
            .setAutoCollectRequests(false)
            .setAutoCollectConsole(false)
            .setAutoCollectExceptions(false)
            .setAutoDependencyCorrelation(false)
            .setAutoCollectDependencies(false)
            .setInternalLogging(telemetryVerbose, telemetryVerbose);
        appInsights.defaultClient.commonProperties = commonAppInsightsProps;
        appInsights.defaultClient.config.disableAppInsights = AngularBuildContext.telemetryDisabled;
        appInsights.start();
    }
}
