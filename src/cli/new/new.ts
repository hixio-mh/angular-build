const fs = require('fs-extra');
import * as inquirer from 'inquirer';
import * as path from 'path';
import * as semver from 'semver';

import { colorize, Logger, spawnPromise } from '../../utils';

import { CliOptions } from '../cli-options';

export async function newApp(cliOptions: CliOptions, logger: Logger = new Logger()): Promise<number> {
    return await newAppInternal(cliOptions, logger).then(() => 0).catch((err: Error) => {
        if (err) {
            let errMsg: string;
            if (err.stack && err.message) {
                const newErrStack = err.stack.replace(`Error: ${err.message}`, '');
                errMsg = newErrStack === err.stack ? err.stack : err.message + '\n\n' + newErrStack;
            } else {
                errMsg = err.stack ||
                    err.message ||
                    (typeof (err as any) === 'string' ? err as any : JSON.stringify(err));
            }

            errMsg = colorize('Error', 'red') + ': ' + errMsg.replace(/^Error:\s*/i, '');
            logger.errorLine(`${errMsg.trim()}\n`, false);
        } else {
            throw err;
        }
        return -1;
    });
}

async function newAppInternal(cliOptions: CliOptions, logger: Logger = new Logger()): Promise<number> {
    const projectRoot = cliOptions.cwd || process.cwd();
    logger.logLine(`\n${colorize(`angular-build ${cliOptions.cliVersion}`, 'green')}`);

    let templateRelativePath = './templates';
    if (!await fs.exists(path.resolve(__dirname, templateRelativePath))) {
        templateRelativePath = '../templates';
    }
    if (!await fs.exists(path.resolve(__dirname, templateRelativePath))) {
        templateRelativePath = '../../templates';
    }
    if (!await fs.exists(path.resolve(__dirname, templateRelativePath))) {
        templateRelativePath = '../../../templates';
    }
    const templatePath = path.resolve(__dirname, templateRelativePath);

    const answer = await inquirer.prompt([
        {
            type: 'list',
            name: 'choice',
            message: colorize('Select template:', 'white'),
            choices: [
                'ASP.NET Core Angular Universal Starter',
                'Angular Starter'
            ],
            default: 'ASP.NET Core Angular Universal Starter'
        }
    ]);

    const yarnInstalled = await spawnPromise('yarn', ['--version'], false, false)
        .then(() => true)
        .catch(() => false);

    if (answer.choice === 'ASP.NET Core Angular Universal Starter') {
        const dotNetVersion =
            await spawnPromise('dotnet', ['--version'], false, false, undefined, undefined, undefined, true)
                .then((v: string) => v.split('-')[0])
                .catch(() => '');
        let meetDotNetVersion = false;
        if (dotNetVersion) {
            const dotNetSemVer = new semver.SemVer(dotNetVersion);
            meetDotNetVersion = dotNetSemVer.compare(new semver.SemVer('2.0.0')) >= 0;
        }
        if (!dotNetVersion || !meetDotNetVersion) {
            throw new Error(
                `.Net Core (version >= 2.0.0-preview2) is required to build and run this project. ` +
                `To continue, please install .Net Core from https://www.microsoft.com/net/download/core/, ` +
                `and then restart your command prompt.`);
        }

        // install template
        await spawnPromise('dotnet',
            ['new', '--install', 'aspnetcore/angularstarter/content'],
            false,
            true,
            /(^warning\s|\s+)/i, templatePath);

        let projectName = 'WebApplication1';
        let i = 1;
        let projectExists = await fs.exists(path.resolve(projectRoot, projectName));
        while (projectExists) {
            ++i;
            projectName = `WebApplication${i}`;
            projectExists = await fs.exists(path.resolve(projectRoot, projectName));
        }
        const projectNameAnswer = await inquirer.prompt([
            {
                type: 'input',
                name: 'input',
                message: colorize(`Enter project name:`, 'white'),
                default: projectName
            }
        ]);
        projectName = projectNameAnswer.input;

        // create new app
        const commandArgs = ['new', 'angularstarter', '-o', projectName];
        await spawnPromise('dotnet',
            commandArgs,
            false,
            true,
            /(^warning\s|\s+)/i,
            projectRoot);

        logger.logLine('Restoring packages...');
        if (yarnInstalled) {
            await spawnPromise('yarn',
                ['install', '--silent', '--no-progress', '--non-interactive'],
                false,
                true,
                /(^warning\s|\s+)/i,
                path.resolve(projectRoot, projectName));
        } else {
            await spawnPromise('npm',
                ['install', '--color', 'always', '--loglevel', 'error'],
                false,
                true,
                /(^warning\s|\s+)/i,
                path.resolve(projectRoot, projectName));
        }
        logger.logLine('Restore succeeded.');

        await spawnPromise('npm',
            ['link', '@bizappframework/angular-build'],
            false,
            true,
            /(^warning\s|\s+)/i,
            path.resolve(projectRoot, projectName));

        logger.logLine(`To build the app, go to your project  '${projectName}' directory and run ${colorize('dotnet build', 'cyan')}.`);
        logger.logLine(`To run the app, run ${colorize('dotnet run', 'cyan')}.`);
    } else if (answer.choice === 'Angular Starter') {
        let projectName = 'ng-app1';
        let i = 1;
        let projectExists = await fs.exists(path.resolve(projectRoot, projectName));
        while (projectExists) {
            ++i;
            projectName = `ng-app${i}`;
            projectExists = await fs.exists(path.resolve(projectRoot, projectName));
        }
        const projectNameAnswer = await inquirer.prompt([
            {
                type: 'input',
                name: 'input',
                message: colorize(`Enter project name:`, 'white'),
                default: projectName
            }
        ]);

        projectName = projectNameAnswer.input;
        const templateSrcPath = path.resolve(templatePath, 'angularspa');
        const destPath = path.resolve(projectRoot, projectName);
        await fs.copy(templateSrcPath, destPath);

        // update package-name
        const packageJson = await fs.readJson(path.resolve(destPath, 'package.json'));
        packageJson.name = projectName;
        await fs.writeFile(path.resolve(destPath, 'package.json'), JSON.stringify(packageJson, null, 2));

        // install dependencies
        logger.logLine('Restoring packages...');
        if (yarnInstalled) {
            await spawnPromise('yarn',
                ['install', '--silent', '--no-progress', '--non-interactive'],
                false,
                true,
                /(^warning\s|\s+)/i,
                destPath);
        } else {
            await spawnPromise('npm',
                ['install', '--color', 'always', '--loglevel', 'error'],
                false,
                true,
                /(^warning\s|\s+)/i,
                destPath);
        }
        logger.logLine('Restore succeeded.');
        logger.logLine(`To build the app, go to your project '${projectName}' directory and run ${colorize('ngb build', 'cyan')}.`);
        logger.logLine(`To run the app, run ${colorize('npm run http-server', 'cyan')}.`);
    }

    return 0;
}

