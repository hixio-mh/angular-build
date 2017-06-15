#!/usr/bin/env node
'use strict';

const fs = require('fs-extra');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const destDir = path.resolve(__dirname, '../dist');

fs.ensureDirSync(destDir);

fs.copy(path.resolve(rootDir, 'README.md'), path.resolve(destDir, 'README.md'));
fs.copy(path.resolve(rootDir, 'LICENSE'), path.resolve(destDir, 'LICENSE'));
fs.copy(path.resolve(rootDir, 'templates'), path.resolve(destDir, 'templates'));