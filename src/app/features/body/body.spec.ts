import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { BodyComponent } from './body';

describe('BodyComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BodyComponent],
      providers: [provideHttpClientTesting(), provideRouter([])]
    }).compileComponents();
  });

  it('should render', () => {
    const fixture = TestBed.createComponent(BodyComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement).toBeTruthy();
  });

  it('should update store on search input', () => {
    const fixture = TestBed.createComponent(BodyComponent);
    fixture.detectChanges();
    const comp = fixture.componentInstance;
    const store = comp['store'];
    const spy = vi.spyOn(store, 'setQuery');
    comp['searchControl'].setValue('pizza');
    expect(spy).toHaveBeenCalledWith('pizza');
  });

  it('should update store on cuisine change', () => {
    const fixture = TestBed.createComponent(BodyComponent);
    fixture.detectChanges();
    const comp = fixture.componentInstance;
    const store = comp['store'];
    const spy = vi.spyOn(store, 'setCuisine');
    comp['cuisineControl'].setValue('Italian');
    expect(spy).toHaveBeenCalledWith('Italian');
  });

  it('should update store on category change', () => {
    const fixture = TestBed.createComponent(BodyComponent);
    fixture.detectChanges();
    const comp = fixture.componentInstance;
    const store = comp['store'];
    const spy = vi.spyOn(store, 'setCategory');
    comp['categoryControl'].setValue('Dessert');
    expect(spy).toHaveBeenCalledWith('Dessert');
  });

  it('should update store on sort change', () => {
    const fixture = TestBed.createComponent(BodyComponent);
    fixture.detectChanges();
    const comp = fixture.componentInstance;
    const store = comp['store'];
    const spy = vi.spyOn(store, 'setSort');
    comp['sortControl'].setValue('name:asc');
    expect(spy).toHaveBeenCalledWith('name', 'asc');
  });
});
