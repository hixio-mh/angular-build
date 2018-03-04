import { Injectable } from '@angular/core';

@Injectable()
export class HelloWorldService {
    displayHello(name: string): void {
        // tslint:disable-next-line:no-console
        console.log(`Hello ${name}`);
    }
}
