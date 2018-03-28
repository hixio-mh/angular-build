import { NgModule, Component } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { RouterModule } from '@angular/router';

import { AppComponent } from './app.component';
import { MyInjectable } from './my-injectable';

@Component({
    selector: 'home-view',
    template: 'home!'
})
export class HomeView { }


@NgModule({
    declarations: [
        AppComponent,
        HomeView
    ],
    imports: [
        BrowserModule,
        RouterModule.forRoot([
            { path: 'lazy', loadChildren: './lazy.module#LazyModule' },
            { path: '', component: HomeView }
        ])
    ],
    providers: [
        MyInjectable
    ],
    bootstrap: [AppComponent]
})
export class AppModule { }
