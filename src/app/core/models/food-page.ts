import { Food } from './food';

export interface FoodCategoryCount {
  category: string;
  count: number;
}

export interface FoodPage {
  items: Food[];
  totalResults: number;
  pageIndex: number;
  pageSize: number;
  categoryCounts: FoodCategoryCount[];
}
