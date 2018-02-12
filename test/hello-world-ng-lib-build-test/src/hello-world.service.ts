import { Injectable } from '@angular/core';

@Injectable()
export class HelloWorldService {
  displayHello(name: string): void {
    console.log(`Hello ${name}`);
  }
}
