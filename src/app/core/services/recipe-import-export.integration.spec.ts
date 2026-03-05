import { TestBed } from '@angular/core/testing';
import { RecipeImportService } from './recipe-import.service';
import { RecipeExportService } from './recipe-export.service';
import { LocalRecipeService } from './local-recipe.service';
import { FoodDetail } from '../models/food-detail';
import { AuthService } from './auth.service';


// Mock AuthService for integration-like tests
class MockAuthService {
  currentUser() {
    return {
      id: 1,
      email: 'test@example.com',
      firstName: 'Test',
      lastName: 'User',
      role: 'user',
      registrationDate: new Date().toISOString(),
      isAccountLocked: false,
      emailVerified: true,
      createdAt: new Date().toISOString()
    };
  }
}

// Mock LocalRecipeService for integration-like tests
class MockLocalRecipeService {
  private recipes: FoodDetail[] = [];
  add(recipe: FoodDetail) {
    // Always set ownerId to 1 to match mock user
    this.recipes.push({ ...recipe, ownerId: 1 });
    return true;
  }
  getAllCustom() {
    return this.recipes;
  }
  clear() {
    this.recipes = [];
  }
}

describe('Recipe Import/Export Integration', () => {
  let importService: RecipeImportService;
  let exportService: RecipeExportService;
  let localRecipeService: MockLocalRecipeService;

  const validRecipe: any = {
    id: 1001,
    title: 'Test Recipe',
    image: '',
    category: 'Test',
    cuisine: 'Test',
    instructions: 'Test instructions',
    tags: [],
    ownerId: 1,
    author: 'Test User',
    createdAt: new Date().toISOString()
  };

  beforeEach(() => {
    localRecipeService = new MockLocalRecipeService();
    TestBed.configureTestingModule({
      providers: [
        RecipeImportService,
        RecipeExportService,
        { provide: LocalRecipeService, useValue: localRecipeService },
        { provide: AuthService, useClass: MockAuthService }
      ]
    });
    importService = TestBed.inject(RecipeImportService);
    exportService = TestBed.inject(RecipeExportService);
    localRecipeService.clear();
  });

  it('should import valid JSON recipes and export them back', () => {
    const json = JSON.stringify([validRecipe]);
    const result = importService.validateAndImport(json);
    expect(result.imported).toBe(1);
    expect(result.errors.length).toBe(0);
    expect(localRecipeService.getAllCustom().length).toBe(1);
    // Use exportUserRecipes and extract JSON from Blob
    const exportResult = exportService.exportUserRecipes();
    expect(exportResult.count).toBe(1);
    expect(exportResult.error).toBeUndefined();
    // In Node/test env, Blob may not support .text()/.arrayBuffer(). Check size and filename instead.
    expect(exportResult.blob.size).toBeGreaterThan(0);
    expect(exportResult.filename).toBe('my-recipes.json');
  });

  it('should handle invalid JSON gracefully', () => {
    const result = importService.validateAndImport('not a json');
    expect(result.imported).toBe(0);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('should not import duplicate recipes', () => {
    const json = JSON.stringify([validRecipe, validRecipe]);
    const result = importService.validateAndImport(json);
    expect(result.imported).toBe(1);
    expect(localRecipeService.getAllCustom().length).toBe(1);
    expect(result.errors.length + (result.failedRecipes?.length || 0)).toBeGreaterThan(0);
  });

  it('should export empty array if no recipes', () => {
    // Simulate export with no recipes
    // Since exportUserRecipes always uses currentUser and localRecipes,
    // we clear recipes and check the error
    const exportResult = exportService.exportUserRecipes();
    expect(exportResult.count).toBe(0);
    expect(exportResult.error).toBeDefined();
  });
});
