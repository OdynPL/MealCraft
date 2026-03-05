import { describe, it, expect, beforeEach } from 'vitest';
import { MealCommentsService } from './meal-comments.service';
import { vi } from 'vitest';

describe('MealCommentsService', () => {
  let service: MealCommentsService;
  let storageData: Record<string, string>;

  beforeEach(() => {
    storageData = {};
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem: vi.fn((key: string) => storageData[key] ?? null),
        setItem: vi.fn((key: string, value: string) => { storageData[key] = value; }),
        removeItem: vi.fn((key: string) => { delete storageData[key]; })
      }
    });
    service = new MealCommentsService();
    service.clearAll();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should add a comment', () => {
    service.addComment({
      mealId: 1,
      author: 'Test User',
      content: 'Test comment',
      createdAt: '2024-01-01T12:00:00Z',
      avatar: undefined
    });
    const comments = service.getCommentsForMeal(1);
    expect(comments.length).toBe(1);
    expect(comments[0].content).toBe('Test comment');
  });

  it('should update a comment', () => {
    service.addComment({
      mealId: 2,
      author: 'User',
      content: 'Old',
      createdAt: '2024-01-01T12:00:00Z',
      avatar: undefined
    });
    let comment = service.getCommentsForMeal(2)[0];
    service.updateComment({ ...comment, content: 'New' });
    comment = service.getCommentsForMeal(2)[0];
    expect(comment.content).toBe('New');
  });

  it('should delete a comment', () => {
    service.addComment({
      mealId: 3,
      author: 'User',
      content: 'To delete',
      createdAt: '2024-01-01T12:00:00Z',
      avatar: undefined
    });
    const comment = service.getCommentsForMeal(3)[0];
    service.deleteComment(comment.id);
    expect(service.getCommentsForMeal(3).length).toBe(0);
  });

  it('should clear all comments', () => {
    service.addComment({
      mealId: 4,
      author: 'User',
      content: 'A',
      createdAt: '2024-01-01T12:00:00Z',
      avatar: undefined
    });
    service.clearAll();
    expect(service['comments']().length).toBe(0);
  });

  it('should filter only valid comments from storage', () => {
    storageData['mealcraft-comments'] = JSON.stringify([
      { mealId: 5, author: 'A', content: 'B', createdAt: '2024-01-01T12:00:00Z' },
      { invalid: true }
    ]);
    const s = new MealCommentsService();
    expect(s['comments']().length).toBe(1);
  });
});
