
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { FoodStore } from './food.store';
import { FoodService } from '../services/food.service';
import { HttpCacheService } from '../http/http-cache.service';
import { ConfigurationService } from '../services/configuration.service';
import { PaginationService } from '../services/pagination.service';
import { LocalRecipeService } from '../services/local-recipe.service';
import { of } from 'rxjs';

describe('FoodStore', () => {
  let store: FoodStore;
  let api: any;
  let cache: any;
  let config: any;
  let pagination: any;
  let localRecipes: any;

  beforeEach(() => {
    api = { getFacets: vi.fn(() => of({ cuisines: ['Polish'], categories: ['Soup'] })), search: vi.fn(() => of({ items: [], categoryCounts: [], tagCounts: [], hasOwnRecipes: false, totalResults: 0, pageIndex: 0, pageSize: 10 })) };
    cache = { clearByPrefix: vi.fn() };
    config = { defaultSortBy: 'id', defaultSortDirection: 'asc', searchEndpoint: '/search', lookupEndpoint: '/lookup' };
    pagination = { getDefaultPageSize: () => 10, getPageSizeOptions: () => [10, 20], getMinPageSize: () => 1, getMaxPageSize: () => 20 };
    localRecipes = { canCurrentUserDelete: vi.fn(() => true), delete: vi.fn(), clearDeletedForCurrentUser: vi.fn(), clearForCurrentUser: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        FoodStore,
        { provide: FoodService, useValue: api },
        { provide: HttpCacheService, useValue: cache },
        { provide: ConfigurationService, useValue: config },
        { provide: PaginationService, useValue: pagination },
        { provide: LocalRecipeService, useValue: localRecipes },
      ]
    });
    store = TestBed.inject(FoodStore);
  });

  it('should initialize with default state', () => {
    expect(store.query()).toBe('');
    expect(store.pageSize()).toBe(10);
    expect(store.sortBy()).toBe('id');
    expect(store.sortDirection()).toBe('asc');
  });

  it('should update query and reset pageIndex', () => {
    store.setQuery('test');
    expect(store.query()).toBe('test');
    expect(store.pageIndex()).toBe(0);
  });

  it('should update cuisine and reset pageIndex', () => {
    store.setCuisine('Polish');
    expect(store.cuisine()).toBe('Polish');
    expect(store.pageIndex()).toBe(0);
  });

  it('should update category and reset pageIndex', () => {
    store.setCategory('Soup');
    expect(store.category()).toBe('Soup');
    expect(store.pageIndex()).toBe(0);
  });

  it('should update tag and reset pageIndex', () => {
    store.setTag('vegan');
    expect(store.tag()).toBe('vegan');
    expect(store.pageIndex()).toBe(0);
  });

  it('should update mineOnly and reset pageIndex', () => {
    store.setMineOnly(true);
    expect(store.mineOnly()).toBe(true);
    expect(store.pageIndex()).toBe(0);
  });

  it('should update sort and reset pageIndex', () => {
    store.setSort('name', 'desc');
    expect(store.sortBy()).toBe('name');
    expect(store.sortDirection()).toBe('desc');
    expect(store.pageIndex()).toBe(0);
  });

  it('should update pageIndex and pageSize', () => {
    store.setPage(2, 10);
    expect(store.pageIndex()).toBe(2);
    store.setPage(0, 20);
    expect(store.pageIndex()).toBe(0);
    expect(store.pageSize()).toBe(20);
  });

  it('should call localRecipes.delete on deleteRecipe', () => {
    store.deleteRecipe(123);
    expect(localRecipes.delete).toHaveBeenCalledWith(123);
  });

  it('should call localRecipes.clearDeletedForCurrentUser and cache.clearByPrefix on reset', () => {
    store.reset();
    expect(localRecipes.clearDeletedForCurrentUser).toHaveBeenCalled();
    expect(cache.clearByPrefix).toHaveBeenCalledWith('/search');
    expect(cache.clearByPrefix).toHaveBeenCalledWith('/lookup');
  });

  it('should call localRecipes.clearDeletedForCurrentUser and clearForCurrentUser on deleteAllAndReloadForCurrentUser', () => {
    store.deleteAllAndReloadForCurrentUser();
    expect(localRecipes.clearDeletedForCurrentUser).toHaveBeenCalled();
    expect(localRecipes.clearForCurrentUser).toHaveBeenCalledWith([]);
    expect(cache.clearByPrefix).toHaveBeenCalledWith('/search');
    expect(cache.clearByPrefix).toHaveBeenCalledWith('/lookup');
  });

  it('should return true for canDeleteRecipe and canEditRecipe if allowed', () => {
    localRecipes.canCurrentUserDelete.mockReturnValue(true);
    expect(store.canDeleteRecipe(1)).toBe(true);
    expect(store.canEditRecipe(1)).toBe(true);
  });

  it('should return false for canDeleteRecipe and canEditRecipe if not allowed', () => {
    localRecipes.canCurrentUserDelete.mockReturnValue(false);
    expect(store.canDeleteRecipe(1)).toBe(false);
    expect(store.canEditRecipe(1)).toBe(false);
  });
});
