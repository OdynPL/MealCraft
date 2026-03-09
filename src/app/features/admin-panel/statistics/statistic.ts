import { Chart, registerables } from 'chart.js';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { BaseChartDirective } from 'ng2-charts';
import { FoodService } from '../../../core/services/food.service';
import { StatisticService } from './statistic.service';
import type { FoodPage } from '../../../core/models/food-page';

@Component({
  selector: 'app-statistic',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './statistic.html',
  styleUrl: './statistic.scss',
  imports: [MatCardModule, BaseChartDirective]
})
export class StatisticComponent {
  private readonly foodService = inject(FoodService);
  private readonly statisticService = inject(StatisticService);
  readonly totalRecipes = signal<number>(0);

  readonly tagsData = signal<{ tag: string; count: number }[]>([]);
  readonly tagsChartLabels = signal<string[]>([]);
  readonly tagsChartData = signal<number[]>([]);
  readonly cuisineData = signal<{ cuisine: string; count: number }[]>([]);
  readonly cuisineChartLabels = signal<string[]>([]);
  readonly cuisineChartData = signal<number[]>([]);
  readonly categoryData = signal<{ category: string; count: number }[]>([]);
  readonly categoryChartLabels = signal<string[]>([]);
  readonly categoryChartData = signal<number[]>([]);
  readonly votesData = signal<{ title: string; votes: number }[]>([]);
  readonly votesChartLabels = signal<string[]>([]);
  readonly votesChartData = signal<number[]>([]);

  constructor() {
    Chart.register(...registerables);
    this.foodService.search({
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
    }).subscribe({
      next: (page: FoodPage) => {
        this.totalRecipes.set(page?.totalResults ?? 0);
      },
      error: (err: unknown) => {
        console.error('STATISTICS: totalRecipes error', err);
      }
    });
    this.statisticService.getRecipesByTags().subscribe({
      next: (data: { tag: string; count: number }[]) => {
        this.tagsData.set(data);
        this.tagsChartLabels.set(data.map((d: { tag: string; count: number }) => d.tag));
        this.tagsChartData.set(data.map((d: { tag: string; count: number }) => d.count));
      },
      error: (err: unknown) => {
        console.error('STATISTICS: tagsData error', err);
      }
    });
    this.statisticService.getRecipesByCuisine().subscribe({
      next: (data: { cuisine: string; count: number }[]) => {
        this.cuisineData.set(data);
        this.cuisineChartLabels.set(data.map((d: { cuisine: string; count: number }) => d.cuisine));
        this.cuisineChartData.set(data.map((d: { cuisine: string; count: number }) => d.count));
      },
      error: (err: unknown) => {
        console.error('STATISTICS: cuisineData error', err);
      }
    });
    this.statisticService.getRecipesByCategory().subscribe({
      next: (data: { category: string; count: number }[]) => {
        this.categoryData.set(data);
        this.categoryChartLabels.set(data.map((d: { category: string; count: number }) => d.category));
        this.categoryChartData.set(data.map((d: { category: string; count: number }) => d.count));
      },
      error: (err: unknown) => {
        console.error('STATISTICS: categoryData error', err);
      }
    });
    this.statisticService.getRecipesByVotes().subscribe({
      next: (data: { title: string; votes: number }[]) => {
        this.votesData.set(data);
        this.votesChartLabels.set(data.map((d: { title: string; votes: number }) => d.title));
        this.votesChartData.set(data.map((d: { title: string; votes: number }) => d.votes));
      },
      error: (err: unknown) => {
        console.error('STATISTICS: votesData error', err);
      }
    });
  }
}
