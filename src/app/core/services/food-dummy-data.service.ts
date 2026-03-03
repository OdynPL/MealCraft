import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, map, Observable, of, shareReplay } from 'rxjs';

import { Food, FoodDetail } from '../models';

const DUMMY_AUTHOR = 'MealCraft Examples';
const DUMMY_BASE_ID = 900_000;

@Injectable({ providedIn: 'root' })
export class FoodDummyDataService {
  private readonly http = inject(HttpClient);
  private exampleRecipes$: Observable<readonly ExampleRecipeSeed[]> | null = null;
  private dummyFoods$: Observable<readonly Food[]> | null = null;
  private dummyDetails$: Observable<Map<number, FoodDetail>> | null = null;

  getFoods(): Observable<readonly Food[]> {
    if (!this.dummyFoods$) {
      this.dummyFoods$ = this.getExampleRecipes().pipe(
        map((recipes) => buildDummyFoods(recipes)),
        shareReplay(1)
      );
    }

    return this.dummyFoods$;
  }

  getDetails(): Observable<Map<number, FoodDetail>> {
    if (!this.dummyDetails$) {
      this.dummyDetails$ = this.getExampleRecipes().pipe(
        map((recipes) => buildDummyDetails(recipes)),
        shareReplay(1)
      );
    }

    return this.dummyDetails$;
  }

  getFacets(): Observable<{ cuisines: string[]; categories: string[] }> {
    return this.getFoods().pipe(map((foods) => getDummyFacets(foods)));
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

function uniqueSortedValues(items: string[]): string[] {
  const values = items
    .map((value) => value.trim())
    .filter((value) => value.length > 0);

  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}
