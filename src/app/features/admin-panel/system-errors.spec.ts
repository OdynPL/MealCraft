import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SystemErrorsComponent } from './system-errors';
import { GlobalErrorLogService } from '../../core/services/global-error-log.service';
import { By } from '@angular/platform-browser';
import { DatePipe } from '@angular/common';

function createError() {
  return {
    timestamp: new Date('2024-01-01T12:00:00Z'),
    message: 'Test error',
    context: 'TestContext',
    stack: 'stacktrace',
    code: 500
  };
}

describe('SystemErrorsComponent', () => {
  let errorLog: { clear: ReturnType<typeof vi.fn>; errors: any[] };

  beforeEach(async () => {
    errorLog = {
      clear: vi.fn(),
      errors: [createError()]
    };
    await TestBed.configureTestingModule({
      imports: [SystemErrorsComponent, DatePipe],
      providers: [
        { provide: GlobalErrorLogService, useValue: errorLog }
      ]
    }).compileComponents();
  });

  it('should render error table with error', () => {
    const fixture = TestBed.createComponent(SystemErrorsComponent);
    fixture.detectChanges();
    const table = fixture.nativeElement.querySelector('table');
    expect(table).toBeTruthy();
    expect(table.textContent).toContain('Test error');
    expect(table.textContent).toContain('TestContext');
  });

  it('should filter errors by search', () => {
    const fixture = TestBed.createComponent(SystemErrorsComponent);
    fixture.detectChanges();
    const input = fixture.debugElement.query(By.css('input'));
    input.nativeElement.value = 'notfound';
    input.nativeElement.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('No system errors logged.');
  });

  it('should clear errors on button click', () => {
    const fixture = TestBed.createComponent(SystemErrorsComponent);
    fixture.detectChanges();
    const button = fixture.debugElement.query(By.css('button[mat-stroked-button]'));
    button.nativeElement.click();
    fixture.detectChanges();
    expect(errorLog.clear).toHaveBeenCalled();
  });
});
