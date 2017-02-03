import { Component } from '@angular/core';
//import { TranslateService } from 'ng2-translate';
//import { Locale, LocaleService, LocalizationService } from 'angular2localization';

@Component({
  selector: 'app',
    templateUrl: './app.component.html',
    styleUrls: ['./app.component.css']
})
export class AppComponent {
  //constructor(private translate: TranslateService) {
  //  translate.addLangs(["en"]);
  //  translate.setDefaultLang('en');

  //  //let browserLang = translate.getBrowserLang();
  //  //translate.use(browserLang.match(/en|fr/) ? browserLang : 'en');
  //}
}

//export class AppComponent extends Locale{

//  constructor(public locale: LocaleService,public localization: LocalizationService) {
//    super(null, localization);

//    // Adds a new language (ISO 639 two-letter code).
//    //this.locale.addLanguage('my');
//    //this.locale.addLanguage('en');
//    //this.locale.definePreferredLocale('en', 'US', 30);
//    //this.localization.translationProvider('./i18n/locale-');

//    // Required: initializes the translation provider with the given path prefix.
//    //this.localization.updateTranslation(); // Need to update the translation.

//    //this.locale.languageCodeChanged.subscribe( (item : any) => this.onLanguageCodeChangedDataRecieved(item));
//    this.localization.translationChanged.subscribe(

//      // Refreshes the document title with the new translation when the selected language changes.
//      () => {
//        // this.title.setTitle(this.localization.translate('TITLE'));
//      }

//    );

//  }

//  //private onLanguageCodeChangedDataRecieved(item: any) {
//  //  console.log('onLanguageCodeChangedDataRecieved App');
//  //  console.log(item);
//  //}
//}

