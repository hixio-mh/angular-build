import { NgModule, Component } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';

@Component({
  selector: 'app',
  template: '<h1>Hello</h1>'
})
export class AppComponent
{
}

@NgModule({
  imports: [
    BrowserModule
  ],
  declarations: [AppComponent],
  bootstrap: [AppComponent],

})
export class AppModule {}