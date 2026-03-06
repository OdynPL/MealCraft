import { MailBoxService, Message } from './mailbox.service';
import { MockConfigurationService } from './mailbox.service.mock-config';
import { ConfigurationService } from '../../core/services/configuration.service';
import { runInInjectionContext, EnvironmentInjector, createEnvironmentInjector } from '@angular/core';
import { TestBed } from '@angular/core/testing';

describe('MailBoxService', () => {
  let service: MailBoxService;
  const userId = '1';

  beforeEach(() => {
    let storageData: Record<string, string> = {};
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem: (key: string) => storageData[key] ?? null,
        setItem: (key: string, value: string) => { storageData[key] = value; },
        removeItem: (key: string) => { delete storageData[key]; },
        clear: () => { storageData = {}; }
      }
    });
    // Clear localStorage for isolation
    localStorage.clear();
    const parent = TestBed.inject(EnvironmentInjector);
    const injector = createEnvironmentInjector([
      { provide: MockConfigurationService, useClass: MockConfigurationService },
      { provide: ConfigurationService, useClass: MockConfigurationService }
    ], parent);
    runInInjectionContext(injector, () => {
      service = new MailBoxService();
    });
  });

  it('should add and retrieve messages for a user', () => {
    const msg: Message = {
      id: 'm1',
      subject: 'Test',
      body: 'Body',
      date: new Date(),
      read: false,
      sender: 'test@example.com',
    };
    service.addMessage(userId, msg);
    const messages = service.getMessagesForUser(userId);
    expect(messages.length).toBe(1);
    expect(messages[0].subject).toBe('Test');
    expect(messages[0].sender).toBe('test@example.com');
  });

  it('should mark a message as read', () => {
    const msg: Message = {
      id: 'm2',
      subject: 'Read',
      body: 'Body',
      date: new Date(),
      read: false,
      sender: 'a@b.com',
    };
    service.addMessage(userId, msg);
    service.markAsRead(userId, 'm2');
    const messages = service.getMessagesForUser(userId);
    expect(messages[0].read).toBe(true);
  });

  it('should remove a message', () => {
    const msg: Message = {
      id: 'm3',
      subject: 'Remove',
      body: 'Body',
      date: new Date(),
      read: false,
      sender: 'a@b.com',
    };
    service.addMessage(userId, msg);
    service.removeMessage(userId, 'm3');
    const messages = service.getMessagesForUser(userId);
    expect(messages.length).toBe(0);
  });

  it('should persist messages in localStorage', () => {
    const msg: Message = {
      id: 'm4',
      subject: 'Persist',
      body: 'Body',
      date: new Date(),
      read: false,
      sender: 'persist@ex.com',
    };
    service.addMessage(userId, msg);
    // Re-instantiate service to simulate reload
    const parent = TestBed.inject(EnvironmentInjector);
    const injector = createEnvironmentInjector([
      { provide: MockConfigurationService, useClass: MockConfigurationService },
      { provide: ConfigurationService, useClass: MockConfigurationService }
    ], parent);
    let newService: MailBoxService | undefined;
    runInInjectionContext(injector, () => {
      newService = new MailBoxService();
    });
    if (!newService) throw new Error('newService not created');
    const messages = newService.getMessagesForUser(userId);
    expect(messages.length).toBe(1);
    expect(messages[0].sender).toBe('persist@ex.com');
  });

  it('should return hasUnread correctly', () => {
    const msg: Message = {
      id: 'm5',
      subject: 'Unread',
      body: 'Body',
      date: new Date(),
      read: false,
      sender: 'unread@ex.com',
    };
    service.addMessage(userId, msg);
    expect(service.hasUnread(userId)).toBe(true);
    service.markAsRead(userId, 'm5');
    expect(service.hasUnread(userId)).toBe(false);
  });
});
