import { Injectable, inject } from '@angular/core';
import { map, Observable } from 'rxjs';
import { FoodService } from '../../../core/services/food.service';
import type { Food } from '../../../core/models/food';
import type { FoodPage } from '../../../core/models/food-page';

@Injectable({ providedIn: 'root' })
export class StatisticService {
  private readonly foodService = inject(FoodService);

  getRecipesByTags(): Observable<{ tag: string; count: number }[]> {
    return this.foodService.search({
      pageIndex: 0,
      pageSize: 9999,
      sortBy: 'id',
      sortDirection: 'asc',
      refreshTick: 0,
      query: '',
      cuisine: '',
      category: '',
      tag: '',
      mineOnly: false
    }).pipe(
      map((page: FoodPage) => {
        const counter = new Map<string, number>();
        for (const recipe of page.items) {
          const tags = recipe.tags ?? [];
          for (const tag of tags) {
            counter.set(tag, (counter.get(tag) ?? 0) + 1);
          }
        }
        return Array.from(counter.entries()).map(([tag, count]) => ({ tag, count }));
      })
    );
  }

  getRecipesByCuisine(): Observable<{ cuisine: string; count: number }[]> {
    return this.foodService.search({
      pageIndex: 0,
      pageSize: 9999,
      sortBy: 'id',
      sortDirection: 'asc',
      refreshTick: 0,
      query: '',
      cuisine: '',
      category: '',
      tag: '',
      mineOnly: false
    }).pipe(
      map((page: FoodPage) => {
        const counter = new Map<string, number>();
        for (const recipe of page.items) {
          const cuisine = recipe.cuisine || 'Unknown';
          counter.set(cuisine, (counter.get(cuisine) ?? 0) + 1);
        }
        return Array.from(counter.entries()).map(([cuisine, count]) => ({ cuisine, count }));
      })
    );
  }

  getRecipesByCategory(): Observable<{ category: string; count: number }[]> {
    return this.foodService.search({
      pageIndex: 0,
      pageSize: 9999,
      sortBy: 'id',
      sortDirection: 'asc',
      refreshTick: 0,
      query: '',
      cuisine: '',
      category: '',
      tag: '',
      mineOnly: false
    }).pipe(
      map((page: FoodPage) => {
        const counter = new Map<string, number>();
        for (const recipe of page.items) {
          const category = recipe.category || 'Unknown';
          counter.set(category, (counter.get(category) ?? 0) + 1);
        }
        return Array.from(counter.entries()).map(([category, count]) => ({ category, count }));
      })
    );
  }

  getRecipesByVotes(): Observable<{ title: string; votes: number }[]> {
    // @ts-expect-error: feedback is private, but we need it for statistics
    const feedbackService = (this.foodService as { feedback: { getScore(id: number): number } }).feedback;
    return this.foodService.search({
      pageIndex: 0,
      pageSize: 9999,
      sortBy: 'id',
      sortDirection: 'asc',
      refreshTick: 0,
      query: '',
      cuisine: '',
      category: '',
      tag: '',
      mineOnly: false
    }).pipe(
      map((page: FoodPage) => {
        return page.items
          .map((recipe: Food) => ({
            title: recipe.title,
            votes: feedbackService.getScore(recipe.id)
          }))
          .sort((a, b) => b.votes - a.votes)
          .slice(0, 5);
      })
    );
  }
}
