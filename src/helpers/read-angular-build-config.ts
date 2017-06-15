import * as fs from 'fs-extra';

import { AngularBuildConfig } from '../models';
import { readJson, readJsonSync } from '../utils';

import { formatValidationError, validateSchema } from '../utils';

const schema = require('../schemas/schema.json');

export function readAngularBuildConfigSync(configFilePath: string, validate: boolean = true): AngularBuildConfig {
    if (!fs.existsSync(configFilePath)) {
        throw new Error(`'angular-build.json' file could not be found at ${configFilePath}.`);
    }
    const angularBuildConfig = readJsonSync(configFilePath);

    if (validate !== false) {
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
