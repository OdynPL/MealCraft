import { Injectable, signal } from '@angular/core';

export interface SystemError {
  timestamp: Date;
  message: string;
  stack?: string;
  context?: string;
  code?: string | number;
}

@Injectable({ providedIn: 'root' })
export class GlobalErrorLogService {
  private readonly STORAGE_KEY = 'system-errors';
  private readonly _errors = signal<SystemError[]>(this.loadFromStorage());

  get errors() {
    return this._errors();
  }

  log(error: SystemError) {
    this._errors.update((prev) => {
      const next = [error, ...prev];
      this.saveToStorage(next);
      return next;
    });
  }

  clear() {
    this._errors.set([]);
    this.saveToStorage([]);
  }

  private saveToStorage(errors: SystemError[]) {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(errors));
    } catch {
      // ignore storage errors
    }
  }

  private loadFromStorage(): SystemError[] {
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      if (raw) {
        const arr = JSON.parse(raw);
        return Array.isArray(arr)
          ? arr.map(e => ({ ...e, timestamp: new Date(e.timestamp) }))
          : [];
      }
    } catch {
      // ignore storage errors
    }
    return [];
  }
}
