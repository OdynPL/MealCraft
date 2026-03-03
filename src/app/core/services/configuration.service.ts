import { Injectable } from '@angular/core';

import { FoodSortBy, SortDirection } from '../models';

@Injectable({ providedIn: 'root' })
export class ConfigurationService {
  readonly mealDbBaseUrl = 'https://www.themealdb.com/api/json/v1/1';
  readonly mealDbCorsProxyUrl = 'https://api.allorigins.win/raw?url=';
  readonly useMealDbCorsProxy = typeof globalThis !== 'undefined'
    && typeof globalThis.location !== 'undefined'
    && globalThis.location.hostname.endsWith('github.io');
  readonly localRecipeStorageKey = 'food-app.local-recipes';
  readonly localRecipePlaceholderImage = 'https://placehold.co/600x400?text=Recipe+Image';
  readonly maxUploadedImageSizeBytes = 2 * 1024 * 1024;

  readonly authDbName = 'food-explorer-auth';
  readonly authDbVersion = 1;
  readonly authUsersStore = 'users';
  readonly authSessionStore = 'session';
  readonly authSessionKey = 'current';
  readonly authSessionCacheKey = 'food-explorer.current-user';
  readonly authMinPasswordLength = 6;
  readonly authMinAge = 13;
  readonly authMaxAge = 120;
  readonly authMaxPhoneLength = 20;
  readonly authMaxAvatarSizeBytes = 2 * 1024 * 1024;
  readonly authDefaultAvatar = 'https://placehold.co/120x120?text=User';

  readonly defaultPageSize = 12;
  readonly minPageSize = 1;
  readonly maxPageSize = 24;
  readonly queryLimit = 60;

  readonly defaultSortBy: FoodSortBy = 'name';
  readonly defaultSortDirection: SortDirection = 'asc';

  readonly searchEndpoint = '/search.php';
  readonly lookupEndpoint = '/lookup.php';
  readonly listEndpoint = '/list.php';
}
