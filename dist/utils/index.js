"use strict";
const path = require("path");
const fs = require("fs");
const readline = require("readline");
const semver = require("semver");
//import { spawn } from 'child_process';
const spawn = require('cross-spawn');
function stripComments(content) {
    /**
     * First capturing group matches double quoted string
     * Second matches single quotes string
     * Third matches block comments
     * Fourth matches line comments
     */
    const regexp = /("(?:[^\\\"]*(?:\\.)?)*")|('(?:[^\\\']*(?:\\.)?)*')|(\/\*(?:\r?\n|.)*?\*\/)|(\/{2,}.*?(?:(?:\r?\n)|$))/g;
    const result = content.replace(regexp, (match, m1, m2, m3, m4) => {
        // Only one of m1, m2, m3, m4 matches
        if (m3) {
            // A block comment. Replace with nothing
            return "";
        }
        else if (m4) {
            // A line comment. If it ends in \r?\n then keep it.
            let length = m4.length;
            if (length > 2 && m4[length - 1] === "\n") {
                return m4[length - 2] === "\r" ? "\r\n" : "\n";
            }
            else {
                return "";
            }
        }
        else {
            // We match a string
            return match;
        }
    });
    return result;
}
exports.stripComments = stripComments;
;
function readJsonSync(filePath) {
    const context = stripComments(fs.readFileSync(filePath).toString().replace(/^\uFEFF/, ''));
    return JSON.parse(context);
}
exports.readJsonSync = readJsonSync;
function readJsonAsync(filePath, throwError) {
    return new Promise((resolve, reject) => {
        fs.readFile(filePath, (err, data) => {
            if (err) {
                throwError === false ? resolve(null) : reject(err);
            }
            else {
                const context = stripComments(data.toString().replace(/^\uFEFF/, ''));
                resolve(JSON.parse(context));
            }
        });
    });
}
exports.readJsonAsync = readJsonAsync;
function checkFileOrDirectoryExistsAsync(filePath, isDir) {
    return new Promise((resolve) => {
        fs.stat(filePath, (err, stats) => {
            resolve(err ? false : isDir ? stats.isDirectory() : stats.isFile());
        });
    });
}
exports.checkFileOrDirectoryExistsAsync = checkFileOrDirectoryExistsAsync;
function findFileOrDirectoryFromPossibleAsync(baseDir, possibleNames, preferredName, isDir) {
    const tasks = possibleNames.map(name => {
        const pathToFind = path.resolve(baseDir, name);
        return checkFileOrDirectoryExistsAsync(pathToFind, isDir).then(exists => exists ? name : null);
    });
    return Promise.all(tasks)
        .then(foundList => {
        if (preferredName) {
            return foundList.find(f => f === preferredName) || foundList.find(f => f !== null);
        }
        return foundList.find(f => f !== null);
    });
}
exports.findFileOrDirectoryFromPossibleAsync = findFileOrDirectoryFromPossibleAsync;
function askAsync(msg) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    return new Promise((resolve) => {
        rl.question(msg, (answer) => {
            rl.close();
            resolve(answer);
        });
    });
}
exports.askAsync = askAsync;
function spawnAsync(command, commandArgs, showStdOut) {
    return new Promise((resolve, reject) => {
        //const child = spawn(command, commandArgs, { stdio: 'inherit' });
        const child = spawn(command, commandArgs);
        child.stdout.on('data', (data) => {
            if (showStdOut) {
                console.log(`${data}`);
            }
        });
        child.stderr.on('data', (data) => {
            console.log("\nHERE: stderr\n");
            console.log(`${data}`);
        });
        child.on('error', (err) => {
            console.log("\nHERE: error\n");
            reject(err);
        });
        child.on('close', (code) => {
            resolve(code);
        });
    });
}
exports.spawnAsync = spawnAsync;
function getVersionfromPackageJsonAsync(baseDir) {
    const packageJsonPath = path.resolve(baseDir, 'package.json');
    return checkFileOrDirectoryExistsAsync(packageJsonPath).then(exists => {
        if (!exists) {
            return Promise.resolve(null);
        }
        return readJsonAsync(packageJsonPath).then((pkgCfg) => {
            if (pkgCfg['version']) {
                try {
                    return new semver.SemVer(pkgCfg['version']);
                }
                catch (err) {
                    //console.error(err);
                    return null;
                }
            }
            else {
                return null;
            }
        });
    });
}
exports.getVersionfromPackageJsonAsync = getVersionfromPackageJsonAsync;
//# sourceMappingURL=index.js.map