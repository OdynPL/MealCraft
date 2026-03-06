

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { RecipeExportService } from './recipe-export.service';
import { LocalRecipeService } from './local-recipe.service';
import { AuthService } from './auth.service';

function blobToText(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsText(blob);
  });
}

describe('RecipeExportService', () => {
  let service: RecipeExportService;
  let localRecipes: { getAllCustom: ReturnType<typeof vi.fn> };
  let auth: { currentUser: ReturnType<typeof vi.fn> };

  const user = { id: 1, name: 'Test User' };
  const recipes = [
    { id: 1, ownerId: 1, name: 'Recipe 1' },
    { id: 2, ownerId: 2, name: 'Recipe 2' },
    { id: 3, ownerId: 1, name: 'Recipe 3' }
  ];

  beforeEach(() => {
    localRecipes = { getAllCustom: vi.fn() };
    auth = { currentUser: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        RecipeExportService,
        { provide: LocalRecipeService, useValue: localRecipes },
        { provide: AuthService, useValue: auth }
      ]
    });
    service = TestBed.inject(RecipeExportService);
  });

  it('should return error if user not logged in', () => {
    auth.currentUser.mockReturnValue(null);
    const result = service.exportUserRecipes();
    expect(result.error).toContain('zalogowany');
    expect(result.count).toBe(0);
  });

  it('should return error if user has no recipes', () => {
    auth.currentUser.mockReturnValue(user);
    localRecipes.getAllCustom.mockReturnValue([]);
    const result = service.exportUserRecipes();
    expect(result.error).toContain('żadnych przepisów');
    expect(result.count).toBe(0);
  });

  it('should export only user recipes', async () => {
    auth.currentUser.mockReturnValue(user);
    localRecipes.getAllCustom.mockReturnValue(recipes);
    const result = service.exportUserRecipes();
    expect(result.error).toBeUndefined();
    expect(result.count).toBe(2);
    expect(result.filename).toBe('my-recipes.json');
    const text = await blobToText(result.blob);
    expect(text).toContain('Recipe 1');
    expect(text).toContain('Recipe 3');
    expect(text).not.toContain('Recipe 2');
  });

  it('should export a single recipe', async () => {
    const recipe = { id: 42, ownerId: 1, name: 'Single' };
    const result = service.exportSingleRecipe(recipe as any);
    expect(result.filename).toBe('recipe-42.json');
    const text = await blobToText(result.blob);
    expect(text).toContain('Single');
    expect(text).toContain('42');
  });
});
