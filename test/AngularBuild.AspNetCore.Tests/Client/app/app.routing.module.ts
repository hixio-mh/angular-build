import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

//import { AuthGuard } from './core/auth-guard.service';
//import { CanDeactivateGuard } from './core/can-deactivate-guard.service';
//import { PreloadSelectedModules } from './core/selective-preload-strategy';

const routes: Routes = [
  {
    path: '',
    redirectTo: '/dashboard',
    pathMatch: 'full'
  },
  {
    path: 'about',
    loadChildren: './about/about.module#AboutModule'
    //canLoad: [AuthGuard],
    //data: {
    //  preload: true
    //}
  }
  //{ path: '**', component: PageNotFoundComponent }
  //{ path: "**", redirectTo: "/dashboard" }
];

@NgModule({
  imports: [
    RouterModule.forRoot(routes
      //,{ preloadingStrategy: PreloadSelectedModules }
    )
  ],
  declarations: [
    //PageNotFoundComponent
  ],
  exports: [RouterModule],
  providers: [
    //CanDeactivateGuard,
    //PreloadSelectedModules
  ]
})
export class AppRoutingModule { }