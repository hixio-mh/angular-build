// Protractor configuration file, see link for more information
// https://github.com/angular/protractor/blob/master/lib/config.ts

// ReSharper disable once InconsistentNaming
const { SpecReporter } = require('jasmine-spec-reporter');

const appRoot = 'src';

exports.config = {
    //seleniumAddress: 'http://localhost:4444/wd/hub',

    baseUrl: 'http://localhost:5000/',

    // use `npm run e2e`
    specs: [
        `./${appRoot}/**/*.e2e.ts`
        //`./${appRoot}/**/*.e2e-spec.ts`
    ],

    exclude: [],

    framework: 'jasmine', // jasmine2

    allScriptsTimeout: 110000,

    jasmineNodeOpts: {
        showTiming: true,
        showColors: true,
        isVerbose: false,
        includeStackTrace: false,
        defaultTimeoutInterval: 400000
    },

    capabilities: {
        'browserName': 'chrome'
        //'chromeOptions': {
        //  'args': ['show-fps-counter=true']
        //}
    },

    directConnect: true,

    beforeLaunch: function () {
        //require('ts-node').register({
        //  project: 'tsconfig.e2e.json'
        //});
        require('ts-node').register({
            compilerOptions: {
                target: 'es6',
                module: 'commonjs',
                moduleResolution: 'node',
                sourceMap: true,
                skipDefaultLibCheck: true,
                lib: ['es2016', 'dom']
            }
        });
    },

    onPrepare: function () {
        //browser.ignoreSynchronization = true;
        jasmine.getEnv().addReporter(new SpecReporter({ spec: { displayStacktrace: true } }));
    }

    /**
     * Angular 2 configuration
     *
     * useAllAngular2AppRoots: tells Protractor to wait for any angular2 apps on the page instead of just the one matching
     * `rootEl`
     */
    //useAllAngular2AppRoots: true
};
