import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { DashboardComponent } from './components/dashboard.component';
//import { AuthGuard } from "../core/auth-guard.service";

const routes: Routes = [
  {
    //path: "",
    path: 'dashboard',
    component: DashboardComponent
    //canActivate: [AuthGuard]
  }
];

@NgModule({
  imports: [
    RouterModule.forChild(routes)
  ],
  exports: [
    RouterModule
  ]
})
export class DashboardRoutingModule { }