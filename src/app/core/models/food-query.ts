import { FoodFilter } from './food-filter';
import { FoodSortBy, SortDirection } from './food-sort';

export interface FoodQuery extends FoodFilter {
  pageIndex: number;
  pageSize: number;
  sortBy: FoodSortBy;
  sortDirection: SortDirection;
  refreshTick: number;
}
