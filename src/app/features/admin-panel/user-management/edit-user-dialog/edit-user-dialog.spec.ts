import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { vi } from 'vitest';

import { EditUserDialogComponent } from './edit-user-dialog';
import { ConfigurationService } from '../../../../core/services/configuration.service';

describe('EditUserDialogComponent', () => {
  let component: EditUserDialogComponent;
  let fixture: ComponentFixture<EditUserDialogComponent>;
  let closeSpy: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    closeSpy = vi.fn();

    await TestBed.configureTestingModule({
      imports: [EditUserDialogComponent],
      providers: [
        ConfigurationService,
        {
          provide: MAT_DIALOG_DATA,
          useValue: {
            user: {
              id: 2,
              email: 'john@example.com',
              firstName: 'John',
              lastName: 'Cook',
              phone: '+48111111111',
              age: 28,
              role: 'user',
              registrationDate: new Date('2026-01-01').toISOString(),
              isAccountLocked: false,
              emailVerified: false,
              createdAt: new Date('2026-01-01').toISOString()
            }
          }
        },
        {
          provide: MatDialogRef,
          useValue: {
            close: closeSpy
          }
        }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(EditUserDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should close with undefined on cancel', () => {
    (component as any).cancel();
    expect(closeSpy).toHaveBeenCalledWith(undefined);
  });

  it('should not submit invalid form', () => {
    (component as any).firstNameControl.setValue('');

    (component as any).submit();

    expect(closeSpy).not.toHaveBeenCalled();
    expect((component as any).firstNameControl.touched).toBe(true);
  });

  it('should submit valid payload', () => {
    (component as any).firstNameControl.setValue('John');
    (component as any).lastNameControl.setValue('Cook');
    (component as any).phoneControl.setValue('+48111111111');
    (component as any).ageControl.setValue(30);
    (component as any).roleControl.setValue('admin');
    (component as any).emailVerifiedControl.setValue(true);

    (component as any).submit();

    expect(closeSpy).toHaveBeenCalledWith({
      firstName: 'John',
      lastName: 'Cook',
      phone: '+48111111111',
      age: 30,
      role: 'admin',
      emailVerified: true
    });
  });
});
