/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

 // tslint:disable:no-default-export

export default function (content: string, map: object): string {
  const stringifiedContent = JSON.stringify(content);
  const stringifiedMap = map && JSON.stringify(map);

  return `module.exports = [[module.id, ${stringifiedContent}, '', ${stringifiedMap}]]`;
}
