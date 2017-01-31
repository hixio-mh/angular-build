var vm = require('vm');
var requireLike = require('require-like');

const loaderUtils = require('loader-utils');

function dllLoader(loader: any, content: string, sourcemap: any) {
  // Not cacheable during unit tests;
  loader.cacheable && loader.cacheable();

  const options = loaderUtils.parseQuery(loader.query);

  const newContent = content;

  //const result = eval.call(null, content);
  const sandbox: any = {};
  const exports = {};
    //sandbox.require = requireLike(_filename);
    sandbox.exports = exports;
    sandbox.module = {
        exports: exports,
        //filename: module.parent.filename,
        //id: module.parent.filename,
        //parent: module.parent,
        //require: sandbox.require || requireLike(_filename)
    };
    //sandbox.global = sandbox;
    const opts : any= {
        filename: null,
        displayErrors: true
    }
    //'module.exports = function () { return 123 }'
    var script = new vm.Script(content, opts);
    script.runInNewContext(sandbox, opts);
    const data = sandbox.module.exports;
    console.log(data.default());

  console.log("\nat loader end\n...................................");
  //if (typeof execScript !== "undefined") {
  //  result = execScript(content);
  //} else {
  //  result = eval.call(null, content);
  //}

  //            if (data && data.default && typeof data.default === 'function') {
//                const dataArray = data.default(env);
//                if (Array.isArray(dataArray)) {
//                    return {
//                        entry: dataArray,
//                        fileDependency: dllPath
//                    };
//                } else {
//                    throw new Error(`Invalid value in dlls, file: ${dllPath}.`);
//                }
//            }
//            if (data && typeof data === 'function') {
//                const dataArray = data(env);
//                if (Array.isArray(dataArray)) {
//                    return {
//                        entry: dataArray,
//                        fileDependency: dllPath
//                    };
//                } else {
//                    throw new Error(`Invalid value in dlls, file: ${dllPath}.`);
//                }
//            }

  //return `module.exports = ${JSON.stringify(value)}`;
   // Support for tests
  if (loader.callback) {
    return loader.callback(null, newContent, sourcemap);
  } else {
    return newContent;
  }
}

// ReSharper disable once CommonJsExternalModule
module.exports = function (content: any, sourcemap: any) {
  try {
    dllLoader.call(undefined, this, content, sourcemap);
  } catch (e) {
    console.error(e, e.stack);
    throw e;
  }
}