import { TestBed } from '@angular/core/testing';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { StatisticComponent } from './statistic';
import { StatisticService } from './statistic.service';
import { FoodService } from '../../../core/services/food.service';
import { of } from 'rxjs';

describe('StatisticComponent', () => {
  let component: StatisticComponent;
  let statisticServiceMock: {
    getRecipesByTags: ReturnType<typeof vi.fn>;
    getRecipesByCuisine: ReturnType<typeof vi.fn>;
    getRecipesByCategory: ReturnType<typeof vi.fn>;
    getRecipesByVotes: ReturnType<typeof vi.fn>;
  };
  let foodServiceMock: { search: ReturnType<typeof vi.fn> };
  let fixture: any;

  beforeEach(async () => {
    statisticServiceMock = {
      getRecipesByTags: vi.fn().mockReturnValue(of([])),
      getRecipesByCuisine: vi.fn().mockReturnValue(of([])),
      getRecipesByCategory: vi.fn().mockReturnValue(of([])),
      getRecipesByVotes: vi.fn().mockReturnValue(of([]))
    };
    foodServiceMock = { search: vi.fn().mockReturnValue(of({ items: [], totalResults: 0 })) };
    await TestBed.configureTestingModule({
      imports: [StatisticComponent],
      providers: [
        { provide: StatisticService, useValue: statisticServiceMock },
        { provide: FoodService, useValue: foodServiceMock }
      ]
    }).compileComponents();
    fixture = TestBed.createComponent(StatisticComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should set tags data from service', async () => {
    // Arrange
    const tags = [
      { tag: 'a', count: 2 },
      { tag: 'b', count: 1 }
    ];
    statisticServiceMock.getRecipesByTags.mockReturnValue(of(tags));

    // Act
    // Re-create fixture/component so constructor uses the correct mock
    fixture = TestBed.createComponent(StatisticComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    // Assert
    expect(component.tagsData()).toEqual(tags);
    expect(component.tagsChartLabels()).toEqual(['a', 'b']);
    expect(component.tagsChartData()).toEqual([2, 1]);
  });
});
