import { Injectable, inject } from '@angular/core';
import { LocalRecipeService } from './local-recipe.service';
import { AuthService } from './auth.service';

export interface RecipeImportResult {
  imported: number;
  skipped: number;
  errors: string[];
  failedRecipes?: {
    index: number;
    title?: string;
    reasons: string[];
  }[];
}

@Injectable({ providedIn: 'root' })
export class RecipeImportService {
  private readonly localRecipes = inject(LocalRecipeService);
  private readonly auth = inject(AuthService);

  validateAndImport(json: string): RecipeImportResult {
    const result: RecipeImportResult = { imported: 0, skipped: 0, errors: [], failedRecipes: [] };
    let data: unknown;
    try {
      data = JSON.parse(json);
    } catch {
      result.errors.push('Nieprawidłowy plik JSON.');
      return result;
    }
    if (!Array.isArray(data)) {
      result.errors.push('Lista przepisów jest wymagana.');
      return result;
    }
    const user = this.auth.currentUser();
    if (!user) {
      result.errors.push('Musisz być zalogowany, aby importować przepisy.');
      return result;
    }
    const existing = this.localRecipes.getAllCustom().filter(r => r.ownerId === user.id);
    const existingTitles = new Set(existing.map(r => r.title.trim().toLowerCase()));
    (data as Record<string, unknown>[]).forEach((item, idx) => {
      const reasons: string[] = [];
      if (!item || typeof item !== 'object') {
        reasons.push('Nieprawidłowy format obiektu.');
      }
      if (!('title' in item) || !item['title']) reasons.push('Brak tytułu.');
      if (!('category' in item) || !item['category']) reasons.push('Brak kategorii.');
      if (!('cuisine' in item) || !item['cuisine']) reasons.push('Brak kuchni.');
      if (!('instructions' in item) || !item['instructions']) reasons.push('Brak instrukcji.');
      const titleKey = 'title' in item && item['title'] ? String(item['title']).trim().toLowerCase() : '';
      if (titleKey && existingTitles.has(titleKey)) {
        reasons.push('Przepis o tym tytule już istnieje.');
      }
      if (reasons.length > 0) {
        result.skipped++;
        result.failedRecipes!.push({
          index: idx,
          title: 'title' in item ? (item['title'] as string) : undefined,
          reasons
        });
        return;
      }
      try {
        this.localRecipes.add({
          title: String(item['title']),
          category: String(item['category']),
          cuisine: String(item['cuisine']),
          instructions: String(item['instructions']),
          image: 'image' in item && item['image'] ? String(item['image']) : undefined,
          sourceUrl: 'sourceUrl' in item && item['sourceUrl'] ? String(item['sourceUrl']) : undefined,
          youtubeUrl: 'youtubeUrl' in item && item['youtubeUrl'] ? String(item['youtubeUrl']) : undefined,
          tags: Array.isArray(item['tags']) ? item['tags'].map((t: unknown) => String(t)) : [],
        });
        existingTitles.add(titleKey);
        result.imported++;
      } catch (e) {
        result.errors.push('Błąd podczas importu przepisu: ' + (e instanceof Error ? e.message : String(e)));
        result.failedRecipes!.push({
          index: idx,
          title: 'title' in item ? (item['title'] as string) : undefined,
          reasons: ['Błąd podczas zapisu: ' + (e instanceof Error ? e.message : String(e))]
        });
        result.skipped++;
      }
    });
    return result;
  }
}
