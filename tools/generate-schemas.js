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
        [input, typeSymbol, '-o', output], {
            cwd: __dirname,
            stdio: 'inherit'
        });

    _updateSchema(output);
}

function generateSchemas() {
    const defaultSchemaOutDir = path.resolve(__dirname, '../dist/schemas');
    const builderSchemaOutDir = path.resolve(__dirname, '../dist/src/architect/schemas');

    const tsConfigInput = path.resolve(__dirname, './tsconfig-schema.json');

    fs.ensureDirSync(defaultSchemaOutDir);
    fs.ensureDirSync(builderSchemaOutDir);

    _generateSchema(tsConfigInput, 'AngularBuildConfig', path.resolve(defaultSchemaOutDir, 'schema.json'));
    _generateSchema(tsConfigInput, 'AppProjectConfig', path.resolve(defaultSchemaOutDir, 'app-project-config-schema.json'));
    _generateSchema(tsConfigInput, 'LibProjectConfig', path.resolve(defaultSchemaOutDir, 'lib-project-config-schema.json'));

    _generateSchema(tsConfigInput, 'AppBuilderOptions', path.resolve(builderSchemaOutDir, 'app-builder-options-schema.json'));
    _generateSchema(tsConfigInput, 'LibBuilderOptions', path.resolve(builderSchemaOutDir, 'lib-builder-options-schema.json'));
}

if (process.argv.length >= 2 && process.argv[1] === path.resolve(__filename)) {
    generateSchemas();
}

module.exports = generateSchemas;
