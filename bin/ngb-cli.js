'use strict';

process.title = 'angular-build';

const startTime = Date.now();

const fs = require('fs');
const path = require('path');
const resolve = require('resolve');

const exitImmediate = process.argv.indexOf('--exit-immediate') > -1 || process.argv.indexOf('--exitImmediate') > -1;

function _exit(code) {
    if (process.platform === 'win32' && process.stdout.bufferSize) {
        process.stdout.once('drain', function () {
            process.exit(code);
        });

        return;
    }

    process.exit(code);
}

function _invokeCli(cli, cliOptions) {
    if ('default' in cli) {
        cli = cli.default;
    }

    cli(cliOptions)
        .then((exitCode) => {
            process.exitCode = typeof exitCode === 'number' ? exitCode : 0;

            if (exitImmediate) {
                _exit(process.exitCode);
            }
        })
        .catch(err => {
            process.exitCode = -1;
            console.error(`${err.stack || err.message}`);
            _exit(process.exitCode);
        });
}

function _cliGlobal() {
    let cliRootPath = path.resolve(__dirname, '..');
    if (!fs.existsSync(path.resolve(cliRootPath, 'node_modules'))) {
        cliRootPath = path.dirname(cliRootPath);
    }

    const packageJson = require(path.resolve(cliRootPath, './package.json'));
    const cliVersion = packageJson['version'];

    const updateNotifier = require('update-notifier');
    updateNotifier({
        pkg: packageJson
    }).notify({
        defer: false
    });

    let cli;
    if (fs.existsSync(path.resolve(__dirname, '../src/cli/index.js'))) {
        cli = require('../src/cli');
    } else {
        cli = require('../dist/src/cli');
    }

    const cliOptions = {
        cliVersion: cliVersion,
        cliIsGlobal: true,
        cliRootPath: cliRootPath,
        startTime: startTime
    };

    _invokeCli(cli, cliOptions);
}

// main
let _workspaceRoot = process.cwd();
const _args = process.argv.slice(2);

if (_args.length >= 2 && _args[0] && _args[0].toLocaleLowerCase() === 'build') {
    const argv = require('yargs')
        .option('config', {
            alias: 'c',
            type: 'string'
        })
        .option('global', {
            alias: 'g',
            type: 'boolean'
        })
        .argv;

    if (argv.config && !argv.global) {
        let configPath = argv.config;
        configPath = path.isAbsolute(configPath) ? path.resolve(configPath) : path.resolve(process.cwd(), configPath);
        _workspaceRoot = path.dirname(configPath);
    }
}

resolve('@dagonmetric/angular-build', {
    basedir: _workspaceRoot
}, (error, projectLocalCli) => {
    if (error) {
        _cliGlobal();

        return;
    }

    if (_args.length >= 3 && _args[0] && _args[0].toLowerCase() === 'build') {
        const argv = require('yargs')
            .option('global', {
                alias: 'g',
                type: 'boolean'
            })
            .argv;

        if (argv.global) {
            _cliGlobal();

            return;
        }
    }

    let cliIsLink = false;
    const projectLocalCliRealPath = fs.realpathSync(projectLocalCli);
    if (projectLocalCliRealPath !== projectLocalCli) {
        cliIsLink = true;
    }

    const cliPath = path.dirname(projectLocalCli);
    let packageJsonPath = path.resolve(cliPath, './package.json');
    if ((!fs.existsSync(packageJsonPath) || !fs.existsSync(path.resolve(cliPath, 'node_modules'))) &&
        fs.existsSync(path.resolve(cliPath, '..', './package.json'))) {
        packageJsonPath = path.resolve(cliPath, '..', './package.json');
    }

    const packageJson = require(packageJsonPath);
    const cliVersion = packageJson['version'];

    const localCliPath = path.resolve(cliPath, './cli');
    const cli = require(localCliPath);

    const cliOptions = {
        cliVersion: cliVersion,
        cliIsGlobal: false,
        cliIsLink: cliIsLink,
        cliRootPath: path.dirname(packageJsonPath),
        startTime: startTime
    };

    _invokeCli(cli, cliOptions);
});
