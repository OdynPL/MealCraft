
import { Injectable, inject, signal, computed } from '@angular/core';

export interface MealComment {
  id: number;
  mealId: number;
  author: string;
  content: string;
  createdAt: string;
  avatar?: string;
}

const STORAGE_KEY = 'mealcraft-comments';

@Injectable({ providedIn: 'root' })
export class MealCommentsService {
  private readonly _comments = signal<MealComment[]>(this.readAll());
  readonly comments = computed(() => this._comments());

  constructor() {}

  private readAll(): MealComment[] {
    if (typeof localStorage === 'undefined') {
      return [];
    }
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(this.isValidComment);
    } catch {
      return [];
    }
  }

  private writeAll(comments: MealComment[]): void {
    if (typeof localStorage === 'undefined') {
      return;
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(comments));
    } catch {}
  }

  private isValidComment(obj: any): obj is MealComment {
    return obj && typeof obj === 'object' &&
      typeof obj.mealId === 'number' &&
      typeof obj.author === 'string' &&
      typeof obj.content === 'string' &&
      typeof obj.createdAt === 'string';
  }

  private nextId(comments: MealComment[]): number {
    const now = Date.now();
    const maxId = comments.reduce((max, c) => Math.max(max, c.id ?? 0), 0);
    return Math.max(now, maxId + 1);
  }

  getCommentsForMeal(mealId: number): MealComment[] {
    return this._comments().filter(c => c.mealId === mealId);
  }

  addComment(comment: Omit<MealComment, 'id'>): void {
    const comments = this._comments();
    const newComment: MealComment = { ...comment, id: this.nextId(comments) };
    const next = [newComment, ...comments];
    this._comments.set(next);
    this.writeAll(next);
  }

  updateComment(comment: MealComment): void {
    if (!comment.id) return;
    const comments = this._comments();
    const idx = comments.findIndex(c => c.id === comment.id);
    if (idx === -1) return;
    const next = [...comments];
    next[idx] = { ...comments[idx], ...comment };
    this._comments.set(next);
    this.writeAll(next);
  }

  deleteComment(id: number): void {
    const comments = this._comments();
    const next = comments.filter(c => c.id !== id);
    this._comments.set(next);
    this.writeAll(next);
  }

  clearAll(): void {
    this._comments.set([]);
    this.writeAll([]);
  }
}
