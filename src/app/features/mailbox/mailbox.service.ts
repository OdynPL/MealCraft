export interface Message {
  id: string;
  subject: string;
  body: string;
  date: Date;
  read: boolean;
  sender?: string;
}

import { Injectable, inject } from '@angular/core';
import { ConfigurationService } from '../../core/services/configuration.service';

@Injectable({ providedIn: 'root' })
export class MailBoxService {
  private readonly config = inject(ConfigurationService);
  private messages: Record<string, Message[]> = this.readAll();

  private readAll(): Record<string, Message[]> {
    if (typeof localStorage === 'undefined') return {};
    const raw = localStorage.getItem(this.config.mailboxStorageKey);
    if (!raw) return {};
    try {
      const parsed = JSON.parse(raw);
      if (typeof parsed !== 'object' || parsed === null) return {};
      return parsed;
    } catch {
      return {};
    }
  }

  private writeAll() {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(this.config.mailboxStorageKey, JSON.stringify(this.messages));
    } catch {
      // ignore write errors
    }
  }

  getMessagesForUser(userId?: string): Message[] {
    if (!userId) return [];
    return this.messages[userId] || [];
  }

  addMessage(userId: string, message: Message) {
    if (!this.messages[userId]) {
      this.messages[userId] = [];
    }
    this.messages[userId].push(message);
    this.writeAll();
  }

  hasUnread(userId?: string): boolean {
    return !!userId && (this.messages[userId]?.some(m => !m.read) ?? false);
  }

  markAsRead(userId: string, messageId: string) {
    const msgs = this.messages[userId];
    if (!msgs) return;
    const msg = msgs.find(m => m.id === messageId);
    if (msg) msg.read = true;
    this.writeAll();
  }

  removeMessage(userId: string, messageId: string) {
    const msgs = this.messages[userId];
    if (!msgs) return;
    this.messages[userId] = msgs.filter(m => m.id !== messageId);
    this.writeAll();
  }

}
