// require('ts-node').register({
//     compilerOptions: {
//         target: 'es2015',
//         module: 'commonjs',
//         moduleResolution: 'node',
//         sourceMap: true,
//         skipDefaultLibCheck: true,
//         skipLibCheck: true,
//         noEmitOnError: true,
//         lib: ['es2017'],
//         types: [],
//         baseUrl: '.'
//     }
// });

const path = require('path');
const { getWebpackConfig } = require('../../dist');

module.exports = function (env, argv) {
    return getWebpackConfig(path.resolve(__dirname, 'angular-build.json'), env, argv);
};
