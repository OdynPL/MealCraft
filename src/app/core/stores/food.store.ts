import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { catchError, debounceTime, distinctUntilChanged, of, switchMap, tap } from 'rxjs';

import { HttpCacheService } from '../http/http-cache.service';
import { FoodPage, FoodQuery, FoodSortBy, SortDirection } from '../models';
import { FoodApiService } from '../services/food-api.service';
import { ConfigurationService } from '../services/configuration.service';
import { LocalRecipeService } from '../services/local-recipe.service';
import { FoodState } from './models/food-state';

@Injectable({ providedIn: 'root' })
export class FoodStore {
  private readonly api = inject(FoodApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cache = inject(HttpCacheService);
  private readonly config = inject(ConfigurationService);
  private readonly localRecipes = inject(LocalRecipeService);

  private readonly initialState: FoodState = {
    query: '',
    cuisine: '',
    category: '',
    tag: '',
    mineOnly: false,
    cuisines: [],
    categories: [],
    sortBy: this.config.defaultSortBy,
    sortDirection: this.config.defaultSortDirection,
    pageIndex: 0,
    pageSize: this.config.defaultPageSize,
    refreshTick: 0,
    items: [],
    categoryCounts: [],
    tagCounts: [],
    hasOwnRecipes: false,
    totalResults: 0,
    loading: false,
    error: null
  };

  private readonly state = signal<FoodState>(this.initialState);

  readonly query = computed(() => this.state().query);
  readonly cuisine = computed(() => this.state().cuisine);
  readonly category = computed(() => this.state().category);
  readonly tag = computed(() => this.state().tag);
  readonly mineOnly = computed(() => this.state().mineOnly);
  readonly cuisines = computed(() => this.state().cuisines);
  readonly categories = computed(() => this.state().categories);
  readonly sortBy = computed(() => this.state().sortBy);
  readonly sortDirection = computed(() => this.state().sortDirection);
  readonly pageIndex = computed(() => this.state().pageIndex);
  readonly pageSize = computed(() => this.state().pageSize);
  readonly refreshTick = computed(() => this.state().refreshTick);
  readonly items = computed(() => this.state().items);
  readonly categoryCounts = computed(() => this.state().categoryCounts);
  readonly tagCounts = computed(() => this.state().tagCounts);
  readonly hasOwnRecipes = computed(() => this.state().hasOwnRecipes);
  readonly totalResults = computed(() => this.state().totalResults);
  readonly loading = computed(() => this.state().loading);
  readonly error = computed(() => this.state().error);

  private readonly request = computed<FoodQuery>(() => ({
    query: this.state().query,
    cuisine: this.state().cuisine,
    category: this.state().category,
    tag: this.state().tag,
    mineOnly: this.state().mineOnly,
    sortBy: this.state().sortBy,
    sortDirection: this.state().sortDirection,
    pageIndex: this.state().pageIndex,
    pageSize: this.state().pageSize,
    refreshTick: this.state().refreshTick
  }));

  constructor() {
    this.loadFacets();

    toObservable(this.request)
      .pipe(
        debounceTime(250),
        distinctUntilChanged(sameQuery),
        tap(() => this.patch({ loading: true, error: null })),
        switchMap((query) =>
          this.api.search(query).pipe(
            catchError((error: unknown) => {
              this.patch({
                loading: false,
                error: mapApiError(error),
                items: [],
                categoryCounts: [],
                tagCounts: [],
                hasOwnRecipes: false,
                totalResults: 0
              });
              return of(emptyPage(query.pageIndex, query.pageSize));
            })
          )
        ),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((page) => {
        this.patch({
          items: page.items,
          categoryCounts: page.categoryCounts,
          tagCounts: page.tagCounts,
          hasOwnRecipes: page.hasOwnRecipes,
          totalResults: page.totalResults,
          pageIndex: page.pageIndex,
          pageSize: page.pageSize,
          loading: false
        });
      });
  }

  private loadFacets(): void {
    this.api.getFacets()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(({ cuisines, categories }) => {
        this.patch({ cuisines, categories });
      });
  }

  setQuery(query: string): void {
    this.patch({ query: query.trim(), pageIndex: 0 });
  }

  setCuisine(cuisine: string): void {
    this.patch({ cuisine, pageIndex: 0 });
  }

  setCategory(category: string): void {
    this.patch({ category, pageIndex: 0 });
  }

  setTag(tag: string): void {
    this.patch({ tag, pageIndex: 0 });
  }

  setMineOnly(mineOnly: boolean): void {
    this.patch({ mineOnly, pageIndex: 0 });
  }

  setSort(sortBy: FoodSortBy, sortDirection: SortDirection): void {
    this.patch({ sortBy, sortDirection, pageIndex: 0 });
  }

  setPage(pageIndex: number, pageSize: number): void {
    if (pageSize !== this.state().pageSize) {
      this.patch({ pageSize, pageIndex: 0 });
      return;
    }

    this.patch({ pageIndex });
  }

  canDeleteRecipe(id: number): boolean {
    return this.localRecipes.canCurrentUserDelete(id);
  }

  canEditRecipe(id: number): boolean {
    return this.localRecipes.canCurrentUserDelete(id);
  }

  refresh(): void {
    this.reset();
  }

  deleteAllAndReloadForCurrentUser(): void {
    this.localRecipes.clearDeletedForCurrentUser();
    this.localRecipes.clearForCurrentUser([]);
    this.cache.clearByPrefix(this.config.searchEndpoint);
    this.cache.clearByPrefix(this.config.lookupEndpoint);

    const current = this.state();
    this.state.set({
      ...this.initialState,
      cuisines: current.cuisines,
      categories: current.categories,
      loading: true,
      refreshTick: current.refreshTick + 1
    });

    this.loadFacets();
  }

  deleteRecipe(id: number): void {
    if (!this.canDeleteRecipe(id)) {
      return;
    }

    this.localRecipes.delete(id);
    this.cache.clearByPrefix(this.config.searchEndpoint);
    this.cache.clearByPrefix(this.config.lookupEndpoint);

    this.state.update((current) => ({
      ...current,
      refreshTick: current.refreshTick + 1,
      error: null,
      loading: true
    }));

    this.loadFacets();
  }

  reset(): void {
    this.localRecipes.clearDeletedForCurrentUser();
    this.cache.clearByPrefix(this.config.searchEndpoint);
    this.cache.clearByPrefix(this.config.lookupEndpoint);

    const current = this.state();
    this.state.set({
      ...this.initialState,
      cuisines: current.cuisines,
      categories: current.categories,
      refreshTick: current.refreshTick + 1
    });

    this.loadFacets();
  }

  private patch(partial: Partial<FoodState>): void {
    this.state.update((prev) => ({ ...prev, ...partial }));
  }
}

function sameQuery(a: FoodQuery, b: FoodQuery): boolean {
  return a.query === b.query
    && a.cuisine === b.cuisine
    && a.category === b.category
    && a.tag === b.tag
    && a.mineOnly === b.mineOnly
    && a.sortBy === b.sortBy
    && a.sortDirection === b.sortDirection
    && a.pageIndex === b.pageIndex
    && a.pageSize === b.pageSize
    && a.refreshTick === b.refreshTick;
}

function emptyPage(pageIndex: number, pageSize: number): FoodPage {
  return {
    items: [],
    totalResults: 0,
    pageIndex,
    pageSize,
    categoryCounts: [],
    tagCounts: [],
    hasOwnRecipes: false
  };
}

function mapApiError(error: unknown): string {
  if (error instanceof HttpErrorResponse) {
    if (error.status === 0) {
      return 'Cannot connect to TheMealDB. Check your network or CORS policy.';
    }
  }

  return 'Failed to fetch data from TheMealDB API.';
}
