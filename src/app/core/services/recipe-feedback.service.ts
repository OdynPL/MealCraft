import { Injectable, signal } from '@angular/core';

import { Food } from '../models';

type VoteMap = Record<number, number>;
type TagMap = Record<number, string[]>;

const VOTES_KEY = 'foodExplorerVotes';
const TAGS_KEY = 'foodExplorerTags';

@Injectable({ providedIn: 'root' })
export class RecipeFeedbackService {
  private readonly votes = signal<VoteMap>(readJson<VoteMap>(VOTES_KEY, {}));
  private readonly tags = signal<TagMap>(readJson<TagMap>(TAGS_KEY, {}));

  getScore(mealId: number): number {
    return this.votes()[mealId] ?? 0;
  }

  upvote(mealId: number): void {
    this.votes.update((current) => {
      const next = { ...current, [mealId]: (current[mealId] ?? 0) + 1 };
      writeJson(VOTES_KEY, next);
      return next;
    });
  }

  downvote(mealId: number): void {
    this.votes.update((current) => {
      const next = { ...current, [mealId]: (current[mealId] ?? 0) - 1 };
      writeJson(VOTES_KEY, next);
      return next;
    });
  }

  getTags(food: Pick<Food, 'id' | 'tags'>): string[] {
    const customTags = this.tags()[food.id] ?? [];
    return uniqueTags([...(food.tags ?? []), ...customTags]);
  }

  addTag(mealId: number, value: string): void {
    const normalized = normalizeTag(value);
    if (!normalized) {
      return;
    }

    this.tags.update((current) => {
      const tags = uniqueTags([...(current[mealId] ?? []), normalized]);
      const next = { ...current, [mealId]: tags };
      writeJson(TAGS_KEY, next);
      return next;
    });
  }

  removeTag(mealId: number, value: string): void {
    this.tags.update((current) => {
      const existing = current[mealId] ?? [];
      const nextTags = existing.filter((tag) => tag !== value);
      const next = { ...current, [mealId]: nextTags };
      writeJson(TAGS_KEY, next);
      return next;
    });
  }

  clearAll(): void {
    this.votes.set({});
    this.tags.set({});
    writeJson(VOTES_KEY, {});
    writeJson(TAGS_KEY, {});
  }
}

function normalizeTag(value: string): string {
  return value.trim().slice(0, 24);
}

function uniqueTags(tags: string[]): string[] {
  return [...new Set(tags.filter((tag) => tag.trim().length > 0))];
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = globalThis.localStorage?.getItem(key);
    if (!raw) {
      return fallback;
    }

    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T): void {
  try {
    globalThis.localStorage?.setItem(key, JSON.stringify(value));
  } catch {
    return;
  }
}
