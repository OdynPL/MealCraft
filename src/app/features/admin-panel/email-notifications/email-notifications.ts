import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MailBoxService, Message } from '../../mailbox/mailbox.service';
import { AuthService } from '../../../core/services/auth.service';
import { StoredUser } from '../../../core/models/auth';
import { FormsModule } from '@angular/forms';
import { effect } from '@angular/core';

@Component({
  selector: 'app-email-notifications',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './email-notifications.html',
  styleUrl: './email-notifications.scss',
})
export class EmailNotificationsComponent {
  private readonly mailbox = inject(MailBoxService);
  private readonly auth = inject(AuthService);

  subject = '';
  body = '';
  recipientId = '';
  info = signal('');

  users = signal<StoredUser[]>([]);
  loading = signal(true);

  constructor() {
    // Reactive effect: reload users whenever component is constructed
    effect(() => {
      this.loading.set(true);
      this.auth.getAllUsersPublic().then(users => {
        this.users.set(users);
        this.loading.set(false);
      });
    });
  }

  sendEmail() {
    if (!this.subject.trim() || !this.body.trim() || !this.recipientId) {
      this.info.set('Wszystkie pola są wymagane.');
      return;
    }
    const currentUser = this.auth.currentUser();
    const msg: Message = {
      id: Date.now().toString(),
      subject: this.subject,
      body: this.body,
      date: new Date(),
      read: false,
      sender: currentUser?.email ?? 'unknown'
    };
    this.mailbox.addMessage(this.recipientId, msg);
    this.info.set('Wiadomość wysłana!');
    this.subject = '';
    this.body = '';
    this.recipientId = '';
  }
}
