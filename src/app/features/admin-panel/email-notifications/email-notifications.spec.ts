import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EmailNotificationsComponent } from './email-notifications';
import { MailBoxService } from '../../mailbox/mailbox.service';
import { AuthService } from '../../../core/services/auth.service';

const mockMailbox = {
  addMessage: vi.fn()
};
const mockAuth = {
  getAllUsersPublic: vi.fn().mockResolvedValue([]),
  currentUser: vi.fn().mockReturnValue({ email: 'test@example.com' })
};

describe('EmailNotificationsComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EmailNotificationsComponent],
      providers: [
        { provide: MailBoxService, useValue: mockMailbox },
        { provide: AuthService, useValue: mockAuth }
      ]
    }).compileComponents();
  });

  it('should render', () => {
    const fixture = TestBed.createComponent(EmailNotificationsComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement).toBeTruthy();
  });

  it('should show error if fields are empty', () => {
    const fixture = TestBed.createComponent(EmailNotificationsComponent);
    fixture.detectChanges();
    const comp = fixture.componentInstance;
    comp.subject = '';
    comp.body = '';
    comp.recipientId = '';
    comp.sendEmail();
    expect(comp.info()).toContain('Wszystkie pola są wymagane');
    expect(mockMailbox.addMessage).not.toHaveBeenCalled();
  });

  it('should send email and reset fields', () => {
    const fixture = TestBed.createComponent(EmailNotificationsComponent);
    fixture.detectChanges();
    const comp = fixture.componentInstance;
    comp.subject = 'Test subject';
    comp.body = 'Test body';
    comp.recipientId = 'user1';
    comp.sendEmail();
    expect(mockMailbox.addMessage).toHaveBeenCalledWith(
      'user1',
      expect.objectContaining({
        subject: 'Test subject',
        body: 'Test body',
        sender: 'test@example.com',
        read: false
      })
    );
    expect(comp.info()).toContain('Wiadomość wysłana');
    expect(comp.subject).toBe('');
    expect(comp.body).toBe('');
    expect(comp.recipientId).toBe('');
  });
});
