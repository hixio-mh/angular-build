import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

//import { DragulaModule } from "ng2-dragula/ng2-dragula";
//import { StructureService } from './shared/structure.service';
//import { WidgetService } from './shared/widget.service';
//import { DndService } from './shared/dnd.service';
//import { WidgetComponent } from './components/widget.component';
//import { ColumnComponent } from './components/column.component';
//import { RowComponent } from './components/row.component';

import { DashboardComponent } from './components/dashboard.component';
import { DashboardRoutingModule} from './dashboard.routing.module';

//import { MaterialModule } from 'ui';
//import { MaterialModule } from '@angular/material';

@NgModule({
  imports: [CommonModule, DashboardRoutingModule],
  declarations: [
    DashboardComponent
    //WidgetComponent,
    //ColumnComponent,
    //RowComponent,
  ],
  exports: [DashboardComponent]
  //providers: [StructureService, WidgetService, DndService]
})
export class DashboardModule {}
