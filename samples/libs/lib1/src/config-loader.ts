import { Observable } from 'rxjs';

export interface ConfigLoader {
    load(): Observable<{ [key: string]: string }>;
}
