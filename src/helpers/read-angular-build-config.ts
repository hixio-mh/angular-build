import * as fs from 'fs-extra';
import * as path from 'path';

import { AngularBuildConfig } from '../models';
import { readJson, readJsonSync } from '../utils';

import { formatValidationError, validateSchema } from '../utils';

export function readAngularBuildConfigSync(configFilePath: string, validate: boolean = true): AngularBuildConfig {
    if (!fs.existsSync(configFilePath)) {
        throw new Error(`'angular-build.json' file could not be found at ${configFilePath}.`);
    }
    const angularBuildConfig = readJsonSync(configFilePath);

    if (validate !== false) {
        let schemaPath = './schemas/schema.json';
        if (!fs.existsSync(path.resolve(__dirname, schemaPath))) {
            schemaPath = '../schemas/schema.json';
        }
        if (!fs.existsSync(path.resolve(__dirname, schemaPath))) {
            schemaPath = '../../schemas/schema.json';
        }
        if (!fs.existsSync(path.resolve(__dirname, schemaPath))) {
            schemaPath = '../../../schemas/schema.json';
        }
        const schema = require(schemaPath);

        if (schema.$schema) {
            delete schema.$schema;
        }

        if ((angularBuildConfig as any).$schema) {
            delete (angularBuildConfig as any).$schema;
        }

        const errors = validateSchema(schema, angularBuildConfig);
        if (errors.length) {
            const errMsg = errors.map(err => formatValidationError(schema, err)).join('\n');
            throw new Error(
                `Invalid configuration object.\n\n${
                errMsg}\n`);
        }

        angularBuildConfig.schema = schema;
        angularBuildConfig.schemaValidated = true;
    }
    return angularBuildConfig;
}

export async function readAngularBuildConfig(configFilePath: string, validate: boolean = true):
    Promise<AngularBuildConfig> {
    if (!await fs.exists(configFilePath)) {
        throw new Error(`'angular-build.json' file could not be found at ${configFilePath}.`);
    }
    const angularBuildConfig = await readJson(configFilePath);

    if (validate !== false) {
        let schemaPath = './schemas/schema.json';
        if (!await fs.exists(path.resolve(__dirname, schemaPath))) {
            schemaPath = '../schemas/schema.json';
        }
        if (!await fs.exists(path.resolve(__dirname, schemaPath))) {
            schemaPath = '../../schemas/schema.json';
        }
        if (!await fs.exists(path.resolve(__dirname, schemaPath))) {
            schemaPath = '../../../schemas/schema.json';
        }
        const schema = await fs.readJson(path.resolve(__dirname, schemaPath));

        if (schema.$schema) {
            delete schema.$schema;
        }

        if ((angularBuildConfig as any).$schema) {
            delete (angularBuildConfig as any).$schema;
        }

        const errors = validateSchema(schema, angularBuildConfig);
        if (errors.length) {
            const errMsg = errors.map(err => formatValidationError(schema, err)).join('\n');
            throw new Error(
                `Invalid configuration object.\n\n${
                errMsg}\n`);
        }

        angularBuildConfig.schema = schema;
        angularBuildConfig.schemaValidated = true;
    }
    return angularBuildConfig;
}
