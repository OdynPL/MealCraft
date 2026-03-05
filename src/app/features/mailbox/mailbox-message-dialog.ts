import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Message } from './mailbox.service';

@Component({
  selector: 'app-mailbox-message-dialog',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="mailbox-message-dialog">
      <h3>{{ message?.subject }}</h3>
      <div class="mailbox-message-date">{{ message?.date | date:'short' }}</div>
      <div class="mailbox-message-body">{{ message?.body }}</div>
    </div>
  `,
  styleUrl: './mailbox-message-dialog.scss',
})
export class MailboxMessageDialogComponent {
  @Input() message?: Message;
}
