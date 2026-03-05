import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../core/services/auth.service';
import { MailBoxService, Message } from './mailbox.service';
import { MailboxMessageDialogComponent } from './mailbox-message-dialog';

@Component({
  selector: 'app-mailbox',
  standalone: true,
  imports: [CommonModule, MailboxMessageDialogComponent],
  templateUrl: './mailbox.html',
  styleUrl: './mailbox.scss',
})
export class MailBoxComponent {
  private readonly auth = inject(AuthService);
  private readonly mailbox = inject(MailBoxService);
  showDialog = signal(false);
  dialogMessage = signal<Message|undefined>(undefined);
  messages = signal<Message[]>([]);
  hasUnread = signal(false);

  constructor() {
    this.refreshMessages();
  }

  private userId(): string | undefined {
    const id = this.auth.currentUser()?.id;
    return id !== undefined && id !== null ? String(id) : undefined;
  }

  private refreshMessages() {
    const userId = this.userId();
    if (userId) {
      this.messages.set(this.mailbox.getMessagesForUser(userId));
      this.hasUnread.set(this.mailbox.hasUnread(userId));
    } else {
      this.messages.set([]);
      this.hasUnread.set(false);
    }
  }

  openMessage(message: Message) {
    this.dialogMessage.set(message);
    this.showDialog.set(true);
    if (!message.read) {
      const userId = this.userId();
      if (userId) {
        this.mailbox.markAsRead(userId, message.id);
        this.refreshMessages();
      }
    }
  }

  closeDialog() {
    this.showDialog.set(false);
    this.dialogMessage.set(undefined);
  }

  removeMessage(message: Message) {
    const userId = this.userId();
    if (userId) {
      this.mailbox.removeMessage(userId, message.id);
      this.refreshMessages();
    }
  }
}
