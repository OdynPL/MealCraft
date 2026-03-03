import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

import { HttpCacheService } from '../http/http-cache.service';
import { AdminDataResetService } from './admin-data-reset.service';
import { ConfigurationService } from './configuration.service';
import { LocalRecipeService } from './local-recipe.service';
import { RecipeFeedbackService } from './recipe-feedback.service';

class MockHttpCacheService {
  clearAll = vi.fn();
}

class MockLocalRecipeService {
  clearAll = vi.fn();
}

class MockRecipeFeedbackService {
  clearAll = vi.fn();
}

describe('AdminDataResetService', () => {
  let service: AdminDataResetService;
  let config: ConfigurationService;
  let cache: MockHttpCacheService;
  let localRecipes: MockLocalRecipeService;
  let feedback: MockRecipeFeedbackService;

  let removeItemSpy: ReturnType<typeof vi.fn>;
  let deleteDatabaseSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    removeItemSpy = vi.fn();
    deleteDatabaseSpy = vi.fn((_: string) => {
      const request: {
        onsuccess: null | (() => void);
        onerror: null | (() => void);
        onblocked: null | (() => void);
      } = {
        onsuccess: null,
        onerror: null,
        onblocked: null
      };

      queueMicrotask(() => {
        request.onsuccess?.();
      });

      return request;
    });

    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        removeItem: removeItemSpy
      }
    });

    Object.defineProperty(globalThis, 'indexedDB', {
      configurable: true,
      value: {
        deleteDatabase: deleteDatabaseSpy
      }
    });

    TestBed.configureTestingModule({
      providers: [
        AdminDataResetService,
        ConfigurationService,
        { provide: HttpCacheService, useClass: MockHttpCacheService },
        { provide: LocalRecipeService, useClass: MockLocalRecipeService },
        { provide: RecipeFeedbackService, useClass: MockRecipeFeedbackService }
      ]
    });

    service = TestBed.inject(AdminDataResetService);
    config = TestBed.inject(ConfigurationService);
    cache = TestBed.inject(HttpCacheService) as unknown as MockHttpCacheService;
    localRecipes = TestBed.inject(LocalRecipeService) as unknown as MockLocalRecipeService;
    feedback = TestBed.inject(RecipeFeedbackService) as unknown as MockRecipeFeedbackService;
  });

  it('should clear services data, remove known storage keys and delete auth indexedDB', async () => {
    await service.resetAllData();

    expect(cache.clearAll).toHaveBeenCalledTimes(1);
    expect(localRecipes.clearAll).toHaveBeenCalledTimes(1);
    expect(feedback.clearAll).toHaveBeenCalledTimes(1);

    expect(removeItemSpy).toHaveBeenCalledWith(config.localRecipeStorageKey);
    expect(removeItemSpy).toHaveBeenCalledWith(config.dummyProductsEnabledStorageKey);
    expect(removeItemSpy).toHaveBeenCalledWith(config.feedbackVotesStorageKey);
    expect(removeItemSpy).toHaveBeenCalledWith(config.feedbackTagsStorageKey);
    expect(removeItemSpy).toHaveBeenCalledWith(config.authSessionCacheKey);
    expect(removeItemSpy).toHaveBeenCalledWith(config.authUsersCacheKey);
    expect(removeItemSpy).toHaveBeenCalledWith(config.authRememberedEmailKey);

    expect(deleteDatabaseSpy).toHaveBeenCalledWith(config.authDbName);
  });

  it('should resolve without indexedDB', async () => {
    Object.defineProperty(globalThis, 'indexedDB', {
      configurable: true,
      value: undefined
    });

    await expect(service.resetAllData()).resolves.toBeUndefined();
    expect(cache.clearAll).toHaveBeenCalledTimes(1);
    expect(localRecipes.clearAll).toHaveBeenCalledTimes(1);
    expect(feedback.clearAll).toHaveBeenCalledTimes(1);
  });

  it('should resolve when indexedDB deleteDatabase is blocked', async () => {
    const blockedDeleteDatabaseSpy = vi.fn((_: string) => {
      const request: {
        onsuccess: null | (() => void);
        onerror: null | (() => void);
        onblocked: null | (() => void);
      } = {
        onsuccess: null,
        onerror: null,
        onblocked: null
      };

      queueMicrotask(() => {
        request.onblocked?.();
      });

      return request;
    });

    Object.defineProperty(globalThis, 'indexedDB', {
      configurable: true,
      value: {
        deleteDatabase: blockedDeleteDatabaseSpy
      }
    });

    await expect(service.resetAllData()).resolves.toBeUndefined();

    expect(blockedDeleteDatabaseSpy).toHaveBeenCalledWith(config.authDbName);
    expect(cache.clearAll).toHaveBeenCalledTimes(1);
    expect(localRecipes.clearAll).toHaveBeenCalledTimes(1);
    expect(feedback.clearAll).toHaveBeenCalledTimes(1);
  });

  it('should resolve when indexedDB deleteDatabase fails', async () => {
    const erroredDeleteDatabaseSpy = vi.fn((_: string) => {
      const request: {
        onsuccess: null | (() => void);
        onerror: null | (() => void);
        onblocked: null | (() => void);
      } = {
        onsuccess: null,
        onerror: null,
        onblocked: null
      };

      queueMicrotask(() => {
        request.onerror?.();
      });

      return request;
    });

    Object.defineProperty(globalThis, 'indexedDB', {
      configurable: true,
      value: {
        deleteDatabase: erroredDeleteDatabaseSpy
      }
    });

    await expect(service.resetAllData()).resolves.toBeUndefined();

    expect(erroredDeleteDatabaseSpy).toHaveBeenCalledWith(config.authDbName);
    expect(cache.clearAll).toHaveBeenCalledTimes(1);
    expect(localRecipes.clearAll).toHaveBeenCalledTimes(1);
    expect(feedback.clearAll).toHaveBeenCalledTimes(1);
  });
});
