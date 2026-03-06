import { TestBed } from '@angular/core/testing';
import { AppPreferencesService } from './app-preferences.service';
import { ConfigurationService } from './configuration.service';

describe('AppPreferencesService', () => {
  let service: AppPreferencesService;
  let storageData: Record<string, string>;

  class MockConfig {
    dummyProductsEnabledStorageKey = 'test-dummy-products-enabled';
  }

  beforeEach(() => {
    storageData = {};
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem: (key: string) => storageData[key] ?? null,
        setItem: (key: string, value: string) => { storageData[key] = value; },
        removeItem: (key: string) => { delete storageData[key]; },
        clear: () => { storageData = {}; }
      }
    });
    TestBed.configureTestingModule({
      providers: [
        AppPreferencesService,
        { provide: ConfigurationService, useClass: MockConfig }
      ]
    });
    service = TestBed.inject(AppPreferencesService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should default to true if no value in storage', () => {
    expect(service.includeDummyProducts()).toBe(true);
  });

  it('should read false from storage', () => {
    localStorage.setItem('test-dummy-products-enabled', '0');
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        AppPreferencesService,
        { provide: ConfigurationService, useClass: MockConfig }
      ]
    });
    const service = TestBed.inject(AppPreferencesService);
    expect(service.includeDummyProducts()).toBe(false);
  });

  it('should read true from storage', () => {
    localStorage.setItem('test-dummy-products-enabled', '1');
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        AppPreferencesService,
        { provide: ConfigurationService, useClass: MockConfig }
      ]
    });
    const service = TestBed.inject(AppPreferencesService);
    expect(service.includeDummyProducts()).toBe(true);
  });

  it('should set and persist value', () => {
    service.setIncludeDummyProducts(false);
    expect(localStorage.getItem('test-dummy-products-enabled')).toBe('0');
    expect(service.includeDummyProducts()).toBe(false);
    service.setIncludeDummyProducts(true);
    expect(localStorage.getItem('test-dummy-products-enabled')).toBe('1');
    expect(service.includeDummyProducts()).toBe(true);
  });
});
