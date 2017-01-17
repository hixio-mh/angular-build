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
    const defaultAppConfig = readJsonSync(require.resolve('../config/angular-build.json'));

    const projectRoot = process.cwd();

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
            "outDir": "../wwwroot/out-tsc", // ***
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

    var possibleSrcDirs = ['client', 'Client', 'src'];
    const possibleOutDirs = ['wwwroot', 'dist'];

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
        const foundSrc = findDir(projectRoot, possibleSrcDirs) || 'Client';
        defaultAppConfig.root = prompt ? ask('', foundSrc) : foundSrc;

        // outDir

        // public path

        defaultTsConfig.outDir = `../${defaultAppConfig.outDir}/out-tsc`;
    }

    // 2. create webpack config file

    // 3. copy favicon-config.json

    // 4. copy environment files

    // 5. install require dependencies

    // 6. add build scripts to package.json

    // add tsconfig.json file
}

//function isAspNetProject(baseDir) {
//    if(glob.sync('*.xproj', { cwd : baseDir }))
//}

function findDir(projectRoot, possibleDirs) {
	let foundDir = null;
	possibleDirs.forEach(d => {
        if (fs.statSync(path.resolve(projectRoot, d)).isDirectory()) {
            foundDir = d;
            return;
        }
    });
	return foundDir;
}

if (argv.init) {
    init(argv.prompt);
} else {
    process.exit(-1);
    break;
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
