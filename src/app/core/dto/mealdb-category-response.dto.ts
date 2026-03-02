export interface MealDbCategoryDto {
  strCategory: string;
}

export interface MealDbCategoryResponseDto {
  meals: MealDbCategoryDto[] | null;
}
