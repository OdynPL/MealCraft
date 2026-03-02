import { HttpResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';

interface CacheEntry {
  response: HttpResponse<unknown>;
  expiresAt: number;
}

const TTL_MS = 30_000;

@Injectable({ providedIn: 'root' })
export class HttpCacheService {
  private readonly entries = new Map<string, CacheEntry>();

  get(key: string): HttpResponse<unknown> | null {
    const entry = this.entries.get(key);
    if (!entry) {
      return null;
    }

    if (Date.now() > entry.expiresAt) {
      this.entries.delete(key);
      return null;
    }

    return entry.response.clone();
  }

  set(key: string, response: HttpResponse<unknown>): void {
    this.entries.set(key, {
      response: response.clone(),
      expiresAt: Date.now() + TTL_MS
    });
  }

  clearByPrefix(prefix: string): void {
    for (const key of this.entries.keys()) {
      if (key.includes(prefix)) {
        this.entries.delete(key);
      }
    }
  }

  clearAll(): void {
    this.entries.clear();
  }
}
