// tslint:disable:no-any
// tslint:disable:no-unsafe-any
// tslint:disable:no-implicit-dependencies

import { DOCUMENT } from '@angular/common';
import { Inject, Injectable } from '@angular/core';

@Injectable({
    providedIn: 'root'
})
export class MyInjectable {
    constructor(@Inject(DOCUMENT) public doc: any) { }
}
