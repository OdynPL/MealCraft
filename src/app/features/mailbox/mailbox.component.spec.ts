import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MailBoxComponent } from './mailbox';
import { MailBoxService } from './mailbox.service';
import { AuthService } from '../../core/services/auth.service';

class MockMailBoxService {
  private messages = [
    { id: '1', subject: 'S1', body: 'B1', date: new Date(), read: false, sender: 'a@b.com' },
    { id: '2', subject: 'S2', body: 'B2', date: new Date(), read: true, sender: 'b@b.com' },
  ];
  getMessagesForUser() { return this.messages; }
  hasUnread() { return this.messages.some(m => !m.read); }
  markAsRead() { this.messages[0].read = true; }
  removeMessage(_userId: string, id: string) { this.messages = this.messages.filter(m => m.id !== id); }
}

class MockAuthService {
  currentUser() { return { id: '1', email: 'test@ex.com' }; }
}

describe('MailBoxComponent', () => {
  let component: MailBoxComponent;
  let fixture: ComponentFixture<MailBoxComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MailBoxComponent],
      providers: [
        { provide: MailBoxService, useClass: MockMailBoxService },
        { provide: AuthService, useClass: MockAuthService },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(MailBoxComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should list messages', () => {
    expect(component.messages().length).toBe(2);
    expect(component.messages()[0].subject).toBe('S1');
  });

  it('should mark message as read', () => {
    component.openMessage(component.messages()[0]);
    expect(component.messages()[0].read).toBe(true);
  });

  it('should remove a message', () => {
    component.removeMessage(component.messages()[0]);
    expect(component.messages().length).toBe(1);
  });
});
