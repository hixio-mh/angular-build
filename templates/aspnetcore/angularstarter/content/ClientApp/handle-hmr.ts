import { ApplicationRef, NgModuleRef } from '@angular/core';
import { removeNgStyles, createNewHosts } from '@angularclass/hmr';

export function handleHmr(ngModuleRef: NgModuleRef<any>, webpackModule: WebpackModule): void {
    webpackModule.hot.accept();

    const appRef = ngModuleRef.injector.get(ApplicationRef) as ApplicationRef;

    if ((ngModuleRef.instance as any).hmrOnInit && webpackModule.hot.data) {
        (ngModuleRef.instance as any).hmrOnInit(webpackModule.hot.data);
    }

    if ((ngModuleRef.instance as any).hmrOnStatus) {
        webpackModule.hot.apply((status: any) => {
            (ngModuleRef.instance as any).hmrOnStatus(status);
        });
    }

    if ((ngModuleRef.instance as any).hmrOnCheck) {
        webpackModule.hot.check((err: Error, outdatedModules: any) => {
            (ngModuleRef.instance as any).hmrOnCheck(err, outdatedModules);
        });
    }

    if ((ngModuleRef.instance as any).hmrOnDecline) {
        webpackModule.hot.decline((dependencies: any) => {
            (ngModuleRef.instance as any).hmrOnDecline(dependencies);
        });
    }

    webpackModule.hot.dispose((data: any) => {
        if ((ngModuleRef.instance as any).hmrOnDestroy) {
            (ngModuleRef.instance as any).hmrOnDestroy(data);
        }

        // const oldRootElem = document.querySelector('app');
        // const newRootElem = document.createElement('app');
        // oldRootElem!.parentNode!.insertBefore(newRootElem, oldRootElem);
        // moduleRef.destroy();
        const cmpLocations = appRef.components.map(cmp => cmp.location.nativeElement);
        const disposeOldHosts = createNewHosts(cmpLocations);
        ngModuleRef.destroy();
        removeNgStyles();
        disposeOldHosts();

        if ((ngModuleRef.instance as any).hmrAfterDestroy) {
            (ngModuleRef.instance as any).hmrAfterDestroy(data);
        }
    });
}
