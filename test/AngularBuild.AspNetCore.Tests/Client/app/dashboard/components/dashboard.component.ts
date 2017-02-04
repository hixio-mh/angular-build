import { Component, Input, ViewEncapsulation, OnInit, HostBinding } from '@angular/core';
//import { routeAnimation } from '../../shared/animations';


@Component({
    //moduleId: module.id,
    selector: 'app-dashboard',
    templateUrl: './dashboard.component.html',
    styleUrls: ['./dashboard.component.scss'],
    //animations: [routeAnimation]
    //encapsulation: ViewEncapsulation.None
})
export class DashboardComponent implements OnInit {
    ngOnInit() {
        console.log('DashboardComponent is loaded!!');
    }
}
