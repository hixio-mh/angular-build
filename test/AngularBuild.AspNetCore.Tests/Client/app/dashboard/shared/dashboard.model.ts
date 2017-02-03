import { Widget } from './widget';

export interface DashboardModel {
  // id of dashboard structure
  structure: string;
  // widgets
  widgets: Widget[];
}
