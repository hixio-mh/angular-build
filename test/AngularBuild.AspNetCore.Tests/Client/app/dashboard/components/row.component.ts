import { Component, Input } from "@angular/core";
import { Row } from '../shared/row';
import { DashboardModel } from '../shared/dashboard.model';

@Component({
  selector: 'adf-row',
  templateUrl: './row.component.html'
})
export class RowComponent {

  @Input()
  row: Row;

  @Input()
  model: DashboardModel;
}
