import { Food, FoodCategoryCount, FoodSortBy, FoodTagCount, SortDirection } from '../../models';

export interface FoodState {
  query: string;
  cuisine: string;
  category: string;
  tag: string;
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
  tagCounts: FoodTagCount[];
  hasOwnRecipes: boolean;
  totalResults: number;
  loading: boolean;
  error: string | null;
}
