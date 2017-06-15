// Karma configuration file, see link for more information
// https://karma-runner.github.io/0.13/config/configuration-file.html

module.exports = function (config) {
    const karmaConfigOptions = require('@bizappframework/angular-build').getKarmaConfigOptions(__dirname);

    const configuration = {
        basePath: '',
        frameworks: ['jasmine'],
        files: [],
        exclude: [],
        preprocessors: {},
        proxies: {},
        autoWatch: false,
        client: {
            //captureConsole: false,
            clearContext: false // leave Jasmine Spec Runner output visible in browser
        },
        port: 9876,
        colors: true,
        logLevel: config.LOG_INFO,
        browsers: ['Chrome'],
        singleRun: false,
        mime: {
            'text/x-typescript': ['ts', 'tsx']
        },

        webpackMiddleware: {
            noInfo: true,
            stats: 'errors-only'
        },

        //reporters: ['mocha', 'coverage-istanbul'],

        coverageIstanbulReporter: {
            reports: ['html', 'lcovonly'],
            fixWebpackSourcePaths: true
        }
    };

    configuration.files.push(...karmaConfigOptions.files);
    configuration.preprocessors = Object.assign(configuration.preprocessors, karmaConfigOptions.preprocessors);
    configuration.proxies = Object.assign(configuration.proxies, karmaConfigOptions.proxies);
    configuration.webpack = karmaConfigOptions.webpackConfig;
    configuration.reporters = karmaConfigOptions.codeCoverage
        ? ['mocha', 'coverage-istanbul']
        : ['progress', 'kjhtml'];
    configuration.singleRun = karmaConfigOptions.codeCoverage ? true : false;

    config.set(configuration);
};
