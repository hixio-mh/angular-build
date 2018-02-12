import * as webpack from 'webpack';
import * as appInsights from 'applicationinsights';

import { AngularBuildContext } from '../../../models';

const uuidv4 = require('uuid/v4');
const uuidv5 = require('uuid/v5');

export class TelemetryWebpackPlugin {
    private static _telemetryInitialized = false;
    private static _telemetryFlushing = false;

    apply(compiler: webpack.Compiler): void {
        compiler.plugin('before-run',
            (_compiler: webpack.Compiler, cb: (err?: Error) => void) => {
                if ((global as any).angular_build_telemetry_initialized ||
                    TelemetryWebpackPlugin._telemetryInitialized) {
                    cb();
                    return;
                }

                TelemetryWebpackPlugin._telemetryInitialized = true;
                initAppInsights();
                cb();
            });

        compiler.plugin('done',
            (stats: webpack.Stats) => {
                if (AngularBuildContext.telemetryDisabled ||
                    AngularBuildContext.fromAngularBuildCli) {
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

                appInsights.defaultClient.flush();

                const verbose = AngularBuildContext.angularBuildConfig.logLevel === 'debug';
                if (verbose) {
                    const identifier = (global as any).angular_build_telemetry_identifier as string;
                    console.log('\n');
                    console.log(`Identifier: ${identifier}\n`);
                }
            });
    }
}


export function initAppInsights(): void {
    if ((global as any).angular_build_telemetry_initialized) {
        return;
    }

    (global as any).angular_build_telemetry_initialized = true;

    process.env.ANGULAR_BUILD_UUID_NS = `61c38600-38ac-411a-ad18-4daf41a5f0ad`;
    const identifier = `${uuidv5(`${uuidv4()}`, process.env.ANGULAR_BUILD_UUID_NS).substr(0, 8)}`;
    (global as any).angular_build_telemetry_identifier = identifier;

    if (!process.env.ANGULAR_BUILD_APPINSIGHTS_INSTRUMENTATIONKEY) {
        process.env.ANGULAR_BUILD_APPINSIGHTS_INSTRUMENTATIONKEY = process.env.ANGULAR_BUILD_UUID_NS;
    }

    const telemetryVerbose = process.argv.indexOf('--telemetry-verbose') > -1;
    const verbose = AngularBuildContext.angularBuildConfig.logLevel === 'debug';
    const fromAngularBuildCli =
        typeof AngularBuildContext.fromAngularBuildCli !== 'undefined' && AngularBuildContext.fromAngularBuildCli;
    const angularBuildVersion = AngularBuildContext.angularBuildVersion;
    const cliIsGlobal = AngularBuildContext.cliIsGlobal;
    const angularVersion = AngularBuildContext.angularVersion;
    const webpackVersion = AngularBuildContext.webpackVersion;

    let commonAppInsightsProps = {};
    if (process.env.ANGULAR_BUILD_APPINSIGHTS_commonAppInsightsProps &&
        typeof process.env.ANGULAR_BUILD_APPINSIGHTS_commonAppInsightsProps === 'string') {
        try {
            commonAppInsightsProps = JSON.parse(process.env.ANGULAR_BUILD_APPINSIGHTS_commonAppInsightsProps as string);
        } catch (err) {
            // do nothing
        }
    }

    commonAppInsightsProps = Object.assign({},
        commonAppInsightsProps,
        {
            'Identifier': identifier,
            'command': 'build',
            'angular-build version': `${angularBuildVersion}`,
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

    if (fromAngularBuildCli) {
        process.on('exit',
            code => {
                if (verbose) {
                    console.log('\n');
                    console.log(`Identifier: ${identifier}`);
                    console.log(`\nProcess is exited with code: ${code}\n`);
                }
            });
    }
}
