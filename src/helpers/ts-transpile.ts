import * as path from 'path';
import { main as tscWrappedMain } from '@angular/compiler-cli';
import * as fs from 'fs-extra';
import * as ts from 'typescript';

import { ProjectConfig, TsTranspilation } from '../models';
import { readJson } from '../utils';

export type TsTranspiledInfo = {
    name?: string;
    target: string;
    module: string;
    declaration: boolean;
    sourceTsConfigPath: any;
    tsConfigJson: any;
    outDir: string;
    aotGenDir: string;
    flatModuleOutFile?: string;
    shouldCreateTempTsConfig?: boolean;
    tsTranspilation: TsTranspilation;
};

export async function getTsTranspileInfo(projectRoot: string,
    projectConfig: ProjectConfig,
    tsTranspileOption: TsTranspilation): Promise<TsTranspiledInfo> {
    const srcDir = projectConfig.srcDir ? path.resolve(projectRoot, projectConfig.srcDir) : projectRoot;
    const rootTsConfigPath = path.resolve(projectRoot, projectConfig.tsconfig || 'tsconfig.json');
    const sourceTsConfig = tsTranspileOption.tsconfig || projectConfig.tsconfig || 'tsconfig.json';
    let sourceTsConfigPath = path.resolve(srcDir, sourceTsConfig);

    if (!await fs.exists(sourceTsConfigPath)) {
        if (projectConfig.tsconfig) {
            throw new Error(`The 'tsconfig.json' file could not be found at ${sourceTsConfig}.`);
        }

        if (await fs.exists(rootTsConfigPath)) {
            sourceTsConfigPath = rootTsConfigPath;
        } else {
            throw new Error(`The 'tsconfig.json' file could not be found at ${sourceTsConfig}.`);
        }
    }

    let transpileOutDir: string | undefined = undefined;
    let rootOutDir: string | undefined = undefined;

    if (projectConfig.outDir) {
        rootOutDir = path.resolve(projectRoot, projectConfig.outDir);
    }
    if (tsTranspileOption.outDir) {
        transpileOutDir = path.resolve(rootOutDir || projectRoot, tsTranspileOption.outDir);
    }

    const tempTsConfigInfo = await getTempTsConfig(sourceTsConfigPath,
        tsTranspileOption.target,
        tsTranspileOption.module,
        tsTranspileOption.declaration,
        tsTranspileOption.noEmit,
        transpileOutDir,
        projectConfig.sourceMap);

    const target = tempTsConfigInfo.tsConfig.compilerOptions.target;
    const module = tempTsConfigInfo.tsConfig.compilerOptions.module;
    if (tempTsConfigInfo.tsConfig.compilerOptions.outDir) {
        if (path.isAbsolute(tempTsConfigInfo.tsConfig.compilerOptions.outDir)) {
            throw new Error(`The 'compilerOptions.outDir' must be relative path in tsconfig file ${sourceTsConfigPath}.`);
        }
        transpileOutDir = path.resolve(path.dirname(sourceTsConfigPath),
            tempTsConfigInfo.tsConfig.compilerOptions.outDir);
    }
    if (!transpileOutDir) {
        transpileOutDir = path.dirname(sourceTsConfigPath);
    }

    let aotGenDir = transpileOutDir;
    if (tempTsConfigInfo.tsConfig.angularCompilerOptions && tempTsConfigInfo.tsConfig.angularCompilerOptions.genDir) {
        aotGenDir = path.resolve(path.dirname(sourceTsConfigPath),
            tempTsConfigInfo.tsConfig.angularCompilerOptions.genDir);
    }
    let flatModuleOutFile: string | undefined = undefined;
    if (tempTsConfigInfo.tsConfig.angularCompilerOptions) {
        flatModuleOutFile = tempTsConfigInfo.tsConfig.angularCompilerOptions.flatModuleOutFile;
    }

    const declaration = tempTsConfigInfo.tsConfig.compilerOptions.declaration || tsTranspileOption.declaration;
    return {
        tsTranspilation: tsTranspileOption,
        name: tsTranspileOption.name,
        outDir: transpileOutDir,
        aotGenDir: aotGenDir,
        flatModuleOutFile: flatModuleOutFile,
        declaration: declaration,
        target: target,
        module: module,
        tsConfigJson: tempTsConfigInfo.tsConfig,
        shouldCreateTempTsConfig: tempTsConfigInfo.shouldCreate,
        sourceTsConfigPath: sourceTsConfigPath
    };
}

