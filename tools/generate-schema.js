#!/usr/bin/env node
'use strict';

const spawn = require('cross-spawn');
const fs = require('fs-extra');
const path = require('path');

const schemaOutDir = path.resolve(__dirname, '../src/schemas');
const angularBuildConfigModelInput = path.resolve(__dirname, '../src/models/index.ts');
const angularBuildConfigSchemaOutput = path.resolve(schemaOutDir, 'schema-draft-04.json');
const angularBuildConfigSchemav6Output = path.resolve(schemaOutDir, 'schema.json');
const angularBuildConfigSymbol = 'AngularBuildConfig';

const faviconConfigModelInput = path.resolve(__dirname, '../src/plugins/icon-webpack-plugin/src/interfaces.ts');
const faviconConfigSchemaOutput = path.resolve(__dirname, schemaOutDir, 'favicon-config-schema-draft-04.json');
const faviconConfigSchemav6Output = path.resolve(__dirname, schemaOutDir, 'favicon-config-schema.json');
const faviconConfigSymbol = 'FaviconConfig';

fs.ensureDirSync(schemaOutDir);

// angular-build schema
spawn.sync('rimraf', [angularBuildConfigSchemaOutput, angularBuildConfigSchemav6Output], { stdio: 'inherit' });
spawn.sync('typescript-json-schema', [angularBuildConfigModelInput, angularBuildConfigSymbol, '-o', angularBuildConfigSchemaOutput], { cwd: __dirname, stdio: 'inherit' });
spawn.sync('ajv', ['migrate', '-s', angularBuildConfigSchemaOutput, '-o', angularBuildConfigSchemav6Output], { stdio: 'inherit' });

// favicon schema
spawn.sync('rimraf', [faviconConfigSchemaOutput, faviconConfigSchemav6Output], { stdio: 'inherit' });
spawn.sync('typescript-json-schema', [faviconConfigModelInput, faviconConfigSymbol, '-o', faviconConfigSchemaOutput], { cwd: __dirname, stdio: 'inherit' });
spawn.sync('ajv', ['migrate', '-s', faviconConfigSchemaOutput, '-o', faviconConfigSchemav6Output], { stdio: 'inherit' });

// copy to dist
const schemaDistOutDir = path.resolve(__dirname, '../dist/schemas');
fs.ensureDirSync(schemaDistOutDir);
fs.copySync(schemaOutDir, schemaDistOutDir);