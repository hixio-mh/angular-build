import { Component, Input, ViewEncapsulation, OnInit, HostBinding } from '@angular/core';
//import { routeAnimation } from '../../core/animations';

//import { DashboardModel } from "../shared/dashboard.model";
//import { Structure } from "../shared/structure";
//import { DndService, DndEvent } from "../shared/dnd.service";
//import { StructureService } from "../shared/structure.service";


@Component({
    //moduleId: module.id,
    selector: 'app-dashboard',
    templateUrl: './dashboard.component.html',
    styleUrls: ['./dashboard.component.css'],
    //animations: [routeAnimation]
    //encapsulation: ViewEncapsulation.None
})
export class DashboardComponent implements OnInit {
    //@Input()
    //model: DashboardModel;

    //error: string;
    //structure: Structure;

    //constructor(
    //  private dndService: DndService,
    //  private structureService: StructureService
    //) {
    //  dndService.subscribe(event => this.handleDndEvent(event));
    //}

    //@HostBinding('@routeAnimation') get routeAnimation() {
    //  return true;
    //}

    //@HostBinding('style.display') get display() {
    //  return 'block';
    //}

    //@HostBinding('style.position') get position() {
    //  return 'absolute';
    //}


    ngOnInit() {
        console.log('DashboardComponent is loaded!!');

        //let structureId = this.model.structure;
        //if (structureId) {
        //  this.structure = this.structureService.get(structureId);
        //  if (!this.structure) {
        //    this.error = 'could not find structure with id ' + structureId;
        //  }
        //} else {
        //  this.error = 'model does not define structure';
        //}
    }

    //private handleDndEvent(event: DndEvent) {
    //  this.dndService.synchronizeModel(this.model, event);
    //}

}
