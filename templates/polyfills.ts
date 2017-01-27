﻿export default function (env: string) {
    return [
        // es6 polyfills
        //'angular2-universal-polyfills',
        //'es6-shim',
        //'es6-promise',
        //'reflect-metadata',

        // Or
        //  'core-js/es6',
        // Added parts of es6 which are necessary for your project or your browser support requirements.
        'core-js/es6/symbol',
        'core-js/es6/object',
        'core-js/es6/function',
        'core-js/es6/parse-int',
        'core-js/es6/parse-float',
        'core-js/es6/number',
        'core-js/es6/math',
        'core-js/es6/string',
        'core-js/es6/date',
        'core-js/es6/array',
        'core-js/es6/regexp',
        'core-js/es6/map',
        'core-js/es6/set',
        'core-js/es6/weak-map',
        'core-js/es6/weak-set',
        'core-js/es6/typed',
        'core-js/es6/reflect',
        // see issue https://github.com/AngularClass/angular2-webpack-starter/issues/709
        //  'core-js/es6/promise',

        // zone.js
        'zone.js/dist/zone',

        // Typescript emit helpers polyfill
        // NOTE: Starting typescript 2.1 this package won't be needed anymore
        //"ts-helpers",
        // ttypescript >= 2.1
        'tslib'

        // rxjs polyfills
        //"rxjs/Observable",
        //"rxjs/Subscription",
        //"rxjs/Subject",
        //"rxjs/BehaviorSubject",

        //"rxjs/add/observable/throw",
        //"rxjs/add/observable/of",
        //"rxjs/add/observable/combineLatest",
        //"rxjs/add/observable/from",
        //"rxjs/add/observable/fromEvent",
        //"rxjs/add/observable/interval",

        //"rxjs/add/operator/catch",
        //"rxjs/add/operator/map",
        //"rxjs/add/operator/debounceTime",
        //"rxjs/add/operator/distinctUntilChanged",
        //"rxjs/add/operator/mergeMap",
        //"rxjs/add/operator/switchMap",
        //"rxjs/add/operator/toPromise",
        //"rxjs/add/operator/do",
        //"rxjs/add/operator/filter",
        //"rxjs/add/operator/delay",
        //"rxjs/add/operator/share",

        //"rxjs/add/operator/let",
        //"rxjs/add/operator/mapTo",
        //"rxjs/add/operator/pluck",
        //"rxjs/add/operator/take",
        //"rxjs/add/operator/toArray"
    ].concat((env === 'production' || env === 'prod') ? [] :
        ['zone.js/dist/long-stack-trace-zone']);
}