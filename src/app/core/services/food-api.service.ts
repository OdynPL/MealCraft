import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, forkJoin, map, Observable, of, shareReplay, switchMap, throwError } from 'rxjs';

import {
  MealDbAreaResponseDto,
  MealDbCategoryResponseDto,
  MealDbDetailDto,
  MealDbDetailResponseDto,
  MealDbMealDto,
  MealDbSearchResponseDto
} from '../dto';
import { AuthUser, Food, FoodCategoryCount, FoodDetail, FoodFacets, FoodPage, FoodQuery, FoodSortBy, SortDirection } from '../models';
import { ConfigurationService } from './configuration.service';
import { AuthService } from './auth.service';
import { LocalRecipeService } from './local-recipe.service';
import { RecipeFeedbackService } from './recipe-feedback.service';
import { AppPreferencesService } from './app-preferences.service';

const ALLOWED_SORTS: readonly FoodSortBy[] = ['name', 'id', 'tags', 'votes'];
const ALLOWED_DIRECTIONS: readonly SortDirection[] = ['asc', 'desc'];
const API_AUTHOR = 'TheMealDB';
const DUMMY_AUTHOR = 'MealCraft Examples';
const DUMMY_BASE_ID = 900_000;

@Injectable({ providedIn: 'root' })
export class FoodApiService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(ConfigurationService);
  private readonly auth = inject(AuthService);
  private readonly localRecipes = inject(LocalRecipeService);
  private readonly feedback = inject(RecipeFeedbackService);
  private readonly preferences = inject(AppPreferencesService);
  private exampleRecipes$: Observable<readonly ExampleRecipeSeed[]> | null = null;
  private dummyFoods$: Observable<readonly Food[]> | null = null;
  private dummyDetails$: Observable<Map<number, FoodDetail>> | null = null;

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

    const dummyFacets$ = this.preferences.includeDummyProducts()
      ? this.getDummyFacets()
      : of({ cuisines: [], categories: [] });

    return forkJoin({ cuisines: cuisines$, categories: categories$, dummyFacets: dummyFacets$ }).pipe(
      map(({ cuisines, categories, dummyFacets }) => {
        const localFacets = this.localRecipes.getFacetValues();

        return {
          cuisines: uniqueSortedValues([...cuisines, ...localFacets.cuisines, ...dummyFacets.cuisines]),
          categories: uniqueSortedValues([...categories, ...localFacets.categories, ...dummyFacets.categories])
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

    return this.getDummyDetails().pipe(
      switchMap((dummyDetails) => {
        const dummyDetail = dummyDetails.get(id);

        if (dummyDetail) {
          return of(localOverride ? this.mergeDetail(dummyDetail, localOverride) : dummyDetail);
        }

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
    const mineOnly = query.mineOnly;
    const currentUser = this.auth.currentUser();

    return this.mealDbGet<MealDbSearchResponseDto>(
      this.config.searchEndpoint,
      new HttpParams().set('s', searchText)
    )
      .pipe(
        catchError(() => of({ meals: [] } as MealDbSearchResponseDto)),
        map((res) => res.meals ?? []),
        map((meals) => meals.map((item) => this.toFood(item))),
        switchMap((apiItems) => {
          if (!this.preferences.includeDummyProducts()) {
            return of(this.applyLocalMutations(apiItems));
          }

          return this.getDummyFoods().pipe(
            map((dummyFoods) => this.applyLocalMutations([...apiItems, ...dummyFoods]))
          );
        }),
        map((items) => filterFoods(items, searchText, cuisine, category, mineOnly, currentUser)),
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
    const proxiedUrls = this.config.mealDbCorsProxyCandidates
      .map((proxyBaseUrl) => `${proxyBaseUrl}${encodeURIComponent(urlWithQuery)}`);

    return this.requestWithProxyFallback<T>(proxiedUrls, 0);
  }

  private requestWithProxyFallback<T>(proxyUrls: readonly string[], index: number): Observable<T> {
    if (index >= proxyUrls.length) {
      return throwError(() => new Error('MealDB proxy unavailable.'));
    }

    return this.http.get<T>(proxyUrls[index]).pipe(
      catchError(() => this.requestWithProxyFallback<T>(proxyUrls, index + 1))
    );
  }

  private getExampleRecipes(): Observable<readonly ExampleRecipeSeed[]> {
    if (!this.exampleRecipes$) {
      this.exampleRecipes$ = this.http.get<unknown>('data/example-recipes.json').pipe(
        map((source) => normalizeExampleRecipeSource(source)),
        catchError(() => of([] as ExampleRecipeSeed[])),
        shareReplay(1)
      );
    }

    return this.exampleRecipes$;
  }

  private getDummyFoods(): Observable<readonly Food[]> {
    if (!this.dummyFoods$) {
      this.dummyFoods$ = this.getExampleRecipes().pipe(
        map((recipes) => buildDummyFoods(recipes)),
        shareReplay(1)
      );
    }

    return this.dummyFoods$;
  }

  private getDummyDetails(): Observable<Map<number, FoodDetail>> {
    if (!this.dummyDetails$) {
      this.dummyDetails$ = this.getExampleRecipes().pipe(
        map((recipes) => buildDummyDetails(recipes)),
        shareReplay(1)
      );
    }

    return this.dummyDetails$;
  }

  private getDummyFacets(): Observable<{ cuisines: string[]; categories: string[] }> {
    return this.getDummyFoods().pipe(map((foods) => getDummyFacets(foods)));
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

function filterFoods(
  items: Food[],
  query?: string,
  cuisine?: string,
  category?: string,
  mineOnly?: boolean,
  currentUser?: AuthUser | null
): Food[] {
  return items.filter((item) => {
    const matchesQuery = !query || item.title.toLowerCase().includes(query.toLowerCase());
    const matchesCuisine = !cuisine || item.cuisine.toLowerCase() === cuisine.toLowerCase();
    const matchesCategory = !category || item.category.toLowerCase() === category.toLowerCase();
    const matchesMine = !mineOnly || isOwnedByCurrentUser(item, currentUser);
    return matchesQuery && matchesCuisine && matchesCategory && matchesMine;
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

interface ExampleRecipeSeed {
  title: string;
  image: string;
  cuisine: string;
  category: string;
  tags: string[];
  instructions: string;
}

function normalizeExampleRecipeSource(source: unknown): ExampleRecipeSeed[] {
  if (!Array.isArray(source)) {
    return [];
  }

  return source.map((item, index) => {
    const candidate = (item && typeof item === 'object') ? item as Record<string, unknown> : {};

    const title = normalizeString(candidate['title']) || `Example recipe ${index + 1}`;
    const cuisine = normalizeString(candidate['cuisine']) || 'International';
    const category = normalizeString(candidate['category']) || 'Miscellaneous';
    const image = normalizeString(candidate['image']) || buildThematicImageUrl(title, cuisine, category, index + 1);
    const instructions = normalizeString(candidate['instructions'])
      || `Servings: 4 · Prep: 15 min · Cook: 25 min\nIngredients: 600 g main ingredient, aromatics, seasoning, and base sauce.\n1) Prep ingredients.\n2) Cook with your preferred technique.\n3) Simmer until tender.\n4) Serve hot.`;
    const tags = Array.isArray(candidate['tags'])
      ? candidate['tags'].map((value) => normalizeString(value)).filter((value): value is string => !!value)
      : [];

    return {
      title,
      image,
      cuisine,
      category,
      tags,
      instructions
    };
  });
}

function normalizeString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function buildThematicImageUrl(title: string, cuisine: string, category: string, seed: number): string {
  const search = encodeURIComponent(`${category} ${cuisine} ${title} food`);
  return `https://source.unsplash.com/640x420/?${search}&sig=${seed}`;
}

function buildDummyFoods(recipes: readonly ExampleRecipeSeed[]): Food[] {
  return recipes.map((recipe, index) => {
    const id = DUMMY_BASE_ID + index + 1;

    return {
      id,
      title: recipe.title,
      image: recipe.image,
      imageType: 'jpg',
      sourceUrl: undefined,
      cuisine: recipe.cuisine,
      category: recipe.category,
      tags: [...new Set(['example', ...recipe.tags, recipe.cuisine, recipe.category])],
      author: DUMMY_AUTHOR,
      createdAt: new Date(0).toISOString()
    };
  });
}

function buildDummyDetails(recipes: readonly ExampleRecipeSeed[]): Map<number, FoodDetail> {
  return new Map<number, FoodDetail>(
    recipes.map((recipe, index) => {
      const id = DUMMY_BASE_ID + index + 1;

      return [
        id,
        {
          id,
          title: recipe.title,
          image: recipe.image,
          category: recipe.category,
          cuisine: recipe.cuisine,
          instructions: recipe.instructions,
          sourceUrl: undefined,
          youtubeUrl: undefined,
          tags: [...new Set(['example', ...recipe.tags, recipe.cuisine, recipe.category])],
          author: DUMMY_AUTHOR,
          createdAt: new Date(0).toISOString()
        }
      ];
    })
  );
}

function getDummyFacets(foods: readonly Food[]): { cuisines: string[]; categories: string[] } {
  return {
    cuisines: uniqueSortedValues(foods.map((item) => item.cuisine)),
    categories: uniqueSortedValues(foods.map((item) => item.category))
  };
}



