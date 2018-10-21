export function getRxJsGlobals(): { [key: string]: string } {
    return {
        rxjs: 'rxjs',
        'rxjs/operators': 'rxjs.operators'
    };
}
