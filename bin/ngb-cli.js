'use strict';

process.title = 'angular-build';

const startTime = Date.now();

const fs = require('fs');
const path = require('path');
const util = require('util');

const resolve = require('resolve');

const realpathPromise = util.promisify(fs.realpath);
const existsPromise = util.promisify(fs.exists);

const resolvePromise = (id, opts) => {
    return new Promise((res) => {
        resolve(id, opts, (error, resolvedPath) => {
            error ? res(null) : res(resolvedPath);
        });
    });
};

// main
let _workspaceRoot = process.cwd();
const _args = process.argv.slice(2);
let _argv;

if (_args.length >= 2 && _args[0] && _args[0].toLocaleLowerCase() === 'build') {
    _argv = require('yargs')
        .option('config', {
            alias: 'c',
            type: 'string'
        })
        .option('global', {
            alias: 'g',
            type: 'boolean'
        })
        .option('exit-immediate', {
            type: 'boolean'
        })
        .argv;

    if (_argv.config && !_argv.global) {
        let configPath = _argv.config;
        configPath = path.isAbsolute(configPath) ? path.resolve(configPath) : path.resolve(process.cwd(), configPath);
        _workspaceRoot = path.dirname(configPath);
    }
}

function exit(code) {
    if (process.platform === 'win32' && process.stdout.bufferSize) {
        process.stdout.once('drain', function () {
            process.exit(code);
        });

        return;
    }

    process.exit(code);
}

async function main() {
    const localCli = await resolvePromise('@dagonmetric/angular-build', {
        basedir: _workspaceRoot
    });

    let cliIsGlobal = true;
    let cliIsLink = false;
    let tempCliPath;
    let packageJsonPath = '';

    if (localCli) {
        const localCliRealPath = await realpathPromise(localCli);
        if (localCliRealPath !== localCli) {
            cliIsLink = true;
        }
        tempCliPath = path.dirname(localCli);

        if (!cliIsLink && _argv && _argv.global) {
            let tempGlobalCliRootPath = path.resolve(__dirname, '..');
            let p1 = '';
            let p2 = '';

            if (await existsPromise(path.resolve(tempCliPath, './package.json')) &&
                await existsPromise(path.resolve(tempCliPath, 'node_modules'))) {
                p1 = path.resolve(tempCliPath, './package.json');
            } else if (await existsPromise(path.resolve(tempCliPath, '..', './package.json'))) {
                p1 = path.resolve(tempCliPath, '..', './package.json');
            }

            if (await existsPromise(path.resolve(tempGlobalCliRootPath, './package.json')) &&
                await existsPromise(path.resolve(tempGlobalCliRootPath, 'node_modules'))) {
                p2 = path.resolve(tempGlobalCliRootPath, './package.json');
            } else if (await existsPromise(path.resolve(tempGlobalCliRootPath, '..', './package.json'))) {
                p2 = path.resolve(tempGlobalCliRootPath, '..', './package.json');
            }

            if (p2 && p2 !== p1) {
                tempCliPath = tempGlobalCliRootPath;
                packageJsonPath = p2;
                cliIsGlobal = true;
            } else {
                packageJsonPath = p1;
                cliIsGlobal = false;
            }
        } else {
            cliIsGlobal = false;
        }

    } else {
        tempCliPath = path.resolve(__dirname, '..');
        cliIsGlobal = true;
    }

    if (!packageJsonPath && await existsPromise(path.resolve(tempCliPath, './package.json')) &&
        await existsPromise(path.resolve(tempCliPath, 'node_modules'))) {
        packageJsonPath = path.resolve(tempCliPath, './package.json');
    } else if (!packageJsonPath && await existsPromise(path.resolve(tempCliPath, '..', './package.json'))) {
        packageJsonPath = path.resolve(tempCliPath, '..', './package.json');
    }

    if (!packageJsonPath) {
        console.error('Could not detect package.json file path.');
        process.exitCode = -1;

        return;
    }

    const packageJson = require(packageJsonPath);
    const cliVersion = packageJson['version'];
    let cli;

    if (localCli) {
        const localCliPath = path.resolve(path.dirname(localCli), './cli');
        cli = require(localCliPath);
    } else {
        const updateNotifier = require('update-notifier');
        updateNotifier({
            pkg: packageJson
        }).notify({
            defer: false
        });

        if (await existsPromise(path.resolve(__dirname, '../src/cli/index.js'))) {
            cli = require('../src/cli');
        } else {
            cli = require('../dist/src/cli');
        }
    }

    const cliOptions = {
        cliVersion: cliVersion,
        cliIsGlobal: cliIsGlobal,
        cliIsLink: cliIsLink,
        cliRootPath: path.dirname(packageJsonPath),
        startTime: startTime
    };

    if ('default' in cli) {
        cli = cli.default;
    }

    try {
        const exitCode = await cli(cliOptions);

        process.exitCode = typeof exitCode === 'number' ? exitCode : 0;
        if (_argv && _argv.exitImmediate) {
            exit(process.exitCode);
        }
    } catch (err) {
        process.exitCode = -1;
        console.error(`${err.stack || err.message || err}`);
        exit(process.exitCode);
    }
}

main();
