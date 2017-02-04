//import { Component, Input, ChangeDetectionStrategy, ViewEncapsulation, OnInit, HostBinding } from '@angular/core';
import { Component, OnInit, HostBinding } from '@angular/core';
//import { routeAnimation } from '../../shared/animations';

@Component({
  //changeDetection: ChangeDetectionStrategy.Default,
  //encapsulation: ViewEncapsulation.Emulated,
  selector: 'app-about',
  templateUrl: 'about.component.html'
  //animations: [routeAnimation]
})
export class AboutComponent implements OnInit {

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
    console.log('AboutComponent is lazy-loaded!!');
  }
}