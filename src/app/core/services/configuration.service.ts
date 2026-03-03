import { Injectable } from '@angular/core';

import { FoodSortBy, SortDirection } from '../models';
import { StoredUser } from '../models/auth';

@Injectable({ providedIn: 'root' })
export class ConfigurationService {
  readonly knownCuisines = [
    'American',
    'Argentinian',
    'Australian',
    'Austrian',
    'Belgian',
    'Brazilian',
    'British',
    'Canadian',
    'Chinese',
    'Croatian',
    'Czech',
    'Danish',
    'Dutch',
    'Egyptian',
    'Ethiopian',
    'Filipino',
    'French',
    'German',
    'Greek',
    'Hungarian',
    'Indian',
    'Indonesian',
    'Iranian',
    'Israeli',
    'Irish',
    'Italian',
    'Jamaican',
    'Japanese',
    'Korean',
    'Kenyan',
    'Malaysian',
    'Middle Eastern',
    'Mexican',
    'Moroccan',
    'Nepalese',
    'Nordic',
    'Pakistani',
    'Peruvian',
    'Polish',
    'Portuguese',
    'Romanian',
    'Russian',
    'Singaporean',
    'Spanish',
    'Sri Lankan',
    'Swedish',
    'Swiss',
    'Thai',
    'Tunisian',
    'Turkish',
    'Ukrainian',
    'Uruguayan',
    'Venezuelan',
    'Vietnamese'
  ] as const;

  readonly knownCategories = [
    'Beef',
    'Breakfast',
    'Chicken',
    'Dessert',
    'Dinner',
    'Dairy-Free',
    'Goat',
    'Gluten-Free',
    'Healthy',
    'High-Protein',
    'Keto',
    'Lamb',
    'Low Carb',
    'Lunch',
    'Mediterranean',
    'Miscellaneous',
    'Paleo',
    'Pasta',
    'Pork',
    'Salad',
    'Seafood',
    'Side',
    'Snack',
    'Soup',
    'Starter',
    'Vegan',
    'Vegetarian',
    'Whole30'
  ] as const;

  readonly mealDbBaseUrl = 'https://www.themealdb.com/api/json/v1/1';
  readonly mealDbCorsProxyCandidates = [
    'https://api.allorigins.win/raw?url=',
    'https://corsproxy.io/?'
  ] as const;
  readonly useMealDbCorsProxy = typeof globalThis !== 'undefined'
    && typeof globalThis.location !== 'undefined'
    && globalThis.location.hostname.endsWith('github.io');
  readonly localRecipeStorageKey = 'food-app.local-recipes';
  readonly dummyProductsEnabledStorageKey = 'food-app.dummy-products-enabled';
  readonly localRecipePlaceholderImage = 'https://placehold.co/600x400?text=Recipe+Image';
  readonly maxUploadedImageSizeBytes = 2 * 1024 * 1024;

  readonly authDbName = 'food-explorer-auth';
  readonly authDbVersion = 1;
  readonly authUsersStore = 'users';
  readonly authSessionStore = 'session';
  readonly authSessionKey = 'current';
  readonly authSessionCacheKey = 'food-explorer.current-user';
  readonly authRememberedEmailKey = 'food-explorer.remembered-email';
  readonly authUsersCacheKey = 'food-explorer.users';
  readonly authMaxEmailLength = 120;
  readonly authMinPasswordLength = 6;
  readonly authMaxPasswordLength = 120;
  readonly authPasswordAlgorithm: StoredUser['passwordVersion'] = 'pbkdf2-sha256';
  readonly authPasswordIterations = 210_000;
  readonly authMinNameLength = 2;
  readonly authMaxNameLength = 80;
  readonly authMinAge = 13;
  readonly authMaxAge = 120;
  readonly authDefaultAge = 18;
  readonly authDefaultFirstName = 'User';
  readonly authDefaultLastName = '';
  readonly authDefaultPhone = '000000000';
  readonly authPhonePattern = /^[+]?[-0-9\s()]{6,}$/;
  readonly authMaxPhoneLength = 20;
  readonly authMaxAvatarSizeBytes = 2 * 1024 * 1024;
  readonly authDefaultAvatar = 'https://placehold.co/120x120?text=User';

  readonly feedbackVotesStorageKey = 'foodExplorerVotes';
  readonly feedbackTagsStorageKey = 'foodExplorerTags';
  readonly feedbackTagMinLength = 2;
  readonly feedbackTagMaxLength = 24;

  readonly recipeTitleMaxLength = 80;
  readonly recipeFacetMaxLength = 40;
  readonly recipeInstructionsMinLength = 10;
  readonly recipeInstructionsMaxLength = 5000;
  readonly recipeUrlMaxLength = 300;
  readonly recipeTagsInputMaxLength = 200;

  readonly uiSearchMinLength = 2;
  readonly uiPageSizeOptions = [12, 20, 24, 30, 36] as const;
  readonly uiSmallViewportMaxWidth = 740;
  readonly uiMediumViewportMaxWidth = 1500;
  readonly uiSmallViewportPageSize = 12;
  readonly uiMediumViewportPageSize = 24;
  readonly uiLargeViewportPageSize = 24;

  readonly defaultPageSize = 24;
  readonly minPageSize = 1;
  readonly maxPageSize = 36;
  readonly queryLimit = 60;

  readonly defaultSortBy: FoodSortBy = 'id';
  readonly defaultSortDirection: SortDirection = 'desc';

  readonly searchEndpoint = '/search.php';
  readonly lookupEndpoint = '/lookup.php';
  readonly listEndpoint = '/list.php';
}
