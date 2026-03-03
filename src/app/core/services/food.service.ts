import { inject, Injectable } from '@angular/core';
import { forkJoin, map, Observable, of, switchMap } from 'rxjs';

import { AuthUser, Food, FoodCategoryCount, FoodDetail, FoodFacets, FoodPage, FoodQuery, FoodSortBy, FoodTagCount, SortDirection } from '../models';
import { AppPreferencesService } from './app-preferences.service';
import { AuthService } from './auth.service';
import { ConfigurationService } from './configuration.service';
import { FoodDummyDataService } from './food-dummy-data.service';
import { FoodRemoteApiService } from './food-remote-api.service';
import { LocalRecipeService } from './local-recipe.service';
import { RecipeFeedbackService } from './recipe-feedback.service';

const ALLOWED_SORTS: readonly FoodSortBy[] = ['name', 'id', 'tags', 'votes'];
const ALLOWED_DIRECTIONS: readonly SortDirection[] = ['asc', 'desc'];
const API_AUTHOR = 'TheMealDB';

@Injectable({ providedIn: 'root' })
export class FoodService {
  private readonly config = inject(ConfigurationService);
  private readonly auth = inject(AuthService);
  private readonly localRecipes = inject(LocalRecipeService);
  private readonly feedback = inject(RecipeFeedbackService);
  private readonly preferences = inject(AppPreferencesService);
  private readonly remoteApi = inject(FoodRemoteApiService);
  private readonly dummyData = inject(FoodDummyDataService);

  getFacets(): Observable<FoodFacets> {
    const remoteFacets$ = this.remoteApi.getFacets();
    const dummyFacets$ = this.preferences.includeDummyProducts()
      ? this.dummyData.getFacets()
      : of({ cuisines: [], categories: [] });

    return forkJoin({ remoteFacets: remoteFacets$, dummyFacets: dummyFacets$ }).pipe(
      map(({ remoteFacets, dummyFacets }) => {
        const localFacets = this.localRecipes.getFacetValues();

        return {
          cuisines: uniqueSortedValues([...remoteFacets.cuisines, ...localFacets.cuisines, ...dummyFacets.cuisines]),
          categories: uniqueSortedValues([...remoteFacets.categories, ...localFacets.categories, ...dummyFacets.categories])
        };
      })
    );
  }

  getMealDetails(id: number): Observable<FoodDetail | null> {
    const snapshot = this.localRecipes.getSnapshot();

    if (snapshot.deletedIds.includes(id)) {
      return of(null);
    }

    const localCustom = snapshot.custom.find((item) => item.id === id);
    if (localCustom) {
      return of(localCustom);
    }

    const localOverride = snapshot.overrides.find((item) => item.id === id);

    if (!this.preferences.includeDummyProducts()) {
      return this.remoteApi.getMealDetails(id).pipe(
        map((apiDetail) => {
          if (!apiDetail) {
            return localOverride ?? null;
          }

          return localOverride ? this.mergeDetail(apiDetail, localOverride) : apiDetail;
        })
      );
    }

    return this.dummyData.getDetails().pipe(
      switchMap((dummyDetails) => {
        const dummyDetail = dummyDetails.get(id);

        if (dummyDetail) {
          return of(localOverride ? this.mergeDetail(dummyDetail, localOverride) : dummyDetail);
        }

        return this.remoteApi.getMealDetails(id).pipe(
          map((apiDetail) => {
            if (!apiDetail) {
              return localOverride ?? null;
            }

            return localOverride ? this.mergeDetail(apiDetail, localOverride) : apiDetail;
          })
        );
      })
    );
  }

