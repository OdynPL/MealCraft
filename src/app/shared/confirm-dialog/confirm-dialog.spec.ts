import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { ConfirmDialogComponent } from './confirm-dialog';

describe('ConfirmDialogComponent', () => {
  let dialogRefSpy: { close: ReturnType<typeof vi.fn> };
  let fixture: any;

  beforeEach(async () => {
    dialogRefSpy = { close: vi.fn() };
    await TestBed.configureTestingModule({
      imports: [ConfirmDialogComponent],
      providers: [
        { provide: MatDialogRef, useValue: dialogRefSpy },
        { provide: MAT_DIALOG_DATA, useValue: { title: 'Test', message: 'Are you sure?' } }
      ]
    }).compileComponents();
    fixture = TestBed.createComponent(ConfirmDialogComponent);
    fixture.detectChanges();
  });

  it('should render dialog with data', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Are you sure?');
  });

  it('should close with false on cancel', () => {
    fixture.componentInstance['cancel']();
    expect(dialogRefSpy.close).toHaveBeenCalledWith(false);
  });

  it('should close with true on confirm', () => {
    fixture.componentInstance['confirm']();
    expect(dialogRefSpy.close).toHaveBeenCalledWith(true);
  });
});
