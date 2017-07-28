// temporarily work around to fix error 
// TS2415: Class 'Subject<T>' incorrectly extends base class 'Observable<T>'.
// Types of property 'lift' are incompatible.
// keep in mind, RxJS 6 will have this corrected.

import { Operator } from 'rxjs/Operator';
import { Observable } from 'rxjs/Observable';

declare module 'rxjs/Subject' {
    interface Subject<T> {
        lift<R>(operator: Operator<T, R>): Observable<R>;
    }
}
