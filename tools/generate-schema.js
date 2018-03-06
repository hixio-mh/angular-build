#!/usr/bin/env node
'use strict';

const fs = require('fs-extra');
const path = require('path');
const spawn = require('cross-spawn');

function generateSchema() {
    const schemaOutDir = path.resolve(__dirname, '../dist/schemas');
    const angularBuildConfigModelInput = path.resolve(__dirname, './tsconfig-schema.json');
    const angularBuildConfigSchemaOutput = path.resolve(schemaOutDir, 'schema-draft-04.json');
    const angularBuildConfigSchemav6Output = path.resolve(schemaOutDir, 'schema.json');
    const angularBuildConfigSymbol = 'AngularBuildConfig';

    const faviconConfigModelInput = path.resolve(__dirname, './tsconfig-favicons-schema.json');
    const faviconConfigSchemaOutput = path.resolve(__dirname, schemaOutDir, 'favicon-config-schema-draft-04.json');
    const faviconConfigSchemav6Output = path.resolve(__dirname, schemaOutDir, 'favicon-config-schema.json');
    const faviconConfigSymbol = 'FaviconsConfig';

    fs.ensureDirSync(schemaOutDir);

    // angular-build schema
    spawn.sync(path.join(process.cwd(), 'node_modules/.bin/typescript-json-schema'),
        [angularBuildConfigModelInput, angularBuildConfigSymbol, '-o', angularBuildConfigSchemaOutput],
        { cwd: __dirname, stdio: 'inherit' });
    spawn.sync(path.join(process.cwd(), 'node_modules/.bin/ajv'),
        ['migrate', '-s', angularBuildConfigSchemaOutput, '-o', angularBuildConfigSchemav6Output],
        { stdio: 'inherit', cwd: process.cwd() });

    // favicon schema
    spawn.sync(path.join(process.cwd(), 'node_modules/.bin/typescript-json-schema'),
        [faviconConfigModelInput, faviconConfigSymbol, '-o', faviconConfigSchemaOutput],
        { cwd: __dirname, stdio: 'inherit' });
    spawn.sync(path.join(process.cwd(), 'node_modules/.bin/ajv'),
        ['migrate', '-s', faviconConfigSchemaOutput, '-o', faviconConfigSchemav6Output],
        { stdio: 'inherit', cwd: process.cwd() });

    const schemaCopyDir = path.resolve(__dirname, '../schemas');
    fs.ensureDirSync(schemaCopyDir);
    fs.copySync(schemaOutDir, schemaCopyDir);
}

if (process.argv.length >= 2 && process.argv[1] === path.resolve(__filename)) {
    generateSchema();
}

module.exports = generateSchema;
