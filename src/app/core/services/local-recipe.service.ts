import { Injectable, inject } from '@angular/core';

import { FoodDetail } from '../models';
import { LocalRecipeDraft, LocalRecipeFacets, LocalRecipeSnapshot, LocalRecipeState } from '../models/local-recipe';
import { AuthService } from './auth.service';
import { ConfigurationService } from './configuration.service';

@Injectable({ providedIn: 'root' })
export class LocalRecipeService {
  private readonly config = inject(ConfigurationService);
  private readonly auth = inject(AuthService);

  getAllCustom(): FoodDetail[] {
    return this.readState().custom;
  }

  getById(id: number): FoodDetail | undefined {
    const state = this.readState();
    return state.custom.find((recipe) => recipe.id === id)
      ?? state.overrides.find((recipe) => recipe.id === id);
  }

  getOverride(id: number): FoodDetail | undefined {
    return this.readState().overrides.find((recipe) => recipe.id === id);
  }

  getAllOverrides(): FoodDetail[] {
    return this.readState().overrides;
  }

  isDeleted(id: number): boolean {
    const state = this.readState();
    return this.getDeletedIdsForCurrentUser(state).includes(id);
  }

  getDeletedIds(): number[] {
    const state = this.readState();
    return this.getDeletedIdsForCurrentUser(state);
  }

  getSnapshot(): LocalRecipeSnapshot {
    const state = this.readState();
    return {
      custom: [...state.custom],
      overrides: [...state.overrides],
      deletedIds: this.getDeletedIdsForCurrentUser(state)
    };
  }

  canCurrentUserDelete(id: number): boolean {
    const userId = this.auth.currentUser()?.id;
    if (!userId) {
      return false;
    }

    const state = this.readState();
    const localRecipe = state.custom.find((item) => item.id === id)
      ?? state.overrides.find((item) => item.id === id);

    if (!localRecipe) {
      return true;
    }

    return localRecipe.ownerId === undefined || localRecipe.ownerId === userId;
  }

  canCurrentUserManageOwnRecipe(id: number): boolean {
    const userId = this.auth.currentUser()?.id;
    if (!userId) {
      return false;
    }

    const state = this.readState();
    const localRecipe = state.custom.find((item) => item.id === id)
      ?? state.overrides.find((item) => item.id === id);

    if (!localRecipe) {
      return false;
    }

    return localRecipe.ownerId === undefined || localRecipe.ownerId === userId;
  }

  add(draft: LocalRecipeDraft): FoodDetail {
    const currentUser = this.auth.currentUser();
    if (!currentUser) {
      throw new Error('Login is required to add recipes.');
    }

    const state = this.readState();
    const createdAt = new Date().toISOString();
    const author = buildUserDisplayName(currentUser.firstName, currentUser.lastName, currentUser.email);

    const recipe: FoodDetail = {
      id: this.nextId(state.custom),
      title: draft.title,
      image: draft.image || this.config.localRecipePlaceholderImage,
      category: draft.category,
      cuisine: draft.cuisine,
      instructions: draft.instructions,
      sourceUrl: draft.sourceUrl,
      youtubeUrl: draft.youtubeUrl,
      tags: [...new Set(draft.tags)],
      ownerId: currentUser.id,
      author,
      createdAt
    };

    state.custom = [recipe, ...state.custom];
    this.unmarkDeletedForCurrentUser(state, recipe.id);
    this.writeState(state);

    return recipe;
  }

  save(id: number, draft: LocalRecipeDraft, base?: FoodDetail): FoodDetail {
    const currentUser = this.auth.currentUser();
    if (!currentUser) {
      throw new Error('Login is required to edit recipes.');
    }

    const fallbackAuthor = buildUserDisplayName(currentUser.firstName, currentUser.lastName, currentUser.email);
    const fallbackOwnerId = currentUser.id;

    const state = this.readState();
    const customIndex = state.custom.findIndex((item) => item.id === id);

    if (customIndex >= 0) {
      const current = state.custom[customIndex];
      if (current.ownerId !== undefined && current.ownerId !== currentUser.id) {
        throw new Error('You can edit only your own recipes.');
      }

      const updated = this.buildRecipe(id, draft, current, fallbackAuthor, fallbackOwnerId);
      state.custom = [
        ...state.custom.slice(0, customIndex),
        updated,
        ...state.custom.slice(customIndex + 1)
      ];
      this.writeState(state);
      return updated;
    }

    const overrideBase = base ?? state.overrides.find((item) => item.id === id);
    if (overrideBase?.ownerId !== undefined && overrideBase.ownerId !== currentUser.id) {
      throw new Error('You can edit only your own recipes.');
    }

    const updated = this.buildRecipe(id, draft, overrideBase, fallbackAuthor, fallbackOwnerId);
    const overrideIndex = state.overrides.findIndex((item) => item.id === id);

    if (overrideIndex >= 0) {
      state.overrides = [
        ...state.overrides.slice(0, overrideIndex),
        updated,
        ...state.overrides.slice(overrideIndex + 1)
      ];
    } else {
      state.overrides = [updated, ...state.overrides];
    }

    this.unmarkDeletedForCurrentUser(state, id);
    this.writeState(state);
    return updated;
  }

