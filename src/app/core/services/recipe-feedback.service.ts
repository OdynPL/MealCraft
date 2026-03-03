import { Injectable, inject, signal } from '@angular/core';

import { Food } from '../models';
import { ActivityLogService } from './activity-log.service';
import { AuthService } from './auth.service';
import { ConfigurationService } from './configuration.service';
import { LocalRecipeService } from './local-recipe.service';

type VoteValue = -1 | 1;
type VoteMap = Record<number, Record<number, VoteValue>>;
type TagMap = Record<number, string[]>;

@Injectable({ providedIn: 'root' })
export class RecipeFeedbackService {
  private readonly auth = inject(AuthService);
  private readonly config = inject(ConfigurationService);
  private readonly localRecipes = inject(LocalRecipeService);
  private readonly activityLog = inject(ActivityLogService);
  private readonly votes = signal<VoteMap>(readVotes(this.config.feedbackVotesStorageKey));
  private readonly tags = signal<TagMap>(readJson<TagMap>(this.config.feedbackTagsStorageKey, {}));

  getScore(mealId: number): number {
    const mealVotes = this.votes()[mealId] ?? {};
    return Object.values(mealVotes).reduce((sum, vote) => sum + vote, 0);
  }

  canVote(mealId: number): boolean {
    const userId = this.auth.currentUser()?.id;
    if (!userId) {
      return false;
    }

    return this.votes()[mealId]?.[userId] === undefined;
  }

  upvote(mealId: number): void {
    this.vote(mealId, 1);
  }

  downvote(mealId: number): void {
    this.vote(mealId, -1);
  }

  private vote(mealId: number, vote: VoteValue): void {
    const userId = this.auth.currentUser()?.id;
    const user = this.auth.currentUser();
    if (!userId) {
      return;
    }

    if (this.votes()[mealId]?.[userId] !== undefined) {
      return;
    }

    this.votes.update((current) => {
      const mealVotes = current[mealId] ?? {};
      if (mealVotes[userId] !== undefined) {
        return current;
      }

      const next: VoteMap = {
        ...current,
        [mealId]: {
          ...mealVotes,
          [userId]: vote
        }
      };

      writeJson(this.config.feedbackVotesStorageKey, next);
      return next;
    });

    this.activityLog.record({
      area: 'recipes',
      action: vote === 1 ? 'recipe-upvote' : 'recipe-downvote',
      status: 'success',
      actor: {
        id: user?.id,
        email: user?.email,
        name: user ? `${user.firstName} ${user.lastName}`.trim() : undefined,
        role: user?.role
      },
      target: `Recipe #${mealId}`,
      details: vote === 1 ? 'Upvote added.' : 'Downvote added.'
    });
  }

  getTags(food: Pick<Food, 'id' | 'tags'>): string[] {
    const customTags = this.tags()[food.id] ?? [];
    return uniqueTags([...(food.tags ?? []), ...customTags]);
  }

  canManageTags(mealId: number): boolean {
    return this.localRecipes.canCurrentUserManageOwnRecipe(mealId);
  }

  addTag(mealId: number, value: string): void {
    if (!this.canManageTags(mealId)) {
      return;
    }

    const normalized = normalizeTag(value, this.config.feedbackTagMaxLength);
    if (!normalized) {
      return;
    }

    this.tags.update((current) => {
      const tags = uniqueTags([...(current[mealId] ?? []), normalized]);
      const next = { ...current, [mealId]: tags };
      writeJson(this.config.feedbackTagsStorageKey, next);
      return next;
    });

    const user = this.auth.currentUser();
    this.activityLog.record({
      area: 'recipes',
      action: 'tag-add',
      status: 'success',
      actor: {
        id: user?.id,
        email: user?.email,
        name: user ? `${user.firstName} ${user.lastName}`.trim() : undefined,
        role: user?.role
      },
      target: `Recipe #${mealId}`,
      details: `Tag added: ${normalized}`
    });
  }

  removeTag(mealId: number, value: string): void {
    if (!this.canManageTags(mealId)) {
      return;
    }

    this.tags.update((current) => {
      const existing = current[mealId] ?? [];
      const nextTags = existing.filter((tag) => tag !== value);
      const next = { ...current, [mealId]: nextTags };
      writeJson(this.config.feedbackTagsStorageKey, next);
      return next;
    });

    const user = this.auth.currentUser();
    this.activityLog.record({
      area: 'recipes',
      action: 'tag-remove',
      status: 'success',
      actor: {
        id: user?.id,
        email: user?.email,
        name: user ? `${user.firstName} ${user.lastName}`.trim() : undefined,
        role: user?.role
      },
      target: `Recipe #${mealId}`,
      details: `Tag removed: ${value}`
    });
  }

  clearAll(): void {
    this.votes.set({});
    this.tags.set({});
    writeJson(this.config.feedbackVotesStorageKey, {});
    writeJson(this.config.feedbackTagsStorageKey, {});
  }
}

function normalizeTag(value: string, maxLength: number): string {
  return value.trim().slice(0, maxLength);
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

function readVotes(storageKey: string): VoteMap {
  const parsed = readJson<unknown>(storageKey, {});
  if (!isObject(parsed)) {
    return {};
  }

  const result: VoteMap = {};

  for (const [mealIdRaw, mealVotesRaw] of Object.entries(parsed)) {
    const mealId = Number(mealIdRaw);
    if (!Number.isFinite(mealId) || mealId <= 0 || !isObject(mealVotesRaw)) {
      continue;
    }

    const normalizedMealVotes: Record<number, VoteValue> = {};
    for (const [userIdRaw, voteRaw] of Object.entries(mealVotesRaw)) {
      const userId = Number(userIdRaw);
      if (!Number.isFinite(userId) || userId <= 0) {
        continue;
      }

      if (voteRaw === 1 || voteRaw === -1) {
        normalizedMealVotes[userId] = voteRaw;
      }
    }

    result[mealId] = normalizedMealVotes;
  }

  return result;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
