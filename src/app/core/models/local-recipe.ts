import { FoodDetail } from './food-detail';

export interface LocalRecipeDraft {
  title: string;
  cuisine: string;
  category: string;
  instructions: string;
  image?: string;
  sourceUrl?: string;
  youtubeUrl?: string;
  tags: string[];
}

export interface LocalRecipeState {
  custom: FoodDetail[];
  overrides: FoodDetail[];
  deletedIds: number[];
}

export interface LocalRecipeSnapshot {
  custom: FoodDetail[];
  overrides: FoodDetail[];
  deletedIds: number[];
}

export interface LocalRecipeFacets {
  cuisines: string[];
  categories: string[];
}
