import { Component, ViewEncapsulation } from '@angular/core';

import { MyInjectable } from './my-injectable';

@Component({
    selector: 'app-root',
    templateUrl: './app.component.html',
    styleUrls: ['./app.component.scss'],
    encapsulation: ViewEncapsulation.None
})
export class AppComponent {
    constructor(public inj: MyInjectable) {
        // tslint:disable-next-line:no-console
        console.log(inj);
    }
}