  search(query: FoodQuery): Observable<FoodPage> {
    const pageSize = clamp(query.pageSize, this.config.minPageSize, this.config.maxPageSize);
    const pageIndex = Math.max(query.pageIndex, 0);
    const sortBy = ALLOWED_SORTS.includes(query.sortBy) ? query.sortBy : this.config.defaultSortBy;
    const sortDirection = ALLOWED_DIRECTIONS.includes(query.sortDirection)
      ? query.sortDirection
      : this.config.defaultSortDirection;
    const searchText = this.normalizeText(query.query) ?? '';
    const cuisine = this.normalizeText(query.cuisine);
    const category = this.normalizeText(query.category);
    const tag = this.normalizeText(query.tag);
    const mineOnly = query.mineOnly;
    const currentUser = this.auth.currentUser();

    return this.remoteApi.searchMeals(searchText)
      .pipe(
        switchMap((apiItems) => {
          if (!this.preferences.includeDummyProducts()) {
            return of(this.applyLocalMutations(apiItems));
          }

          return this.dummyData.getFoods().pipe(
            map((dummyFoods) => this.applyLocalMutations([...apiItems, ...dummyFoods]))
          );
        }),
        map((items) => items.map((item) => ({
          ...item,
          tags: this.feedback.getTags(item)
        }))),
        map((items) => {
          const itemsWithoutMineFilter = filterFoods(items, searchText, cuisine, category, tag, false, currentUser);
          const filteredItems = mineOnly
            ? itemsWithoutMineFilter.filter((item) => isOwnedByCurrentUser(item, currentUser))
            : itemsWithoutMineFilter;

          return {
            allItems: filteredItems,
            categoryCounts: buildCategoryCounts(filteredItems),
            tagCounts: buildTagCounts(filteredItems),
            hasOwnRecipes: itemsWithoutMineFilter.some((item) => isOwnedByCurrentUser(item, currentUser))
          };
        }),
        map(({ allItems, categoryCounts, tagCounts, hasOwnRecipes }) => ({
          sortedItems: sortFoods(allItems, sortBy, sortDirection, (mealId) => this.feedback.getScore(mealId)),
          categoryCounts,
          tagCounts,
          hasOwnRecipes
        })),
        map(({ sortedItems, categoryCounts, tagCounts, hasOwnRecipes }) => {
          const pagination = paginate(sortedItems, pageIndex, pageSize);

          return {
            items: pagination.items,
            totalResults: sortedItems.length,
            pageIndex: pagination.pageIndex,
            pageSize,
            categoryCounts,
            tagCounts,
            hasOwnRecipes
          };
        })
      );
  }

  private applyLocalMutations(apiItems: Food[]): Food[] {
    const snapshot = this.localRecipes.getSnapshot();
    const deletedIds = new Set(snapshot.deletedIds);
    const customItems = snapshot.custom.map((item) => this.toFoodFromDetail(item));
    const overrideFoods = snapshot.overrides.map((item) => this.toFoodFromDetail(item));

    const byId = new Map<number, Food>();

    for (const item of apiItems) {
      if (!deletedIds.has(item.id)) {
        byId.set(item.id, item);
      }
    }

    for (const override of overrideFoods) {
      if (deletedIds.has(override.id)) {
        continue;
      }

      const base = byId.get(override.id);
      byId.set(override.id, base ? this.mergeFood(base, override) : override);
    }

    for (const custom of customItems) {
      byId.set(custom.id, custom);
    }

    return [...byId.values()];
  }

  private toFoodFromDetail(item: FoodDetail): Food {
    return {
      id: item.id,
      title: item.title,
      image: item.image,
      imageType: getImageType(item.image),
      sourceUrl: item.sourceUrl,
      cuisine: item.cuisine,
      category: item.category,
      tags: item.tags,
      author: item.author,
      createdAt: item.createdAt
    };
  }

  private mergeFood(base: Food, override: Food): Food {
    return {
      ...base,
      title: override.title,
      image: override.image,
      imageType: override.imageType,
      sourceUrl: override.sourceUrl,
      cuisine: override.cuisine,
      category: override.category,
      tags: override.tags,
      author: override.author,
      createdAt: override.createdAt
    };
  }

  private mergeDetail(base: FoodDetail, override: FoodDetail): FoodDetail {
    return {
      ...base,
      title: override.title,
      image: override.image,
      category: override.category,
      cuisine: override.cuisine,
      instructions: override.instructions,
      sourceUrl: override.sourceUrl,
      youtubeUrl: override.youtubeUrl,
      tags: override.tags,
      author: override.author,
      createdAt: override.createdAt
    };
  }

