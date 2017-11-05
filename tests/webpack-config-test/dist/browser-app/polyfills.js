webpackJsonp(["polyfills"],{

/***/ "../../node_modules/core-js/es7/reflect.js":
/***/ (function(module, exports, __webpack_require__) {

__webpack_require__("../../node_modules/core-js/modules/es7.reflect.define-metadata.js");
__webpack_require__("../../node_modules/core-js/modules/es7.reflect.delete-metadata.js");
__webpack_require__("../../node_modules/core-js/modules/es7.reflect.get-metadata.js");
__webpack_require__("../../node_modules/core-js/modules/es7.reflect.get-metadata-keys.js");
__webpack_require__("../../node_modules/core-js/modules/es7.reflect.get-own-metadata.js");
__webpack_require__("../../node_modules/core-js/modules/es7.reflect.get-own-metadata-keys.js");
__webpack_require__("../../node_modules/core-js/modules/es7.reflect.has-metadata.js");
__webpack_require__("../../node_modules/core-js/modules/es7.reflect.has-own-metadata.js");
__webpack_require__("../../node_modules/core-js/modules/es7.reflect.metadata.js");
module.exports = __webpack_require__("../../node_modules/core-js/modules/_core.js").Reflect;


/***/ }),

/***/ "../../node_modules/core-js/modules/_core.js":
/***/ (function(module, exports, __webpack_require__) {

module.exports = (__webpack_require__("dll-reference vendor_lib"))("../../node_modules/core-js/modules/_core.js");

/***/ }),

/***/ "../../node_modules/core-js/modules/es7.reflect.define-metadata.js":
/***/ (function(module, exports, __webpack_require__) {

module.exports = (__webpack_require__("dll-reference vendor_lib"))("../../node_modules/core-js/modules/es7.reflect.define-metadata.js");

/***/ }),

/***/ "../../node_modules/core-js/modules/es7.reflect.delete-metadata.js":
/***/ (function(module, exports, __webpack_require__) {

module.exports = (__webpack_require__("dll-reference vendor_lib"))("../../node_modules/core-js/modules/es7.reflect.delete-metadata.js");

/***/ }),

/***/ "../../node_modules/core-js/modules/es7.reflect.get-metadata-keys.js":
/***/ (function(module, exports, __webpack_require__) {

module.exports = (__webpack_require__("dll-reference vendor_lib"))("../../node_modules/core-js/modules/es7.reflect.get-metadata-keys.js");

/***/ }),

/***/ "../../node_modules/core-js/modules/es7.reflect.get-metadata.js":
/***/ (function(module, exports, __webpack_require__) {

module.exports = (__webpack_require__("dll-reference vendor_lib"))("../../node_modules/core-js/modules/es7.reflect.get-metadata.js");

/***/ }),

/***/ "../../node_modules/core-js/modules/es7.reflect.get-own-metadata-keys.js":
/***/ (function(module, exports, __webpack_require__) {

module.exports = (__webpack_require__("dll-reference vendor_lib"))("../../node_modules/core-js/modules/es7.reflect.get-own-metadata-keys.js");

/***/ }),

/***/ "../../node_modules/core-js/modules/es7.reflect.get-own-metadata.js":
/***/ (function(module, exports, __webpack_require__) {

module.exports = (__webpack_require__("dll-reference vendor_lib"))("../../node_modules/core-js/modules/es7.reflect.get-own-metadata.js");

/***/ }),

/***/ "../../node_modules/core-js/modules/es7.reflect.has-metadata.js":
/***/ (function(module, exports, __webpack_require__) {

module.exports = (__webpack_require__("dll-reference vendor_lib"))("../../node_modules/core-js/modules/es7.reflect.has-metadata.js");

/***/ }),

/***/ "../../node_modules/core-js/modules/es7.reflect.has-own-metadata.js":
/***/ (function(module, exports, __webpack_require__) {

module.exports = (__webpack_require__("dll-reference vendor_lib"))("../../node_modules/core-js/modules/es7.reflect.has-own-metadata.js");

/***/ }),

/***/ "../../node_modules/core-js/modules/es7.reflect.metadata.js":
/***/ (function(module, exports, __webpack_require__) {

module.exports = (__webpack_require__("dll-reference vendor_lib"))("../../node_modules/core-js/modules/es7.reflect.metadata.js");

/***/ }),

/***/ "../../node_modules/zone.js/dist/zone.js":
/***/ (function(module, exports, __webpack_require__) {

module.exports = (__webpack_require__("dll-reference vendor_lib"))("../../node_modules/zone.js/dist/zone.js");

/***/ }),

/***/ "./browser-app/polyfills.ts":
/***/ (function(module, exports, __webpack_require__) {

"use strict";

/**
 * This file includes polyfills needed by Angular and is loaded before the app.
 * You can add your own extra polyfills to this file.
 *
 * This file is divided into 2 sections:
 *   1. Browser polyfills. These are applied before loading ZoneJS and are sorted by browsers.
 *   2. Application imports. Files imported after ZoneJS that should be loaded before your main
 *      file.
 *
 * The current setup is for so-called "evergreen" browsers; the last versions of browsers that
 * automatically update themselves. This includes Safari >= 10, Chrome >= 55 (including Opera),
 * Edge >= 13 on the desktop, and iOS 10 and Chrome on mobile.
 *
 * Learn more in https://angular.io/docs/ts/latest/guide/browser-support.html
 */
Object.defineProperty(exports, "__esModule", { value: true });
/***************************************************************************************************
 * BROWSER POLYFILLS
 */
/** IE9, IE10 and IE11 requires all of the following polyfills. **/
// import 'core-js/es6/symbol';
// import 'core-js/es6/object';
// import 'core-js/es6/function';
// import 'core-js/es6/parse-int';
// import 'core-js/es6/parse-float';
// import 'core-js/es6/number';
// import 'core-js/es6/math';
// import 'core-js/es6/string';
// import 'core-js/es6/date';
// import 'core-js/es6/array';
// import 'core-js/es6/regexp';
// import 'core-js/es6/map';
// import 'core-js/es6/weak-map';
// import 'core-js/es6/set';
/** IE10 and IE11 requires the following for NgClass support on SVG elements */
// import 'classlist.js';  // Run `npm install --save classlist.js`.
/** IE10 and IE11 requires the following for the Reflect API. */
// import 'core-js/es6/reflect';
/** Evergreen browsers require these. **/
// Used for reflect-metadata in JIT. If you use AOT (and only Angular decorators), you can remove.
__webpack_require__("../../node_modules/core-js/es7/reflect.js");
/**
 * Required to support Web Animations `@angular/platform-browser/animations`.
 * Needed for: All but Chrome, Firefox and Opera. http://caniuse.com/#feat=web-animation
 **/
// import 'web-animations-js';  // Run `npm install --save web-animations-js`.
/***************************************************************************************************
 * Zone JS is required by Angular itself.
 */
__webpack_require__("../../node_modules/zone.js/dist/zone.js"); // Included with Angular CLI.
/***************************************************************************************************
 * APPLICATION IMPORTS
 */
/**
 * Date, currency, decimal and percent pipes.
 * Needed for: All but Chrome, Firefox, Edge, IE11 and Safari 10
 */
// import 'intl';  // Run `npm install --save intl`.
/**
 * Need to import at least one locale-data with intl.
 */
// import 'intl/locale-data/jsonp/en';


/***/ }),

/***/ 1:
/***/ (function(module, exports, __webpack_require__) {

module.exports = __webpack_require__("./browser-app/polyfills.ts");


/***/ }),

/***/ "dll-reference vendor_lib":
/***/ (function(module, exports) {

module.exports = vendor_lib;

/***/ })

},[1]);
//# sourceMappingURL=polyfills.js.map