  delete(id: number): void {
    const userId = this.auth.currentUser()?.id;
    if (!userId) {
      throw new Error('Login is required to delete recipes.');
    }

    const state = this.readState();

    const ownCustom = state.custom.some((item) => item.id === id && (item.ownerId === undefined || item.ownerId === userId));
    const ownOverride = state.overrides.some((item) => item.id === id && (item.ownerId === undefined || item.ownerId === userId));

    state.custom = state.custom.filter((item) => item.id !== id || (item.ownerId !== undefined && item.ownerId !== userId));
    state.overrides = state.overrides.filter((item) => item.id !== id || (item.ownerId !== undefined && item.ownerId !== userId));

    if (!ownCustom) {
      this.markDeletedForCurrentUser(state, id);
    }

    this.writeState(state);
  }

  clearForCurrentUser(apiRecipeIds: number[]): void {
    const userId = this.auth.currentUser()?.id;
    if (!userId) {
      throw new Error('Login is required to delete recipes.');
    }

    const state = this.readState();

    state.custom = state.custom.filter((item) => item.ownerId !== userId);
    state.overrides = state.overrides.filter((item) => item.ownerId !== userId);

    for (const id of apiRecipeIds) {
      this.markDeletedForCurrentUser(state, id);
    }

    this.writeState(state);
  }

  clearAll(): void {
    this.writeState({ custom: [], overrides: [], deletedIds: [], deletedByUser: {} });
  }

  getFacetValues(): LocalRecipeFacets {
    const state = this.readState();
    const sources = [...state.custom, ...state.overrides];

    return {
      cuisines: uniqueValues(sources.map((item) => item.cuisine)),
      categories: uniqueValues(sources.map((item) => item.category))
    };
  }

  private nextId(items: FoodDetail[]): number {
    const now = Date.now();
    const maxId = items.reduce((max, item) => Math.max(max, item.id), 0);
    return Math.max(now, maxId + 1);
  }

  private buildRecipe(
    id: number,
    draft: LocalRecipeDraft,
    base: FoodDetail | undefined,
    fallbackAuthor: string,
    fallbackOwnerId: number | undefined
  ): FoodDetail {
    const createdAt = base?.createdAt || new Date().toISOString();
    const author = base?.author || fallbackAuthor;
    const ownerId = base?.ownerId ?? fallbackOwnerId;

    return {
      id,
      title: draft.title,
      image: draft.image || base?.image || this.config.localRecipePlaceholderImage,
      category: draft.category,
      cuisine: draft.cuisine,
      instructions: draft.instructions,
      sourceUrl: draft.sourceUrl,
      youtubeUrl: draft.youtubeUrl,
      tags: [...new Set(draft.tags)],
      ownerId,
      author,
      createdAt
    };
  }

  private readState(): LocalRecipeState {
    if (typeof localStorage === 'undefined') {
      return { custom: [], overrides: [], deletedIds: [], deletedByUser: {} };
    }

    const raw = localStorage.getItem(this.config.localRecipeStorageKey);
    if (!raw) {
      return { custom: [], overrides: [], deletedIds: [], deletedByUser: {} };
    }

    try {
      const parsed = JSON.parse(raw);

      if (Array.isArray(parsed)) {
        return {
          custom: parsed
            .map((item) => this.toRecipe(item))
            .filter((item): item is FoodDetail => item !== null),
          overrides: [],
          deletedIds: [],
          deletedByUser: {}
        };
      }

      if (!isObject(parsed)) {
        return { custom: [], overrides: [], deletedIds: [], deletedByUser: {} };
      }

      const customRaw = Array.isArray(parsed['custom']) ? parsed['custom'] : [];
      const overridesRaw = Array.isArray(parsed['overrides']) ? parsed['overrides'] : [];
      const deletedIdsRaw = Array.isArray(parsed['deletedIds']) ? parsed['deletedIds'] : [];
      const deletedByUserRaw = isObject(parsed['deletedByUser']) ? parsed['deletedByUser'] : {};

      return {
        custom: customRaw
          .map((item) => this.toRecipe(item))
          .filter((item): item is FoodDetail => item !== null),
        overrides: overridesRaw
          .map((item) => this.toRecipe(item))
          .filter((item): item is FoodDetail => item !== null),
        deletedIds: deletedIdsRaw
          .map((value) => Number(value))
          .filter((value) => Number.isFinite(value) && value > 0),
        deletedByUser: parseDeletedByUser(deletedByUserRaw)
      };
    } catch {
      return { custom: [], overrides: [], deletedIds: [], deletedByUser: {} };
    }
  }

