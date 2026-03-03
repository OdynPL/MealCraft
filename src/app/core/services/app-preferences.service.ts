import { Injectable, computed, inject, signal } from '@angular/core';

import { ConfigurationService } from './configuration.service';

@Injectable({ providedIn: 'root' })
export class AppPreferencesService {
  private readonly config = inject(ConfigurationService);
  private readonly includeDummyProductsState = signal(this.readIncludeDummyProducts());

  readonly includeDummyProducts = computed(() => this.includeDummyProductsState());

  setIncludeDummyProducts(enabled: boolean): void {
    this.includeDummyProductsState.set(enabled);
    this.writeIncludeDummyProducts(enabled);
  }

  private readIncludeDummyProducts(): boolean {
    if (typeof localStorage === 'undefined' || typeof localStorage.getItem !== 'function') {
      return true;
    }

    const raw = localStorage.getItem(this.config.dummyProductsEnabledStorageKey);
    if (raw === null) {
      return true;
    }

    return raw === '1' || raw === 'true';
  }

  private writeIncludeDummyProducts(enabled: boolean): void {
    if (typeof localStorage === 'undefined' || typeof localStorage.setItem !== 'function') {
      return;
    }

    localStorage.setItem(this.config.dummyProductsEnabledStorageKey, enabled ? '1' : '0');
  }
}
