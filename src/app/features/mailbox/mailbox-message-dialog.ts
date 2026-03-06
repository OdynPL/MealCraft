import { Component, Input, Output, EventEmitter, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Message } from './mailbox.service';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';

@Component({
  selector: 'app-mailbox-message-dialog',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './mailbox-message-dialog.html',
  styleUrl: './mailbox-message-dialog.scss',
})
export class MailboxMessageDialogComponent {
  @Input() message?: Message;
  @Output() closed = new EventEmitter<void>();

  public dialogRef = inject(MatDialogRef, { optional: true }) as MatDialogRef<MailboxMessageDialogComponent> | null;
  public data: { message?: Message } | undefined = inject(MAT_DIALOG_DATA, { optional: true }) as { message?: Message } | undefined;

  constructor() {
    if (!this.message && this.data && this.data.message) {
      this.message = this.data.message;
    }
  }
  handleCloseClick() {
    if (this.dialogRef) {
      this.dialogRef.close();
    } else {
      this.closed.emit();
    }
  }
}
