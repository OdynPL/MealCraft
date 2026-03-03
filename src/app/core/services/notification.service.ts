import { Injectable, inject } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly snackBar = inject(MatSnackBar, { optional: true });

  success(message: string): void {
    this.open(message, 'snackbar-success');
  }

  info(message: string): void {
    this.open(message, 'snackbar-info');
  }

  error(message: string): void {
    this.open(message, 'snackbar-error');
  }

  private open(message: string, panelClass: string): void {
    this.snackBar?.open(message, undefined, {
      duration: 2600,
      horizontalPosition: 'end',
      verticalPosition: 'top',
      panelClass: ['app-snackbar', panelClass]
    });
  }
}
