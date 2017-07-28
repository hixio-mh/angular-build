// require('ts-node').register({
//    compilerOptions: {
//        target: 'es6',
//        module: 'commonjs',
//        moduleResolution: 'node',
//        sourceMap: true,
//        skipDefaultLibCheck: true,
//        lib: ['es2015']
//    }
// });
const getAppWebpackConfigs = require('@bizappframework/angular-build').getAppWebpackConfigs;

module.exports = function (env) {
    let buildOptions = {};

    if (!env && process.env.WEBPACK_ENV) {
        const envObj = typeof process.env.WEBPACK_ENV === 'object'
            ? process.env.WEBPACK_ENV
            : JSON.parse(process.env.WEBPACK_ENV);
        if (typeof envObj === 'object') {
            env = envObj;
        }
    }

    if (env && env.buildOptions) {
        if (typeof env.buildOptions === 'object') {
            buildOptions = Object.assign({}, env.buildOptions);
        }
        delete env.buildOptions;
    }

    if (env && typeof env === 'object') {
        buildOptions.environment = env;
    }

    const configs = getAppWebpackConfigs(__dirname, buildOptions);
    if (!configs || !configs.length) {
        throw new Error('No webpack config available.');
    }

    return configs.length === 1 ? configs[0] : configs;
};
