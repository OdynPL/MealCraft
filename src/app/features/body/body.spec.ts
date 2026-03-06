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
});
