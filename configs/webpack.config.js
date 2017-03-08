require('ts-node').register({
    compilerOptions: {
        target: 'es6',
        module: 'commonjs',
        moduleResolution: 'node',
        sourceMap: true,
        skipDefaultLibCheck: true,
        lib: ['es2015']
    }
});
const getWebpackConfigs = require('@bizappframework/angular-build').getWebpackConfigs;

//const configs = getWebpackConfigs(__dirname);
//if (!configs || !configs.length) {
//  throw new Error('No webpack config available.');
//}
//module.exports = configs;

module.exports = function (env) {
    //console.log(`env: ${JSON.stringify(env)}\n`);
    const configs = getWebpackConfigs(__dirname, { environment: env });
    if (!configs || !configs.length) {
        throw new Error('No webpack config available.');
    }

    return configs;
};