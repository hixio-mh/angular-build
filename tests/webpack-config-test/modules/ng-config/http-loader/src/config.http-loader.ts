import 'rxjs/add/operator/map';
import 'rxjs/add/operator/toPromise';

import { HttpClient } from '@angular/common/http';
import { ConfigLoader } from '@bizappframework/ng-config';

export class ConfigHttpLoader implements ConfigLoader {

    constructor(private readonly http: HttpClient, private readonly endpoint: string) {
    }

    source(): string {
        return 'ConfigHttpLoader';
    }

    load(): Promise<any> {
        return this.http.get(this.endpoint)
            .map((data: any) => data)
            .toPromise();
    }
}