export async function tsTranspile(tsConfigPath: string): Promise<any> {
    await tscWrappedMain(tsConfigPath,
        { basePath: path.dirname(tsConfigPath) });
}

/** Reads a input file and transpiles it into a new file. */
export async function transpileFile(inputPath: string, outputPath: string, compilerOptions: ts.CompilerOptions): Promise<void> {
    const inputFile = await fs.readFile(inputPath, 'utf-8');
    const transpiled = ts.transpileModule(inputFile, { compilerOptions: compilerOptions });

    reportDiagnostics(transpiled.diagnostics);

    await fs.writeFile(outputPath, transpiled.outputText);

    if (transpiled.sourceMapText) {
        await fs.writeFile(`${outputPath}.map`, transpiled.sourceMapText);
    }
}

/** Formats the TypeScript diagnostics into a error string. */
function formatDiagnostics(diagnostics: ts.Diagnostic[], baseDir: string): string {
    return diagnostics.map(diagnostic => {
        let res = `• \u001b[1m\u001b[31m${`TS${diagnostic.code}`}\u001b[37m\u001b[39m\u001b[22m - `;

        if (diagnostic.file) {
            const { line, character } = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start as number);
            const filePath = path.relative(baseDir, diagnostic.file.fileName);

            res += `${filePath}(${line + 1},${character + 1}): `;
        }
        res += `${ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')}`;

        return res;
    }).join('\n');
}

/** Checks and reports diagnostics if present. */
function reportDiagnostics(diagnostics?: ts.Diagnostic[], baseDir?: string): void {
    if (diagnostics && diagnostics.length && diagnostics[0]) {
        console.error(formatDiagnostics(diagnostics, baseDir as string));
        throw new Error('TypeScript compilation failed.');
    }
}


async function getTempTsConfig(pathToReadFile: string,
    target?: string,
    module?: string,
    declaration?: boolean,
    noEmit?: boolean,
    outDir?: string,
    sourceMap?: boolean): Promise<{ shouldCreate: boolean; tsConfig: any }> {
    let shouldCreateTempFile = false;
    const config: any = await readJson(pathToReadFile);
    if (!config.compilerOptions) {
        config.compilerOptions = {};
        shouldCreateTempFile = true;
    }

    if (outDir) {
        let relativeOutDir = path.relative(path.dirname(pathToReadFile), outDir);
        relativeOutDir = relativeOutDir.replace(/\\/g, '/');
        if (config.compilerOptions.outDir !== relativeOutDir) {
            shouldCreateTempFile = true;
            config.compilerOptions.outDir = relativeOutDir;
            if (config.angularCompilerOptions) {
                config.angularCompilerOptions.genDir = relativeOutDir;
            }
        }
    }

    if (target && config.compilerOptions.target !== target) {
        shouldCreateTempFile = true;
        config.compilerOptions.target = target;
    }
    config.compilerOptions.target = config.compilerOptions.target || 'es5';

    if (module && config.compilerOptions.module !== module) {
        shouldCreateTempFile = true;
        config.compilerOptions.module = module;
    }
    config.compilerOptions.module = config.compilerOptions.module || 'es2015';

    if (typeof declaration === 'boolean' && config.compilerOptions.declaration !== declaration) {
        shouldCreateTempFile = true;
        config.compilerOptions.declaration = declaration;
    }

    if (typeof noEmit === 'boolean' && config.compilerOptions.noEmit !== noEmit) {
        shouldCreateTempFile = true;
        config.compilerOptions.noEmit = noEmit;
    }

    if (typeof sourceMap === 'boolean') {
        if (sourceMap && !config.compilerOptions.sourceMap && !config.compilerOptions.inlineSourceMap) {
            shouldCreateTempFile = true;
            config.compilerOptions.sourceMap = true;
            config.compilerOptions.inlineSources = true;
        }
        if (!sourceMap && config.compilerOptions.sourceMap) {
            shouldCreateTempFile = true;
            config.compilerOptions.sourceMap = false;
        }
        if (!sourceMap && config.compilerOptions.inlineSourceMap) {
            shouldCreateTempFile = true;
            config.compilerOptions.inlineSourceMap = false;
        }
    }

    return { tsConfig: config, shouldCreate: shouldCreateTempFile };
}
