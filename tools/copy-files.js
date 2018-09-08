#!/usr/bin/env node

'use strict';

const fs = require('fs-extra');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const destDir = path.resolve(__dirname, '../dist');

fs.ensureDirSync(destDir);

// copy package.json
const packageJson = require('../package.json');
packageJson.main = 'src/index.js';
packageJson.typings = 'src/index.d.ts';
packageJson.builders = 'builders.json';

if (packageJson.devDependencies) {
  delete packageJson.devDependencies;
}
if (packageJson.scripts) {
  // delete packageJson.scripts;
  packageJson.scripts = {
    postinstall: 'node ./scripts/postinstall.js',
  };
}
fs.writeFileSync(path.resolve(destDir, 'package.json'), JSON.stringify(packageJson, null, 2));

// copy files
fs.copySync(path.resolve(rootDir, 'README.md'), path.resolve(destDir, 'README.md'));
fs.copySync(path.resolve(rootDir, 'LICENSE'), path.resolve(destDir, 'LICENSE'));
fs.copySync(path.resolve(rootDir, 'builders.json'), path.resolve(destDir, 'builders.json'));
fs.copySync(path.resolve(rootDir, 'bin/ngb'), path.resolve(destDir, 'bin/ngb'));
fs.copySync(path.resolve(rootDir, 'bin/ngb-cli.js'), path.resolve(destDir, 'bin/ngb-cli.js'));

// copy configs
fs.copy(path.resolve(rootDir, 'configs'), path.resolve(destDir, 'configs'));

// copy schemas
fs.copy(path.resolve(rootDir, 'schemas'), path.resolve(destDir, 'schemas'));

// copy scripts
fs.copy(path.resolve(rootDir, 'scripts'), path.resolve(destDir, 'scripts'));
