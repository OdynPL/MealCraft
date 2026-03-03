import { Injectable, inject, signal } from '@angular/core';

import { Food } from '../models';
import { AuthService } from './auth.service';

type VoteValue = -1 | 1;
type VoteMap = Record<number, Record<number, VoteValue>>;
type TagMap = Record<number, string[]>;

const VOTES_KEY = 'foodExplorerVotes';
const TAGS_KEY = 'foodExplorerTags';

@Injectable({ providedIn: 'root' })
export class RecipeFeedbackService {
  private readonly auth = inject(AuthService);
  private readonly votes = signal<VoteMap>(readVotes());
  private readonly tags = signal<TagMap>(readJson<TagMap>(TAGS_KEY, {}));

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
    if (!userId) {
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

function readVotes(): VoteMap {
  const parsed = readJson<unknown>(VOTES_KEY, {});
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
