//#!/usr/bin/env node
//process.on('uncaughtException', function (err) {
//    ui.log('err', err.stack || err);
//});



var path = require('path');
var fs = require('fs');
//var glob = require('glob');
const argv = require('yargs').argv;

//var args = process.argv.slice(2);

//function format(msg) {
//	q: function(msg, opt) {
//		return moduleMsg(msg) + '' + (opt ? ' [' + opt + ']' : '') + ':';
//	},
//	err: function(msg) {
//		return '\n' + chalk.red.bold('err  ') + moduleMsg(msg);
//	},
//	info: function(msg) {
//		return '     ' + moduleMsg(msg);
//	},
//	warn: function(msg) {
//		return '\n' + chalk.yellow.bold('warn ') + moduleMsg(msg);
//	},
//	ok: function(msg) {
//		return chalk.green.bold('ok   ') + moduleMsg(msg);
//	}
//};

function ask(msg, defaultValue) {
    //process.stdout.write(format.q(msg) + (def ? 'Yes' : 'No') + '\n');
	return defaultValue;
}

function init(prompt) {
   
    

    const possibleSrcDirs = ['client', 'Client', 'src'];
    const possibleOutDirs = ['wwwroot', 'dist'];
    const possibleMain = ['main.browser.ts', 'main.ts'];

    const sourceRoot = (path.join(__dirname, 'config'));

    const projectRoot = process.cwd();

    const foundSrc = findDir(projectRoot, possibleSrcDirs) || 'client';

    const outDir = findDir(projectRoot, possibleOutDirs) || 'dist';

    const clientSourcePath = path.resolve(process.cwd(), foundSrc); 

    const defaultAppConfig = readJsonSync(require.resolve('../config/angular-build.json'));

	const packageScripts = {
        "build:dll": "cross-env NODE_ENV=development webpack --profile --colors --bail",
        "prebuilt:dll": "npm run clean:dist ",
        "build:dev": "cross-env NODE_ENV=development webpack --profile --colors --bail",
        "build:prod": "cross-env NODE_ENV=production webpack --profile --colors --bail",
        "build": "npm run build:dev",
        "clean:dist": "npm run rimraf -- "
    };

	const defaultTsConfig = {
        "compilerOptions": {
            "target": "es5",
            "module": "es2015",
            "moduleResolution": "node",
            "emitDecoratorMetadata": true,
            "experimentalDecorators": true,
            "removeComments": false,
            "pretty": true,
            "sourceMap": true,
            "baseUrl": "",
            "mapRoot": "./",
            "noEmitHelpers": true,
            "outDir": `../${outDir}/out-tsc`, // ***
            "skipDefaultLibCheck": true,
            "lib": ["es2015", "dom"],
            "typeRoots": [
                "../node_modules/@types"
            ],
            "awesomeTypescriptLoaderOptions": {
                "instance": "at-app-loader"
            }
        }
	};

    



    let configFileExists = false;
    let configPath = 'angular-build.json';
    if (!fs.existsSync(path.resolve(projectRoot, configPath))) {
	    const tmpConfigPath = 'angular-cli.json';
	    if (fs.existsSync(path.resolve(projectRoot, tmpConfigPath))) {
		    configPath = tmpConfigPath;
		    configFileExists = true;
	    }
    } else {
        configFileExists = true;
    }

    
    // 1. create angular-build.json
    if (!configFileExists) {
        // root - src
        defaultAppConfig.apps[0].root = prompt ? ask('', foundSrc) : foundSrc;
        // outDir
        
        defaultAppConfig.apps[0].outDir = prompt ? ask('', outDir) : outDir;
        
        // public path
        defaultAppConfig.apps[0].publicPath = '/';

        //finding main.ts and assign defaultAppConfig.main
        let defaultMain = 'main.ts';
       
        possibleMain.forEach(function (arg) {
            if (fs.existsSync(path.resolve(clientSourcePath, arg))) {
                defaultMain = arg;
                return;
            }
        });

        defaultAppConfig.apps[0].main = defaultMain;
        
    }

    // 2. create webpack config file
    let webpackConfigExist = false;
    let weppackConfigPath = 'webpack.config.ts';
    if (!fs.existsSync(path.resolve(projectRoot, 'weppackConfigPath'))) {
        const tmpConfigPath = 'webpack.config.js';
        if (fs.existsSync(path.resolve(projectRoot, tmpConfigPath))) {
            configPath = tmpConfigPath;
            webpackConfigExist = true;
        }
    } else {
        webpackConfigExist = true;
    }
    if (!webpackConfigExist) {
        let readFileString = fs.readFileSync(require.resolve('../config/webpack.config.ts.bak')).toString();
        fs.writeFile(path.join(projectRoot ,'webpack.config.ts'), readFileString);
    }
    
    let srcExist = findDir(projectRoot, [`${foundSrc}`]);
    if (srcExist == null) {
        fs.mkdirSync(clientSourcePath);
    }

    // 3. copy favicon-config.json
    if (!fs.existsSync(path.resolve(clientSourcePath, 'favicon-config.json'))) {
        let favString = fs.readFileSync(require.resolve('../config/favicon-config.json')).toString();
        fs.writeFile(path.join(clientSourcePath, 'favicon-config.json'), favString);
    }


    // 4. copy environment files

    // 5. install require dependencies

    // 6. add build scripts to package.json

    // 7.add tsconfig.json file
    
    if (!fs.existsSync(path.resolve(clientSourcePath, 'tsconfig.json'))) {
        fs.writeFile(path.join(clientSourcePath, 'tsconfig.json'), JSON.stringify(defaultTsConfig));
    }

    // 8.finding enviroment dir and copy environment ts files
    const envFolder = findDir(clientSourcePath, ['enviroment']);
    const envdirPath = path.resolve(clientSourcePath, 'enviroment');
    if (envFolder !== null) {
        if (!fs.existsSync(path.resolve(envdirPath, 'environment.prod.ts'))){
            let envProdString = fs.readFileSync(require.resolve('../config/environment.prod.ts.bak')).toString();
            fs.writeFile(path.join(envdirPath, 'environment.prod.ts'), envProdString);
        }
        if (!fs.existsSync(path.resolve(envdirPath, 'environment.ts'))){
            let envString = fs.readFileSync(require.resolve('../config/environment.ts.bak')).toString();
            fs.writeFile(path.join(envdirPath, 'environment.ts'), envString);
        }
    }
    else {
        fs.mkdirSync(envdirPath);
        let envProdString = fs.readFileSync(require.resolve('../config/environment.prod.ts.bak')).toString();
        fs.writeFile(path.join(envdirPath, 'environment.prod.ts'), envProdString);

        let envString = fs.readFileSync(require.resolve('../config/environment.ts.bak')).toString();
        fs.writeFile(path.join(envdirPath, 'environment.ts'), envString);
    }

    // 9.Write angular-build.json
    if (!configFileExists) {
        fs.writeFile(path.join(projectRoot, 'angular-build.json'), JSON.stringify(defaultAppConfig));
    }

    // 10. copy polyfill and vendor
    if (!fs.existsSync(path.resolve(clientSourcePath, 'polyfills.ts'))) {
        let pollyfillsString = fs.readFileSync(require.resolve('../config/polyfills.ts.bak')).toString();
        fs.writeFile(path.join(clientSourcePath, 'polyfills.ts'), pollyfillsString);
    }
    if (!fs.existsSync(path.resolve(clientSourcePath, 'vendors.ts'))) {
        let vendorsString = fs.readFileSync(require.resolve('../config/vendors.ts.bak')).toString();
        fs.writeFile(path.join(clientSourcePath, 'vendors.ts'), vendorsString);
    }
}

