import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly document = inject(DOCUMENT);
  private toastContainer: HTMLElement | null = null;

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
    const container = this.getContainer();
    const toast = this.document.createElement('div');
    toast.className = `app-toast ${panelClass}`;
    toast.textContent = message;
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', panelClass === 'snackbar-error' ? 'assertive' : 'polite');
    toast.setAttribute('aria-atomic', 'true');
    container.appendChild(toast);

    requestAnimationFrame(() => {
      toast.classList.add('app-toast--visible');
    });

    window.setTimeout(() => {
      toast.classList.remove('app-toast--visible');
      window.setTimeout(() => {
        toast.remove();
      }, 160);
    }, 1500);
  }

  private getContainer(): HTMLElement {
    if (this.toastContainer) {
      return this.toastContainer;
    }

    const existing = this.document.querySelector<HTMLElement>('.app-toast-container');
    if (existing) {
      this.toastContainer = existing;
      return existing;
    }

    const container = this.document.createElement('div');
    container.className = 'app-toast-container';
    this.document.body.appendChild(container);
    this.toastContainer = container;
    return container;
  }
}