  private normalizeText(value: string): string | undefined {
    const normalized = value.trim().slice(0, this.config.queryLimit);
    return normalized.length > 0 ? normalized : undefined;
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function filterFoods(
  items: Food[],
  query?: string,
  cuisine?: string,
  category?: string,
  tag?: string,
  mineOnly?: boolean,
  currentUser?: AuthUser | null
): Food[] {
  return items.filter((item) => {
    const matchesQuery = !query || item.title.toLowerCase().includes(query.toLowerCase());
    const matchesCuisine = !cuisine || item.cuisine.toLowerCase() === cuisine.toLowerCase();
    const matchesCategory = !category || item.category.toLowerCase() === category.toLowerCase();
    const matchesTag = !tag || (item.tags ?? []).some((value) => value.toLowerCase() === tag.toLowerCase());
    const matchesMine = !mineOnly || isOwnedByCurrentUser(item, currentUser);
    return matchesQuery && matchesCuisine && matchesCategory && matchesTag && matchesMine;
  });
}

function isOwnedByCurrentUser(item: Food, currentUser?: AuthUser | null): boolean {
  if (!currentUser) {
    return false;
  }

  if (item.ownerId === currentUser.id) {
    return true;
  }

  if (item.ownerId !== undefined || item.author === API_AUTHOR) {
    return false;
  }

  const fullName = `${currentUser.firstName} ${currentUser.lastName}`.trim().toLowerCase();
  const normalizedAuthor = item.author.trim().toLowerCase();
  const normalizedEmail = currentUser.email.trim().toLowerCase();

  return normalizedAuthor.length > 0 && (normalizedAuthor === fullName || normalizedAuthor === normalizedEmail);
}

function sortFoods(
  items: Food[],
  sortBy: FoodSortBy,
  direction: SortDirection,
  getVoteScore: (mealId: number) => number
): Food[] {
  const factor = direction === 'asc' ? 1 : -1;
  const sorted = [...items];

  sorted.sort((a, b) => {
    if (sortBy === 'id') {
      return (a.id - b.id) * factor;
    }

    if (sortBy === 'votes') {
      const scoreDelta = getVoteScore(a.id) - getVoteScore(b.id);
      if (scoreDelta !== 0) {
        return scoreDelta * factor;
      }

      return a.title.localeCompare(b.title);
    }

    if (sortBy === 'tags') {
      return tagsSortKey(a).localeCompare(tagsSortKey(b)) * factor;
    }

    return a.title.localeCompare(b.title) * factor;
  });

  return sorted;
}

function paginate(items: Food[], pageIndex: number, pageSize: number): { items: Food[]; pageIndex: number } {
  if (items.length === 0) {
    return { items: [], pageIndex: 0 };
  }

  const maxPageIndex = Math.max(Math.ceil(items.length / pageSize) - 1, 0);
  const normalizedPageIndex = Math.min(pageIndex, maxPageIndex);

  const from = normalizedPageIndex * pageSize;
  const to = from + pageSize;
  return {
    items: items.slice(from, to),
    pageIndex: normalizedPageIndex
  };
}

function tagsSortKey(item: Food): string {
  const normalizedTags = [...(item.tags ?? [])]
    .map((tag) => tag.trim().toLowerCase())
    .filter((tag) => tag.length > 0)
    .sort((a, b) => a.localeCompare(b));

  return normalizedTags.join('|');
}

function getImageType(imageUrl: string): string {
  const extension = imageUrl.split('.').pop();
  return extension ? extension.toLowerCase() : 'jpg';
}

function buildCategoryCounts(items: Food[]): FoodCategoryCount[] {
  const counter = new Map<string, number>();

  for (const item of items) {
    const key = item.category || 'Uncategorized';
    counter.set(key, (counter.get(key) ?? 0) + 1);
  }

  return [...counter.entries()]
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => a.category.localeCompare(b.category));
}

function buildTagCounts(items: Food[]): FoodTagCount[] {
  const counter = new Map<string, number>();

  for (const item of items) {
    const uniqueTags = new Set((item.tags ?? []).map((value) => value.trim()).filter((value) => value.length > 0));

    for (const tag of uniqueTags) {
      counter.set(tag, (counter.get(tag) ?? 0) + 1);
    }
  }

  return [...counter.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => a.tag.localeCompare(b.tag));
}

function uniqueSortedValues(items: string[]): string[] {
  const values = items
    .map((value) => value.trim())
    .filter((value) => value.length > 0);

  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}
