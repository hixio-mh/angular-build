import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { ConfigLoader } from '@ngb-demo/lib1';

@Injectable({
    providedIn: 'root'
})
export class ConfigHttpLoader implements ConfigLoader {
    constructor(private readonly _httpClient: HttpClient) { }

    // tslint:disable-next-line:no-any
    load(): Observable<{ [key: string]: string }> {
        return this._httpClient.get<{ [key: string]: string }>('/appsettings.json');
    }
}
