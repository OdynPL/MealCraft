import { Injectable, inject } from '@angular/core';
import { LocalRecipeService } from './local-recipe.service';
import { AuthService } from './auth.service';


@Injectable({ providedIn: 'root' })
export class RecipeExportService {
  private readonly localRecipes = inject(LocalRecipeService);
  private readonly auth = inject(AuthService);

  exportUserRecipes(): { filename: string; blob: Blob; count: number; error?: string } {
    const user = this.auth.currentUser();
    if (!user) {
      return { filename: '', blob: new Blob(), count: 0, error: 'Musisz być zalogowany, aby eksportować przepisy.' };
    }
    const all = this.localRecipes.getAllCustom();
    const mine = all.filter((r: import('../models/food-detail').FoodDetail) => r.ownerId === user.id);
    if (mine.length === 0) {
      return { filename: '', blob: new Blob(), count: 0, error: 'Nie masz żadnych przepisów do eksportu.' };
    }
    const json = JSON.stringify(mine, null, 2);
    // Dodaj BOM na początek, aby wymusić UTF-8 z BOM
    const bom = '\uFEFF';
    const blob = new Blob([bom + json], { type: 'application/json' });
    return { filename: 'my-recipes.json', blob, count: mine.length };
  }

  exportSingleRecipe(recipe: import('../models/food-detail').FoodDetail): { filename: string; blob: Blob } {
    const json = JSON.stringify([recipe], null, 2);
    const bom = '\uFEFF';
    const blob = new Blob([bom + json], { type: 'application/json' });
    return { filename: `recipe-${recipe.id}.json`, blob };
  }
}
