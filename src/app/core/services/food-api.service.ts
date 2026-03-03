import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, forkJoin, map, Observable, of } from 'rxjs';

import {
  MealDbAreaResponseDto,
  MealDbCategoryResponseDto,
  MealDbDetailDto,
  MealDbDetailResponseDto,
  MealDbMealDto,
  MealDbSearchResponseDto
} from '../dto';
import { Food, FoodCategoryCount, FoodDetail, FoodFacets, FoodPage, FoodQuery, FoodSortBy, SortDirection } from '../models';
import { ConfigurationService } from './configuration.service';
import { LocalRecipeService } from './local-recipe.service';
import { RecipeFeedbackService } from './recipe-feedback.service';

const ALLOWED_SORTS: readonly FoodSortBy[] = ['name', 'id', 'tags', 'votes'];
const ALLOWED_DIRECTIONS: readonly SortDirection[] = ['asc', 'desc'];
const API_AUTHOR = 'TheMealDB';

@Injectable({ providedIn: 'root' })
export class FoodApiService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(ConfigurationService);
  private readonly localRecipes = inject(LocalRecipeService);
  private readonly feedback = inject(RecipeFeedbackService);

  getFacets(): Observable<FoodFacets> {
    const cuisines$ = this.mealDbGet<MealDbAreaResponseDto>(
      this.config.listEndpoint,
      new HttpParams().set('a', 'list')
    ).pipe(
      map((res) => (res.meals ?? []).map((item) => item.strArea).filter(Boolean)),
      map((items) => items.sort((a, b) => a.localeCompare(b))),
      catchError(() => of([]))
    );

    const categories$ = this.mealDbGet<MealDbCategoryResponseDto>(
      this.config.listEndpoint,
      new HttpParams().set('c', 'list')
    ).pipe(
      map((res) => (res.meals ?? []).map((item) => item.strCategory).filter(Boolean)),
      map((items) => items.sort((a, b) => a.localeCompare(b))),
      catchError(() => of([]))
    );

    return forkJoin({ cuisines: cuisines$, categories: categories$ }).pipe(
      map(({ cuisines, categories }) => {
        const localFacets = this.localRecipes.getFacetValues();

        return {
          cuisines: uniqueSortedValues([...cuisines, ...localFacets.cuisines]),
          categories: uniqueSortedValues([...categories, ...localFacets.categories])
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

    return this.mealDbGet<MealDbDetailResponseDto>(
      this.config.lookupEndpoint,
      new HttpParams().set('i', String(id))
    )
      .pipe(map((res) => {
        const meal = res.meals?.[0];
        if (!meal) {
          return localOverride ?? null;
        }

        const apiDetail = this.toFoodDetail(meal);
        return localOverride ? this.mergeDetail(apiDetail, localOverride) : apiDetail;
      }));
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

    return this.mealDbGet<MealDbSearchResponseDto>(
      this.config.searchEndpoint,
      new HttpParams().set('s', searchText)
    )
      .pipe(
        map((res) => res.meals ?? []),
        map((meals) => meals.map((item) => this.toFood(item))),
        map((apiItems) => this.applyLocalMutations(apiItems)),
        map((items) => filterFoods(items, searchText, cuisine, category)),
        map((items) => ({
          allItems: items,
          categoryCounts: buildCategoryCounts(items)
        })),
        map(({ allItems, categoryCounts }) => ({
          sortedItems: sortFoods(allItems, sortBy, sortDirection, (mealId) => this.feedback.getScore(mealId)),
          categoryCounts
        })),
        map(({ sortedItems, categoryCounts }) => {
          const pagination = paginate(sortedItems, pageIndex, pageSize);

          return {
            items: pagination.items,
            totalResults: sortedItems.length,
            pageIndex: pagination.pageIndex,
            pageSize,
            categoryCounts
          };
        })
      );
  }

  private toFood(item: MealDbMealDto): Food {
    const baseTags = buildTags(item.strArea ?? '', item.strCategory ?? '');

    return {
      id: Number(item.idMeal),
      title: item.strMeal,
      image: item.strMealThumb,
      imageType: getImageType(item.strMealThumb),
      sourceUrl: item.strSource ?? undefined,
      cuisine: item.strArea ?? '',
      category: item.strCategory ?? '',
      tags: baseTags,
      author: API_AUTHOR,
      createdAt: new Date(0).toISOString()
    };
  }

  private toFoodDetail(item: MealDbDetailDto): FoodDetail {
    const tags = [
      ...(item.strTags ? item.strTags.split(',').map((value) => value.trim()).filter(Boolean) : []),
      ...buildTags(item.strArea ?? '', item.strCategory ?? '')
    ];

    return {
      id: Number(item.idMeal),
      title: item.strMeal,
      image: item.strMealThumb,
      category: item.strCategory ?? '',
      cuisine: item.strArea ?? '',
      instructions: item.strInstructions ?? '',
      sourceUrl: item.strSource ?? undefined,
      youtubeUrl: item.strYoutube ?? undefined,
      tags: [...new Set(tags)],
      author: API_AUTHOR,
      createdAt: new Date(0).toISOString()
    };
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

  private mealDbGet<T>(endpoint: string, params?: HttpParams): Observable<T> {
    const baseUrl = `${this.config.mealDbBaseUrl}${endpoint}`;

    if (!this.config.useMealDbCorsProxy) {
      return this.http.get<T>(baseUrl, params ? { params } : undefined);
    }

    const urlWithQuery = buildUrlWithQuery(baseUrl, params);
    const proxiedUrl = `${this.config.mealDbCorsProxyUrl}${encodeURIComponent(urlWithQuery)}`;

    return this.http.get<T>(proxiedUrl);
  }
}

function buildUrlWithQuery(url: string, params?: HttpParams): string {
  if (!params) {
    return url;
  }

  const query = params.toString();
  return query ? `${url}?${query}` : url;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function filterFoods(items: Food[], query?: string, cuisine?: string, category?: string): Food[] {
  return items.filter((item) => {
    const matchesQuery = !query || item.title.toLowerCase().includes(query.toLowerCase());
    const matchesCuisine = !cuisine || item.cuisine.toLowerCase() === cuisine.toLowerCase();
    const matchesCategory = !category || item.category.toLowerCase() === category.toLowerCase();
    return matchesQuery && matchesCuisine && matchesCategory;
  });
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

function buildTags(cuisine: string, category: string): string[] {
  return [cuisine, category].filter((value) => value.trim().length > 0);
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

function uniqueSortedValues(items: string[]): string[] {
  const values = items
    .map((value) => value.trim())
    .filter((value) => value.length > 0);

  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}
