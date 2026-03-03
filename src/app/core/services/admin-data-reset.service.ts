import { Injectable, inject } from '@angular/core';

import { HttpCacheService } from '../http/http-cache.service';
import { ConfigurationService } from './configuration.service';
import { LocalRecipeService } from './local-recipe.service';
import { RecipeFeedbackService } from './recipe-feedback.service';

@Injectable({ providedIn: 'root' })
export class AdminDataResetService {
  private readonly config = inject(ConfigurationService);
  private readonly cache = inject(HttpCacheService);
  private readonly localRecipes = inject(LocalRecipeService);
  private readonly feedback = inject(RecipeFeedbackService);

  async resetAllData(): Promise<void> {
    this.cache.clearAll();
    this.localRecipes.clearAll();
    this.feedback.clearAll();

    this.clearLocalStorage();
    await this.deleteAuthIndexedDb();
  }

  private clearLocalStorage(): void {
    if (typeof localStorage === 'undefined') {
      return;
    }

    const keys = [
      this.config.localRecipeStorageKey,
      this.config.dummyProductsEnabledStorageKey,
      this.config.feedbackVotesStorageKey,
      this.config.feedbackTagsStorageKey,
      this.config.activityLogStorageKey,
      this.config.authSessionCacheKey,
      this.config.authUsersCacheKey,
      this.config.authRememberedEmailKey
    ];

    for (const key of keys) {
      localStorage.removeItem(key);
    }
  }

  private deleteAuthIndexedDb(): Promise<void> {
    if (typeof indexedDB === 'undefined') {
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      const request = indexedDB.deleteDatabase(this.config.authDbName);
      request.onsuccess = () => resolve();
      request.onerror = () => resolve();
      request.onblocked = () => resolve();
    });
  }
}