//function isAspNetProject(baseDir) {
//    if(glob.sync('*.xproj', { cwd : baseDir }))
//}

function findDir(projectRoot, possibleDirs) {
	let foundDir = null;
    possibleDirs.forEach(d => {
        if (fs.existsSync(path.resolve(projectRoot, d))) {
            if (fs.statSync(path.resolve(projectRoot, d)).isDirectory()) {
                foundDir = d;
                return;
            }
        }
    });
	return foundDir;
}


if (argv.init) {
    init(argv.prompt);
} else {
    process.exit(-1);
}

//switch(args[0]) {
//    case 'init':
//        let ask = false;
//        //options = readOptions(args, ['yes', 'prompts']);
//        //if (options.yes)
//        //    ui.useDefaults();
//        //core.init(options.args[1], options.prompts);
//        break;
//    default:

//}


// Utils
function stripComments(content){
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
        } else if (m4) {
            // A line comment. If it ends in \r?\n then keep it.
            let length = m4.length;
            if (length > 2 && m4[length - 1] === "\n") {
                return m4[length - 2] === "\r" ? "\r\n" : "\n";
            } else {
                return "";
            }
        } else {
            // We match a string
            return match;
        }
    });
    return result;
};

function readJsonSync(filePath) {
    const context = stripComments(fs.readFileSync(filePath).toString().replace(/^\uFEFF/, ''));
    return JSON.parse(context);
}