  private writeState(state: LocalRecipeState): void {
    if (typeof localStorage === 'undefined') {
      return;
    }

    localStorage.setItem(this.config.localRecipeStorageKey, JSON.stringify(state));
  }

  private toRecipe(value: unknown): FoodDetail | null {
    if (!isObject(value)) {
      return null;
    }

    const id = Number(value['id']);
    const title = String(value['title'] ?? '').trim();
    const image = String(value['image'] ?? '').trim() || this.config.localRecipePlaceholderImage;
    const category = String(value['category'] ?? '').trim();
    const cuisine = String(value['cuisine'] ?? '').trim();
    const instructions = String(value['instructions'] ?? '').trim();
    const sourceUrl = normalizeOptionalUrl(value['sourceUrl']);
    const youtubeUrl = normalizeOptionalUrl(value['youtubeUrl']);
    const author = String(value['author'] ?? 'Unknown').trim() || 'Unknown';
    const createdAt = normalizeCreatedAt(value['createdAt']);
    const ownerId = normalizeOptionalOwnerId(value['ownerId']);

    if (!Number.isFinite(id) || id <= 0 || !title || !category || !cuisine || !instructions) {
      return null;
    }

    const rawTags = Array.isArray(value['tags']) ? value['tags'] : [];
    const tags = rawTags
      .map((tag) => String(tag).trim())
      .filter((tag) => tag.length > 0);

    return {
      id,
      title,
      image,
      category,
      cuisine,
      instructions,
      sourceUrl,
      youtubeUrl,
      tags: [...new Set(tags)],
      ownerId,
      author,
      createdAt
    };
  }

  private getDeletedIdsForCurrentUser(state: LocalRecipeState): number[] {
    const userId = this.auth.currentUser()?.id;
    if (!userId) {
      return [];
    }

    const scoped = state.deletedByUser?.[String(userId)] ?? [];
    return [...new Set(scoped)];
  }

  private markDeletedForCurrentUser(state: LocalRecipeState, id: number): void {
    const userId = this.auth.currentUser()?.id;
    if (!userId || !Number.isFinite(id) || id <= 0) {
      return;
    }

    const key = String(userId);
    const current = state.deletedByUser?.[key] ?? [];
    const next = [...new Set([...current, id])];

    state.deletedByUser = {
      ...(state.deletedByUser ?? {}),
      [key]: next
    };
  }

  private unmarkDeletedForCurrentUser(state: LocalRecipeState, id: number): void {
    const userId = this.auth.currentUser()?.id;
    if (!userId) {
      return;
    }

    const key = String(userId);
    const current = state.deletedByUser?.[key] ?? [];
    const next = current.filter((item) => item !== id);

    state.deletedByUser = {
      ...(state.deletedByUser ?? {}),
      [key]: next
    };
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function normalizeOptionalUrl(value: unknown): string | undefined {
  const normalized = String(value ?? '').trim();
  return normalized.length > 0 ? normalized : undefined;
}

function normalizeCreatedAt(value: unknown): string {
  const raw = String(value ?? '').trim();
  const date = raw ? new Date(raw) : null;

  if (!date || Number.isNaN(date.getTime())) {
    return new Date().toISOString();
  }

  return date.toISOString();
}

function normalizeOptionalOwnerId(value: unknown): number | undefined {
  const ownerId = Number(value);
  return Number.isFinite(ownerId) && ownerId > 0 ? ownerId : undefined;
}

function parseDeletedByUser(value: Record<string, unknown>): Record<string, number[]> {
  const parsed: Record<string, number[]> = {};

  for (const [key, ids] of Object.entries(value)) {
    if (!Array.isArray(ids)) {
      continue;
    }

    parsed[key] = ids
      .map((id) => Number(id))
      .filter((id) => Number.isFinite(id) && id > 0);
  }

  return parsed;
}

function uniqueValues(values: string[]): string[] {
  return [...new Set(values.map((item) => item.trim()).filter((item) => item.length > 0))]
    .sort((a, b) => a.localeCompare(b));
}

function buildUserDisplayName(firstName: string, lastName: string, email: string): string {
  const fullName = `${firstName} ${lastName}`.trim();
  return fullName.length > 0 ? fullName : email;
}
