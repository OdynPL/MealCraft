import { BodyStateService } from './body-state.service';
import { FormControl } from '@angular/forms';
import { TestBed } from '@angular/core/testing';
import { ConfigurationService } from '../../core/services/configuration.service';

describe('BodyStateService', () => {
  let service: BodyStateService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        BodyStateService,
        { provide: ConfigurationService, useValue: {} },
      ],
    });
    service = TestBed.inject(BodyStateService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('syncControl sets value if different', () => {
    const control = new FormControl<string>('foo');
    service.syncControl(control, 'bar');
    expect(control.value).toBe('bar');
  });

  it('syncControl does not set value if same', () => {
    const control = new FormControl<string>('foo');
    const spy = vi.spyOn(control, 'setValue');
    service.syncControl(control, 'foo');
    expect(control.value).toBe('foo');
    expect(spy).not.toHaveBeenCalled();
  });

  it('syncControl handles null value in control', () => {
    const control = new FormControl<string | null>(null);
    service.syncControl(control, 'foo');
    expect(control.value).toBe('foo');
  });

  it('parseSortBy returns valid value', () => {
    expect(service.parseSortBy('name')).toBe('name');
    expect(service.parseSortBy('tags')).toBe('tags');
    expect(service.parseSortBy('votes')).toBe('votes');
    expect(service.parseSortBy('id')).toBe('id');
    expect(service.parseSortBy(null)).toBe('id');
    expect(service.parseSortBy('unknown')).toBe('id');
    expect(service.parseSortBy(undefined as any)).toBe('id');
  });

  it('parseSortDirection returns asc or desc', () => {
    expect(service.parseSortDirection('asc')).toBe('asc');
    expect(service.parseSortDirection('desc')).toBe('desc');
    expect(service.parseSortDirection(null)).toBe('desc');
    expect(service.parseSortDirection('other')).toBe('desc');
    expect(service.parseSortDirection(undefined as any)).toBe('desc');
  });

  it('parseNumber returns parsed number or fallback', () => {
    expect(service.parseNumber('5', 1)).toBe(5);
    expect(service.parseNumber('not-a-number', 2)).toBe(2);
    expect(service.parseNumber(null, 3)).toBe(3);
    expect(service.parseNumber(undefined as any, 7)).toBe(7);
    expect(service.parseNumber('NaN', 8)).toBe(8);
  });

  it('parseBoolean returns true for 1 or true', () => {
    expect(service.parseBoolean('1')).toBeTruthy();
    expect(service.parseBoolean('true')).toBeTruthy();
    expect(service.parseBoolean('0')).toBeFalsy();
    expect(service.parseBoolean('false')).toBeFalsy();
    expect(service.parseBoolean(null)).toBeFalsy();
    expect(service.parseBoolean('random')).toBeFalsy();
    expect(service.parseBoolean('')).toBeFalsy();
  });
});
