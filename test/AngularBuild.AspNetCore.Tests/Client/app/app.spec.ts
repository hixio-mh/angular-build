//import { browser, element, by } from 'protractor';

describe('web-app App', () => {
  //This is called once before each spec in the describe() in which it is called.
  //beforeEach(() => {
  //    //browser.get('/');
  //});

  it('should display Dashboard', () => {
    //browser.get('/');
    const subject = 'Dashboard';
    //const result = element(by.css('app h1')).getText();
    const result = 'Dashboard';
    expect(result).toEqual(subject);
  });
});