import { Injectable } from '@angular/core';

// tslint:disable-next-line:no-unsafe-any
@Injectable()
export class HelloWorldService {
    displayHello(name: string): void {
        // tslint:disable-next-line:no-console
        console.log(`Hello ${name}`);
    }
}
