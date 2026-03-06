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
});
