import { Injectable, computed, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class LoadingService {
  private readonly pendingRequests = signal(0);
  private readonly visible = signal(false);
  private readonly minVisibleMs = 500;
  private visibleSince = 0;
  private hideTimer: ReturnType<typeof setTimeout> | null = null;

  readonly isLoading = computed(() => this.visible());

  start(): void {
    if (this.hideTimer !== null) {
      clearTimeout(this.hideTimer);
      this.hideTimer = null;
    }

    if (this.pendingRequests() === 0) {
      this.visibleSince = Date.now();
      this.visible.set(true);
    }

    this.pendingRequests.update((value) => value + 1);
  }

  stop(): void {
    if (this.pendingRequests() <= 0) {
      return;
    }

    this.pendingRequests.update((value) => Math.max(0, value - 1));

    if (this.pendingRequests() > 0) {
      return;
    }

    const elapsed = Date.now() - this.visibleSince;
    const remaining = this.minVisibleMs - elapsed;

    if (remaining <= 0) {
      this.visible.set(false);
      return;
    }

    this.hideTimer = setTimeout(() => {
      this.hideTimer = null;
      if (this.pendingRequests() === 0) {
        this.visible.set(false);
      }
    }, remaining);
  }
}
