//import { NgModule, APP_INITIALIZER, Injectable } from '@angular/core';
//import { LocaleModule, LocalizationModule, LocaleService, LocalizationService } from 'angular2localization';

//@Injectable()
//export class LocalizationConfig {

//  constructor(public locale: LocaleService, public localization: LocalizationService) { }

//  load(): Promise<any> {

//    // Adds the languages (ISO 639 two-letter or three-letter code).
//    this.locale.addLanguages(['en']);
//    //this.locale.addLanguages(['en', 'it', 'ar']);

//    // Required: default language, country (ISO 3166 two-letter, uppercase code) and expiry (No days). If the expiry is omitted, the cookie becomes a session cookie.
//    this.locale.definePreferredLocale('en', 'US', 30);

//    // Optional: default currency (ISO 4217 three-letter code).
//    this.locale.definePreferredCurrency('USD');

//    // Initializes LocalizationService: asynchronous loading.
//    this.localization.translationProvider('./resources/locale-'); // Required: initializes the translation provider with the given path prefix.

//    const promise: Promise<any> = new Promise((resolve: any) => {
//      this.localization.translationChanged.subscribe(() => {
//        resolve(true);
//      });
//    });

//    this.localization.updateTranslation(); // Need to update the translation.

//    return promise;
//  }
//}

///**
// * Aot compilation requires a reference to an exported function.
// */
//export function initLocalization(localizationConfig: LocalizationConfig): Function {
//  return () => localizationConfig.load();
//}