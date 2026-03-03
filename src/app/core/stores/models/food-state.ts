import { Food, FoodCategoryCount, FoodSortBy, SortDirection } from '../../models';

export interface FoodState {
  query: string;
  cuisine: string;
  category: string;
  mineOnly: boolean;
  cuisines: string[];
  categories: string[];
  sortBy: FoodSortBy;
  sortDirection: SortDirection;
  pageIndex: number;
  pageSize: number;
  refreshTick: number;
  items: Food[];
  categoryCounts: FoodCategoryCount[];
  totalResults: number;
  loading: boolean;
  error: string | null;
}
