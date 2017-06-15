#!/usr/bin/env node
'use strict';

const fs = require('fs-extra');
const path = require('path');

const packageJson = require('../package.json');
packageJson.main = 'index.js';
packageJson.typings = 'index.d.ts';
if (packageJson.devDependencies) {
    delete packageJson.devDependencies;
}
if (packageJson.srcipts) {
    delete packageJson.srcipts;
}
const destFile = path.resolve(__dirname, '../dist/package.json');
const destDir = path.dirname(destFile);
fs.ensureDirSync(destDir);
fs.writeFileSync(destFile, JSON.stringify(packageJson, null, 2));

fs.copy(path.resolve(__dirname, '../bin', 'angular-build'), path.resolve(destDir, 'bin', 'angular-build'));
fs.copy(path.resolve(__dirname, '../bin', 'ngb'), path.resolve(destDir, 'bin', 'ngb'));