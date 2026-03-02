import { MealDbMealDto } from './mealdb-meal.dto';

export interface MealDbSearchResponseDto {
  meals: MealDbMealDto[] | null;
}
