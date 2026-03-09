import { TestBed } from '@angular/core/testing';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { StatisticService } from './statistic.service';
import { FoodService } from '../../../core/services/food.service';
import { of, firstValueFrom } from 'rxjs';

describe('StatisticService', () => {
  let service: StatisticService;
  let foodServiceMock: { search: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    foodServiceMock = { search: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        StatisticService,
        { provide: FoodService, useValue: foodServiceMock }
      ]
    });
    service = TestBed.inject(StatisticService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should aggregate tags correctly', async () => {
    const mockPage = {
      items: [
        { tags: ['a', 'b'] },
        { tags: ['a'] },
        { tags: ['b', 'c'] }
      ]
    };
    foodServiceMock.search.mockReturnValue(of(mockPage));
    const result = await firstValueFrom(service.getRecipesByTags());
    expect(result).toEqual([
      { tag: 'a', count: 2 },
      { tag: 'b', count: 2 },
      { tag: 'c', count: 1 }
    ]);
  });
});
