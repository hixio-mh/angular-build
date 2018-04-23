#!/usr/bin/env node
'use strict';

const fs = require('fs-extra');
const path = require('path');
const spawn = require('cross-spawn');

function _updateSchema(schemaFilePath) {
    const schemaJson = require(schemaFilePath);
    if (schemaJson.$schema) {
        delete schemaJson.$schema;
    }

    fs.writeFileSync(schemaFilePath, JSON.stringify(schemaJson, null, 2));
}

function _generateSchema(input, typeSymbol, output) {
    spawn.sync(path.join(process.cwd(), 'node_modules/.bin/typescript-json-schema'),
        [input, typeSymbol, '-o', output],
        { cwd: __dirname, stdio: 'inherit' });

    _updateSchema(output);
}

function generateSchemas() {
    const schemaOutDir = path.resolve(__dirname, '../schemas');
    const tsConfigInput = path.resolve(__dirname, './tsconfig-schema.json');

    fs.ensureDirSync(schemaOutDir);

    _generateSchema(tsConfigInput, 'AngularBuildConfig', path.resolve(schemaOutDir, 'schema.json'));
    _generateSchema(tsConfigInput, 'AppBuilderOptions', path.resolve(schemaOutDir, 'app-builder-options-schema.json'));
    _generateSchema(tsConfigInput, 'AppProjectConfig', path.resolve(schemaOutDir, 'app-project-config-schema.json'));
    _generateSchema(tsConfigInput, 'FaviconsConfig', path.resolve(schemaOutDir, 'favicon-config-schema.json'));
    _generateSchema(tsConfigInput, 'LibBuilderOptions', path.resolve(schemaOutDir, 'lib-builder-options-schema.json'));
    _generateSchema(tsConfigInput, 'LibProjectConfig', path.resolve(schemaOutDir, 'lib-project-config-schema.json'));
}

if (process.argv.length >= 2 && process.argv[1] === path.resolve(__filename)) {
    generateSchemas();
}

module.exports = generateSchemas;
