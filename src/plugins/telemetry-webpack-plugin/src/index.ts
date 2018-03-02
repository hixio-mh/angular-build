import * as webpack from 'webpack';
import * as appInsights from 'applicationinsights';

import { AngularBuildContext } from '../../../models';

const uuidv4 = require('uuid/v4');
const uuidv5 = require('uuid/v5');

export class TelemetryWebpackPlugin {
    private static _telemetryInitialized = false;
    private static _telemetryFlushing = false;

    get name(): string {
        return 'telemetry-webpack-plugin';
    }

    apply(compiler: any): void {
        compiler.hooks.beforeRun.tap(this.name, () => {
            if ((global as any).angular_build_telemetry_initialized ||
                TelemetryWebpackPlugin._telemetryInitialized) {
                return;
            }

            TelemetryWebpackPlugin._telemetryInitialized = true;
            initAppInsights();
        });

        compiler.hooks.done.tap(this.name, (stats: webpack.Stats) => {
            if (AngularBuildContext.telemetryDisabled) {
                return;
            }

            if (TelemetryWebpackPlugin._telemetryFlushing) {
                return;
            }

            TelemetryWebpackPlugin._telemetryFlushing = true;
            const duration = Date.now() - AngularBuildContext.startTime;
            const status = stats.hasErrors() ? 'failing' : 'passing';

            const customProps = {
                libs: `${AngularBuildContext.libCount}`,
                apps: `${AngularBuildContext.appCount}`,
                production: `${typeof AngularBuildContext.environment.prod !== 'undefined' &&
                    AngularBuildContext.environment.prod}`,
                duration: `${duration}`,
                status: status
            };

            appInsights.defaultClient.trackEvent({
                name: 'build',
                properties: customProps
            });

            setImmediate(() => {
                appInsights.defaultClient.flush();

                const verbose = AngularBuildContext.angularBuildConfig.logLevel === 'debug';
                if (verbose) {
                    const identifier = (global as any).angular_build_telemetry_identifier as string;

                    // tslint:disable-next-line:no-console
                    console.log(`\nIdentifier: ${identifier}\n`);
                }
            });
        });
    }
}

export function initAppInsights(): void {
    if ((global as any).angular_build_telemetry_initialized) {
        return;
    }

    (global as any).angular_build_telemetry_initialized = true;

    process.env.ANGULAR_BUILD_UUID_NS = '61c38600-38ac-411a-ad18-4daf41a5f0ad';
    const identifier = `${uuidv5(`${uuidv4()}`, process.env.ANGULAR_BUILD_UUID_NS).substr(0, 8)}`;
    (global as any).angular_build_telemetry_identifier = identifier;

    if (!process.env.ANGULAR_BUILD_APPINSIGHTS_INSTRUMENTATIONKEY) {
        process.env.ANGULAR_BUILD_APPINSIGHTS_INSTRUMENTATIONKEY = process.env.ANGULAR_BUILD_UUID_NS;
    }

    const telemetryVerbose = process.argv.indexOf('--telemetry-verbose') > -1;
    const fromAngularBuildCli =
        typeof AngularBuildContext.fromAngularBuildCli !== 'undefined' && AngularBuildContext.fromAngularBuildCli;
    const cliVersion = AngularBuildContext.cliVersion;
    const cliIsGlobal = AngularBuildContext.cliIsGlobal;
    const angularVersion = AngularBuildContext.angularVersion;
    const webpackVersion = AngularBuildContext.webpackVersion;

    let commonAppInsightsProps: { [key: string]: any } = {};
    const rawCommonAppInsightsProps = process.env.ANGULAR_BUILD_APPINSIGHTS_COMMON_PROPS ||
        process.env.ANGULAR_BUILD_APPINSIGHTS_commonAppInsightsProps;
    if (rawCommonAppInsightsProps && typeof rawCommonAppInsightsProps === 'string') {
        if ((rawCommonAppInsightsProps as string).trim()[0] === '{') {
            try {
                commonAppInsightsProps = JSON.parse(rawCommonAppInsightsProps as string);
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

    commonAppInsightsProps = Object.assign({},
        commonAppInsightsProps,
        {
            'Identifier': identifier,
            'command': 'build',
            'angular-build version': `${cliVersion}`,
            'from angular-build cli': `${fromAngularBuildCli}`,
            'angular build is global': `${cliIsGlobal}`,
            'angular version': `${angularVersion}`,
            'webpack version': `${webpackVersion}`
        });

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
