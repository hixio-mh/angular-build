export function getAngularGlobals(): { [key: string]: string } {
    return {
        moment: 'moment',

        '@angular/animations': 'ng.animations',
        '@angular/common': 'ng.common',
        '@angular/common/http': 'ng.common.http',
        '@angular/common/testing': 'ng.common.testing',
        '@angular/common/http/testing': 'ng.common.http.testing',
        '@angular/compiler': 'ng.compiler',
        '@angular/core': 'ng.core',
        '@angular/core/testing': 'ng.core.testing',
        '@angular/forms': 'ng.forms',
        '@angular/http': 'ng.http',
        '@angular/platform-browser': 'ng.platformBrowser',
        '@angular/platform-browser-dynamic': 'ng.platformBrowserDynamic',
        '@angular/platform-browser/animations': 'ng.platformBrowser.animations',
        '@angular/platform-server': 'ng.platformServer',
        '@angular/platform-webworker': 'ng.platformWebworker',
        '@angular/platform-webworker-dynamic': 'ng.platformWebworkerDynamic',
        '@angular/router': 'ng.router',

        '@angular/material': 'ng.material',
        '@angular/material-moment-adapter': 'ng.materialMomentAdapter',

        '@angular/cdk': 'ng.cdk',
        '@angular/cdk/a11y': 'ng.cdk.a11y',
        '@angular/cdk/accordion': 'ng.cdk.accordion',
        '@angular/cdk/bidi': 'ng.cdk.bidi',
        '@angular/cdk/coercion': 'ng.cdk.coercion',
        '@angular/cdk/collections': 'ng.cdk.collections',
        '@angular/cdk/keycodes': 'ng.cdk.keycodes',
        '@angular/cdk/layout': 'ng.cdk.layout',
        '@angular/cdk/observers': 'ng.cdk.observers',
        '@angular/cdk/overlay': 'ng.cdk.overlay',
        '@angular/cdk/platform': 'ng.cdk.platform',
        '@angular/cdk/portal': 'ng.cdk.portal',
        '@angular/cdk/scrolling': 'ng.cdk.scrolling',
        '@angular/cdk/stepper': 'ng.cdk.stepper',
        '@angular/cdk/table': 'ng.cdk.table',
        '@angular/cdk/testing': 'ng.cdk.testing',
        '@angular/cdk/tree': 'ng.cdk.tree'
    };
}
